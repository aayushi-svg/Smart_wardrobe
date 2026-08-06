import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, UploadFile

from .. import gemini, storage
from ..config import DEMO_USER_ID
from ..db import connect
from ..schemas import AnalysisResult, ClosetItem, ItemUpdate

router = APIRouter(prefix="/api/items", tags=["items"])


def _row_to_item(row, photos: list[str]) -> ClosetItem:
    return ClosetItem(
        id=row["id"],
        category=row["category"],
        brand=row["brand"],
        description=row["description"],
        color=row["color"],
        imageUrl=row["image_url"],
        cutoutUrl=row["cutout_url"],
        isWishlist=bool(row["is_wishlist"]),
        photos=photos,
    )


@router.get("", response_model=list[ClosetItem])
def list_items(wishlist: bool | None = None):
    with connect() as conn:
        sql = "SELECT * FROM closet_items WHERE user_id = ?"
        args: list = [DEMO_USER_ID]
        if wishlist is not None:
            sql += " AND is_wishlist = ?"
            args.append(int(wishlist))
        rows = conn.execute(sql + " ORDER BY created_at DESC", args).fetchall()

        photos: dict[str, list[str]] = {}
        for p in conn.execute(
            "SELECT item_id, url FROM item_photos ORDER BY position"
        ).fetchall():
            photos.setdefault(p["item_id"], []).append(p["url"])

    return [_row_to_item(r, photos.get(r["id"], [])) for r in rows]


@router.post("/analyze", response_model=AnalysisResult)
async def analyze(file: UploadFile):
    """Pre-fill the add-item form from a photo. Optional - the form still works
    if this fails or the key is missing."""
    data = await file.read()
    try:
        return AnalysisResult(**gemini.analyze_item(data, file.content_type or "image/jpeg"))
    except gemini.GeminiNotConfigured as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(502, f"Gemini analyze failed: {exc}")


def _make_cutout(item_id: str, url: str) -> None:
    """Runs after the upload response is sent, so adding an item stays instant."""
    try:
        data = storage.read_url(url)
        out = gemini.cutout_item(data, storage.mime_for_url(url))
        cutout_url = storage.save_bytes(out, "image/png")
        with connect() as conn:
            conn.execute(
                "UPDATE closet_items SET cutout_url = ? WHERE id = ?", (cutout_url, item_id)
            )
    except Exception:
        # Leaving cutout_url NULL simply means the UI keeps showing the original.
        pass


