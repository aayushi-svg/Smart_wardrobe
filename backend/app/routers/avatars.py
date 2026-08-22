import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile

from .. import storage
from ..auth import current_user_id
from ..db import connect
from ..schemas import AvatarReference, RenameAvatarRequest, SavedAvatar, SaveAvatarRequest

router = APIRouter(tags=["avatars"])

# "face" is a close portrait used purely as an identity anchor; the others are
# full-body shots.
ANGLES = {"face", "front", "back", "side"}


# --------------------------------------------------------------------------
# Body references — the photos the stylist dresses
# --------------------------------------------------------------------------

@router.get("/api/avatar-references", response_model=list[AvatarReference])
def list_references(user_id: str = Depends(current_user_id)):
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM avatar_references WHERE user_id = %s ORDER BY created_at",
            (user_id,),
        ).fetchall()
    return [AvatarReference(id=r["id"], url=r["url"], angle=r["angle"]) for r in rows]


@router.post("/api/avatar-references", response_model=AvatarReference, status_code=201)
async def add_reference(
    file: UploadFile,
    angle: str = Form("front"),
    user_id: str = Depends(current_user_id),
):
    if angle not in ANGLES:
        raise HTTPException(400, f"angle must be one of {sorted(ANGLES)}")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file")

    url = storage.save_bytes(data, file.content_type or "image/jpeg")
    ref_id = uuid.uuid4().hex
    with connect() as conn:
        # One reference per angle keeps the identity set tight; re-uploading an
        # angle replaces it rather than stacking near-duplicates.
        conn.execute(
            "DELETE FROM avatar_references WHERE user_id = %s AND angle = %s", (user_id, angle)
        )
        conn.execute(
            "INSERT INTO avatar_references (id, user_id, url, angle) VALUES (%s, %s, %s, %s)",
            (ref_id, user_id, url, angle),
        )
    return AvatarReference(id=ref_id, url=url, angle=angle)


@router.delete("/api/avatar-references/{ref_id}", status_code=204)
def delete_reference(ref_id: str, user_id: str = Depends(current_user_id)):
    with connect() as conn:
        conn.execute(
            "DELETE FROM avatar_references WHERE id = %s AND user_id = %s", (ref_id, user_id)
        )


# --------------------------------------------------------------------------
# Saved avatars — rendered looks the user chose to keep
# --------------------------------------------------------------------------

def _row_to_saved(row) -> SavedAvatar:
    return SavedAvatar(
        id=row["id"],
        url=row["url"],
        title=row["title"],
        outfitId=row["outfit_id"],
        createdAt=row["created_at"].isoformat(),
    )


@router.get("/api/saved-avatars", response_model=list[SavedAvatar])
def list_saved(user_id: str = Depends(current_user_id)):
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM saved_avatars WHERE user_id = %s ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return [_row_to_saved(r) for r in rows]


@router.post("/api/saved-avatars", response_model=SavedAvatar, status_code=201)
def save_avatar(body: SaveAvatarRequest, user_id: str = Depends(current_user_id)):
    if not body.url.startswith("/uploads/"):
        raise HTTPException(400, "Only rendered avatars can be saved.")

    with connect() as conn:
        # Saving the same render twice is a no-op rather than an error — the
        # button is easy to hit twice while the toast is still up.
        existing = conn.execute(
            "SELECT * FROM saved_avatars WHERE user_id = %s AND url = %s", (user_id, body.url)
        ).fetchone()
        if existing is not None:
            return _row_to_saved(existing)

        if body.outfitId:
            owns = conn.execute(
                "SELECT 1 FROM outfits WHERE id = %s AND user_id = %s", (body.outfitId, user_id)
            ).fetchone()
            if owns is None:
                raise HTTPException(404, "Outfit not found")

        saved_id = uuid.uuid4().hex
        conn.execute(
            """INSERT INTO saved_avatars (id, user_id, url, title, outfit_id)
               VALUES (%s, %s, %s, %s, %s)""",
            (saved_id, user_id, body.url, body.title.strip()[:120], body.outfitId),
        )
        row = conn.execute("SELECT * FROM saved_avatars WHERE id = %s", (saved_id,)).fetchone()
    return _row_to_saved(row)


@router.patch("/api/saved-avatars/{saved_id}", response_model=SavedAvatar)
def rename_saved(
    saved_id: str, body: RenameAvatarRequest, user_id: str = Depends(current_user_id)
):
    with connect() as conn:
        conn.execute(
            "UPDATE saved_avatars SET title = %s WHERE id = %s AND user_id = %s",
            (body.title.strip()[:120], saved_id, user_id),
        )
        row = conn.execute(
            "SELECT * FROM saved_avatars WHERE id = %s AND user_id = %s", (saved_id, user_id)
        ).fetchone()
    if row is None:
        raise HTTPException(404, "Saved avatar not found")
    return _row_to_saved(row)


@router.delete("/api/saved-avatars/{saved_id}", status_code=204)
def delete_saved(saved_id: str, user_id: str = Depends(current_user_id)):
    with connect() as conn:
        conn.execute(
            "DELETE FROM saved_avatars WHERE id = %s AND user_id = %s", (saved_id, user_id)
        )
