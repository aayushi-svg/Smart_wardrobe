"""Password hashing, session tokens, and the request dependency that turns a
cookie into a user row.

Hashing is PBKDF2-HMAC-SHA256 from the stdlib rather than bcrypt/argon2 so the
backend installs with no compiled dependencies. The stored format carries its
own iteration count, so the cost can be raised later without invalidating
existing passwords.
"""

import base64
import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Cookie, Depends, Header, HTTPException, Response

from .config import (
    COOKIE_NAME,
    COOKIE_SECURE,
    JWT_ALGORITHM,
    JWT_SECRET,
    SESSION_DAYS,
)
from .db import connect

PBKDF2_ITERATIONS = 390_000


# --------------------------------------------------------------------------
# Passwords
# --------------------------------------------------------------------------

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256${}${}${}".format(
        PBKDF2_ITERATIONS,
        base64.b64encode(salt).decode(),
        base64.b64encode(digest).decode(),
    )


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        algorithm, iterations, salt_b64, digest_b64 = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), base64.b64decode(salt_b64), int(iterations)
        )
    except (ValueError, TypeError):
        return False
    # Constant time so a wrong password cannot be narrowed down by timing.
    return hmac.compare_digest(expected, actual)


def password_problem(password: str) -> str | None:
    """Returns a human-readable reason the password is unusable, or None."""
    if len(password) < 8:
        return "Password must be at least 8 characters."
    if len(password) > 200:
        return "Password must be under 200 characters."
    if password.isdigit():
        return "Password cannot be only numbers."
    return None


# --------------------------------------------------------------------------
# Session tokens
# --------------------------------------------------------------------------

def create_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "iat": now,
            "exp": now + timedelta(days=SESSION_DAYS),
            "jti": uuid.uuid4().hex,
        },
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=SESSION_DAYS * 24 * 3600,
        httponly=True,
        secure=COOKIE_SECURE,
        # "lax" keeps the cookie on the top-level navigations the app relies on
        # while still blocking it from cross-site form posts.
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def _decode(token: str) -> str | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None


# --------------------------------------------------------------------------
# Request dependencies
# --------------------------------------------------------------------------

def load_user(user_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        return conn.execute(
            """SELECT u.id, u.email, u.created_at,
                      p.display_name, p.username, p.photo_url, p.birthdate, p.gender,
                      p.height_cm, p.body_type, p.city, p.bio, p.style_tags, p.sizes,
                      p.onboarding_step, p.onboarded_at
                 FROM users u
                 LEFT JOIN profiles p ON p.user_id = u.id
                WHERE u.id = %s""",
            (user_id,),
        ).fetchone()


def optional_user(
    session: str | None = Cookie(default=None, alias=COOKIE_NAME),
    authorization: str | None = Header(default=None),
) -> dict[str, Any] | None:
    """Cookie first; the Bearer header is there for non-browser clients."""
    token = session
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    if not token:
        return None
    user_id = _decode(token)
    return load_user(user_id) if user_id else None


def current_user(user: dict[str, Any] | None = Depends(optional_user)) -> dict[str, Any]:
    if user is None:
        raise HTTPException(401, "Not signed in")
    return user


def current_user_id(user: dict[str, Any] = Depends(current_user)) -> str:
    return user["id"]
