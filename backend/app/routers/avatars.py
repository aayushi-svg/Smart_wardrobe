import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Form, HTTPException, UploadFile

from .. import storage
from ..config import DEMO_USER_ID
from ..db import connect
from ..schemas import AvatarReference

router = APIRouter(prefix="/api/avatar-references", tags=["avatar-references"])

# "face" is a close portrait used purely as an identity anchor; the others are
# full-body shots.
ANGLES = {"face", "front", "back", "side"}


@router.get("", response_model=list[AvatarReference])
def list_references():
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM avatar_references WHERE user_id = ? ORDER BY created_at",
            (DEMO_USER_ID,),
        ).fetchall()
    return [AvatarReference(id=r["id"], url=r["url"], angle=r["angle"]) for r in rows]


@router.post("", response_model=AvatarReference, status_code=201)
async def add_reference(file: UploadFile, angle: str = Form("front")):
    if angle not in ANGLES:
        raise HTTPException(400, f"angle must be one of {sorted(ANGLES)}")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")

    url = storage.save_bytes(data, file.content_type or "image/jpeg")
    ref_id = uuid.uuid4().hex
    with connect() as conn:
        conn.execute(
            """INSERT INTO avatar_references (id, user_id, url, angle, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (ref_id, DEMO_USER_ID, url, angle, datetime.now(timezone.utc).isoformat()),
        )
    return AvatarReference(id=ref_id, url=url, angle=angle)


@router.delete("/{ref_id}", status_code=204)
def delete_reference(ref_id: str):
    with connect() as conn:
        conn.execute(
            "DELETE FROM avatar_references WHERE id = ? AND user_id = ?", (ref_id, DEMO_USER_ID)
        )