@router.post("", response_model=ClosetItem, status_code=201)
async def create_item(
    background: BackgroundTasks,
    files: list[UploadFile],
    category: str = Form("top"),
    brand: str = Form(""),
    description: str = Form(""),
    color: str = Form("#cccccc"),
    isWishlist: bool = Form(False),
    autoCutout: bool = Form(True),
):
    if not files:
        raise HTTPException(400, "At least one photo is required")

    item_id = uuid.uuid4().hex
    urls: list[str] = []
    for upload in files:
        data = await upload.read()
        if data:
            urls.append(storage.save_bytes(data, upload.content_type or "image/jpeg"))

    if not urls:
        raise HTTPException(400, "Uploaded files were empty")

    with connect() as conn:
        conn.execute(
            """INSERT INTO closet_items
               (id, user_id, category, brand, description, color, image_url,
                is_wishlist, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                item_id, DEMO_USER_ID, category, brand, description, color,
                urls[0], int(isWishlist), datetime.now(timezone.utc).isoformat(),
            ),
        )
        for i, url in enumerate(urls):
            conn.execute(
                "INSERT INTO item_photos (id, item_id, url, position) VALUES (?, ?, ?, ?)",
                (uuid.uuid4().hex, item_id, url, i),
            )
        row = conn.execute("SELECT * FROM closet_items WHERE id = ?", (item_id,)).fetchone()

    if autoCutout:
        background.add_task(_make_cutout, item_id, urls[0])

    return _row_to_item(row, urls)


@router.patch("/{item_id}", response_model=ClosetItem)
def update_item(item_id: str, patch: ItemUpdate):
    fields = {
        "category": patch.category,
        "brand": patch.brand,
        "description": patch.description,
        "color": patch.color,
        "is_wishlist": None if patch.isWishlist is None else int(patch.isWishlist),
    }
    sets = {k: v for k, v in fields.items() if v is not None}

    with connect() as conn:
        if sets:
            assignments = ", ".join(f"{k} = ?" for k in sets)
            conn.execute(
                f"UPDATE closet_items SET {assignments} WHERE id = ? AND user_id = ?",
                [*sets.values(), item_id, DEMO_USER_ID],
            )
        row = conn.execute("SELECT * FROM closet_items WHERE id = ?", (item_id,)).fetchone()
        if row is None:
            raise HTTPException(404, "Item not found")
        photos = [
            p["url"]
            for p in conn.execute(
                "SELECT url FROM item_photos WHERE item_id = ? ORDER BY position", (item_id,)
            ).fetchall()
        ]
    return _row_to_item(row, photos)


@router.post("/{item_id}/cutout", response_model=ClosetItem)
def redo_cutout(item_id: str):
    with connect() as conn:
        row = conn.execute("SELECT * FROM closet_items WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Item not found")

    try:
        data = storage.read_url(row["image_url"])
        out = gemini.cutout_item(data, storage.mime_for_url(row["image_url"]))
    except gemini.GeminiNotConfigured as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(502, f"Cutout failed: {exc}")

    cutout_url = storage.save_bytes(out, "image/png")
    with connect() as conn:
        conn.execute("UPDATE closet_items SET cutout_url = ? WHERE id = ?", (cutout_url, item_id))
        row = conn.execute("SELECT * FROM closet_items WHERE id = ?", (item_id,)).fetchone()
        photos = [
            p["url"]
            for p in conn.execute(
                "SELECT url FROM item_photos WHERE item_id = ? ORDER BY position", (item_id,)
            ).fetchall()
        ]
    return _row_to_item(row, photos)


@router.post("/{item_id}/enrich", response_model=ClosetItem)
def enrich_item(item_id: str):
    """Backfill whatever this item is missing: details from the photo, then a
    cutout. One item per call so the UI can show progress and nothing times out.
    """
    with connect() as conn:
        row = conn.execute("SELECT * FROM closet_items WHERE id = ?", (item_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Item not found")
    if not row["image_url"]:
        raise HTTPException(400, "Item has no photo to work from")

    data = storage.read_url(row["image_url"])
    mime = storage.mime_for_url(row["image_url"])
    updates: dict[str, object] = {}

    if not row["brand"] and not row["description"]:
        try:
            found = gemini.analyze_item(data, mime)
        except gemini.GeminiNotConfigured as exc:
            raise HTTPException(503, str(exc))
        except Exception as exc:
            raise HTTPException(502, f"Analyze failed: {exc}")

        # Only write what actually came back; a blank field means the model had
        # nothing to say (e.g. no visible logo), not that we should clear data.
        updates["category"] = found["category"]
        for key in ("brand", "description", "color"):
            if found[key]:
                updates[key] = found[key]

    if not row["cutout_url"]:
        try:
            updates["cutout_url"] = storage.save_bytes(gemini.cutout_item(data, mime), "image/png")
        except gemini.GeminiNotConfigured as exc:
            raise HTTPException(503, str(exc))
        except Exception as exc:
            raise HTTPException(502, f"Cutout failed: {exc}")

    with connect() as conn:
        if updates:
            assignments = ", ".join(f"{k} = ?" for k in updates)
            conn.execute(
                f"UPDATE closet_items SET {assignments} WHERE id = ?",
                [*updates.values(), item_id],
            )
        row = conn.execute("SELECT * FROM closet_items WHERE id = ?", (item_id,)).fetchone()
        photos = [
            p["url"]
            for p in conn.execute(
                "SELECT url FROM item_photos WHERE item_id = ? ORDER BY position", (item_id,)
            ).fetchall()
        ]
    return _row_to_item(row, photos)


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: str):
    with connect() as conn:
        conn.execute(
            "DELETE FROM closet_items WHERE id = ? AND user_id = ?", (item_id, DEMO_USER_ID)
        )
        # Drop any saved outfit that referenced this item.
        for outfit in conn.execute(
            "SELECT id, item_ids FROM outfits WHERE user_id = ?", (DEMO_USER_ID,)
        ).fetchall():
            if item_id in json.loads(outfit["item_ids"]):
                conn.execute("DELETE FROM outfits WHERE id = ?", (outfit["id"],))
