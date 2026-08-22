import re
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg.errors import UniqueViolation

from ..auth import (
    clear_session_cookie,
    create_token,
    current_user,
    hash_password,
    load_user,
    password_problem,
    set_session_cookie,
    verify_password,
)
from ..config import GOOGLE_CLIENT_ID
from ..db import connect
from ..schemas import (
    AuthConfig,
    Credentials,
    GoogleLogin,
    LoginRequest,
    PasswordChange,
    User,
    user_public,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

USERNAME_RE = re.compile(r"^[a-z0-9._]{3,24}$")


def _suggest_username(seed: str) -> str:
    """A unique, URL-safe handle derived from the email or display name."""
    base = re.sub(r"[^a-z0-9._]", "", seed.lower())[:20] or "member"
    if len(base) < 3:
        base = f"{base}user"
    with connect() as conn:
        candidate = base
        for _ in range(50):
            taken = conn.execute(
                "SELECT 1 FROM profiles WHERE username = %s", (candidate,)
            ).fetchone()
            if taken is None:
                return candidate
            candidate = f"{base[:18]}{uuid.uuid4().hex[:4]}"
    return f"{base[:16]}{uuid.uuid4().hex[:6]}"


def _create_user(
    email: str,
    password_hash: str | None,
    display_name: str,
    google_sub: str | None = None,
    photo_url: str | None = None,
) -> dict[str, Any]:
    user_id = uuid.uuid4().hex
    username = _suggest_username(display_name or email.split("@")[0])
    try:
        with connect() as conn:
            conn.execute(
                """INSERT INTO users (id, email, password_hash, google_sub, last_login_at)
                   VALUES (%s, %s, %s, %s, now())""",
                (user_id, email, password_hash, google_sub),
            )
            conn.execute(
                """INSERT INTO profiles (user_id, display_name, username, photo_url)
                   VALUES (%s, %s, %s, %s)""",
                (user_id, display_name, username, photo_url),
            )
            # Every user gets calendar defaults up front, so the settings screen
            # never has to cope with a missing row.
            conn.execute(
                "INSERT INTO calendar_settings (user_id) VALUES (%s)", (user_id,)
            )
    except UniqueViolation:
        raise HTTPException(409, "An account with that email already exists.")

    user = load_user(user_id)
    if user is None:
        raise HTTPException(500, "Account was created but could not be loaded.")
    return user


def _finish_login(response: Response, user_id: str) -> None:
    with connect() as conn:
        conn.execute("UPDATE users SET last_login_at = now() WHERE id = %s", (user_id,))
    set_session_cookie(response, create_token(user_id))


@router.get("/config", response_model=AuthConfig)
def auth_config():
    """Lets the login screen hide providers that have no credentials configured,
    so it never shows a button that cannot work."""
    return AuthConfig(
        googleEnabled=bool(GOOGLE_CLIENT_ID),
        googleClientId=GOOGLE_CLIENT_ID or None,
    )


@router.post("/register", response_model=User, status_code=201)
def register(body: Credentials, response: Response):
    email = body.email.lower().strip()
    problem = password_problem(body.password)
    if problem:
        raise HTTPException(400, problem)

    with connect() as conn:
        existing = conn.execute("SELECT 1 FROM users WHERE email = %s", (email,)).fetchone()
    if existing:
        raise HTTPException(409, "An account with that email already exists.")

    user = _create_user(email, hash_password(body.password), body.displayName.strip())
    _finish_login(response, user["id"])
    return user_public(user)


@router.post("/login", response_model=User)
def login(body: LoginRequest, response: Response):
    email = body.email.lower().strip()
    with connect() as conn:
        row = conn.execute(
            "SELECT id, password_hash FROM users WHERE email = %s", (email,)
        ).fetchone()

    # Same message either way — telling callers which half was wrong lets them
    # enumerate registered addresses.
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(401, "Email or password is incorrect.")

    user = load_user(row["id"])
    if user is None:
        raise HTTPException(401, "Email or password is incorrect.")
    _finish_login(response, user["id"])
    return user_public(user)


@router.post("/google", response_model=User)
def google_login(body: GoogleLogin, response: Response):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google sign-in is not configured on this server.")

    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    try:
        claims = google_id_token.verify_oauth2_token(
            body.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except Exception:
        raise HTTPException(401, "That Google sign-in could not be verified.")

    if not claims.get("email_verified"):
        raise HTTPException(401, "That Google account has no verified email address.")

    email = str(claims["email"]).lower()
    sub = str(claims["sub"])

    with connect() as conn:
        row = conn.execute(
            "SELECT id FROM users WHERE google_sub = %s OR email = %s", (sub, email)
        ).fetchone()
        if row is not None:
            # Links Google to an account that was originally created with a password.
            conn.execute("UPDATE users SET google_sub = %s WHERE id = %s", (sub, row["id"]))

    if row is None:
        user = _create_user(
            email,
            password_hash=None,
            display_name=str(claims.get("name") or "").strip(),
            google_sub=sub,
            photo_url=claims.get("picture"),
        )
    else:
        user = load_user(row["id"])
        if user is None:
            raise HTTPException(401, "That account is no longer available.")

    _finish_login(response, user["id"])
    return user_public(user)


@router.get("/me", response_model=User)
def me(user: dict[str, Any] = Depends(current_user)):
    return user_public(user)


@router.post("/logout", status_code=204)
def logout(response: Response):
    clear_session_cookie(response)


@router.post("/password", status_code=204)
def change_password(body: PasswordChange, user: dict[str, Any] = Depends(current_user)):
    problem = password_problem(body.newPassword)
    if problem:
        raise HTTPException(400, problem)

    with connect() as conn:
        row = conn.execute(
            "SELECT password_hash FROM users WHERE id = %s", (user["id"],)
        ).fetchone()
        # A Google-only account has no password yet; setting one is allowed and
        # gives them a second way in.
        if row and row["password_hash"] and not verify_password(
            body.currentPassword, row["password_hash"]
        ):
            raise HTTPException(403, "Current password is incorrect.")
        conn.execute(
            "UPDATE users SET password_hash = %s WHERE id = %s",
            (hash_password(body.newPassword), user["id"]),
        )


@router.delete("/account", status_code=204)
def delete_account(response: Response, user: dict[str, Any] = Depends(current_user)):
    """Cascades through every table that references users(id)."""
    with connect() as conn:
        conn.execute("DELETE FROM users WHERE id = %s", (user["id"],))
    clear_session_cookie(response)
