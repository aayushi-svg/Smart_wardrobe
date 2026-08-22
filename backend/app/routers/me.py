"""Profile and onboarding. The onboarding wizard writes through the same
PATCH /api/me that the settings screen uses; only `POST /api/me/onboarding/complete`
flips the account out of onboarding.
"""

import json
import re
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from psycopg.errors import UniqueViolation

from .. import storage
from ..auth import current_user, load_user
from ..db import connect
from ..schemas import ProfileUpdate, User, user_public

router = APIRouter(prefix="/api/me", tags=["me"])

USERNAME_RE = re.compile(r"^[a-z0-9._]{3,24}$")
GENDERS = {"", "woman", "man", "non-binary", "prefer not to say"}
BODY_TYPES = {"", "petite", "slim", "athletic", "average", "curvy", "plus", "tall"}

# The wizard has four steps; anything past the last one means "done".
ONBOARDING_STEPS = 4


def _reload(user_id: str) -> User:
    row = load_user(user_id)
    if row is None:
        raise HTTPException(404, "Account not found")
    return user_public(row)


def _parse_birthdate(value: str) -> date:
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise HTTPException(400, "Birthdate must be formatted as YYYY-MM-DD.")
    if parsed > date.today():
        raise HTTPException(400, "Birthdate cannot be in the future.")
    if parsed.year < 1900:
        raise HTTPException(400, "That birthdate does not look right.")
    return parsed


@router.get("", response_model=User)
def get_me(user: dict[str, Any] = Depends(current_user)):
    return user_public(user)


@router.patch("", response_model=User)
def update_me(body: ProfileUpdate, user: dict[str, Any] = Depends(current_user)):
    updates: dict[str, Any] = {}

    if body.displayName is not None:
        name = body.displayName.strip()
        if len(name) > 60:
            raise HTTPException(400, "Name must be under 60 characters.")
        updates["display_name"] = name

    if body.username is not None:
        handle = body.username.strip().lower().lstrip("@")
        if not USERNAME_RE.match(handle):
            raise HTTPException(
                400,
                "Username must be 3-24 characters using lowercase letters, numbers, dots "
                "or underscores.",
            )
        updates["username"] = handle

    if body.birthdate is not None:
        updates["birthdate"] = _parse_birthdate(body.birthdate) if body.birthdate else None

    if body.gender is not None:
        gender = body.gender.strip().lower()
        if gender not in GENDERS:
            raise HTTPException(400, f"Gender must be one of {sorted(GENDERS - {''})}.")
        updates["gender"] = gender

    if body.heightCm is not None:
        if not 90 <= body.heightCm <= 250:
            raise HTTPException(400, "Height must be between 90cm and 250cm.")
        updates["height_cm"] = body.heightCm

    if body.bodyType is not None:
        body_type = body.bodyType.strip().lower()
        if body_type not in BODY_TYPES:
            raise HTTPException(400, f"Body type must be one of {sorted(BODY_TYPES - {''})}.")
        updates["body_type"] = body_type

    if body.city is not None:
        updates["city"] = body.city.strip()[:80]

    if body.bio is not None:
        updates["bio"] = body.bio.strip()[:280]

    if body.styleTags is not None:
        tags = [t.strip()[:30] for t in body.styleTags if t.strip()][:12]
        updates["style_tags"] = json.dumps(tags)

    if body.sizes is not None:
        sizes = {
            str(k)[:20]: str(v).strip()[:20]
            for k, v in list(body.sizes.items())[:12]
            if str(v).strip()
        }
        updates["sizes"] = json.dumps(sizes)

    if body.onboardingStep is not None:
        updates["onboarding_step"] = max(0, min(body.onboardingStep, ONBOARDING_STEPS))

    if not updates:
        return user_public(user)

    assignments = ", ".join(f"{column} = %s" for column in updates)
    try:
        with connect() as conn:
            conn.execute(
                f"UPDATE profiles SET {assignments} WHERE user_id = %s",
                [*updates.values(), user["id"]],
            )
    except UniqueViolation:
        raise HTTPException(409, "That username is already taken.")

    return _reload(user["id"])


@router.post("/photo", response_model=User)
async def upload_photo(file: UploadFile, user: dict[str, Any] = Depends(current_user)):
    data = await file.read()
    if not data:
        raise HTTPException(400, "That file was empty.")
    url = storage.save_bytes(data, file.content_type or "image/jpeg")
    with connect() as conn:
        conn.execute("UPDATE profiles SET photo_url = %s WHERE user_id = %s", (url, user["id"]))
    return _reload(user["id"])


@router.delete("/photo", response_model=User)
def remove_photo(user: dict[str, Any] = Depends(current_user)):
    with connect() as conn:
        conn.execute("UPDATE profiles SET photo_url = NULL WHERE user_id = %s", (user["id"],))
    return _reload(user["id"])


@router.post("/onboarding/complete", response_model=User)
def complete_onboarding(user: dict[str, Any] = Depends(current_user)):
    with connect() as conn:
        conn.execute(
            """UPDATE profiles
                  SET onboarded_at = COALESCE(onboarded_at, now()),
                      onboarding_step = %s
                WHERE user_id = %s""",
            (ONBOARDING_STEPS, user["id"]),
        )
    return _reload(user["id"])


@router.post("/onboarding/restart", response_model=User)
def restart_onboarding(user: dict[str, Any] = Depends(current_user)):
    with connect() as conn:
        conn.execute(
            "UPDATE profiles SET onboarded_at = NULL, onboarding_step = 0 WHERE user_id = %s",
            (user["id"],),
        )
    return _reload(user["id"])
