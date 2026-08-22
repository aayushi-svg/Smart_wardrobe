import json
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, UploadFile

from .. import gemini, storage
from ..auth import current_user_id
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


def _own_item(conn, item_id: str, user_id: str):
    row = conn.execute(
        "SELECT * FROM closet_items WHERE id = %s AND user_id = %s", (item_id, user_id)
    ).fetchone()
    if row is None:
        raise HTTPException(404, "Item not found")
    return row


def _photos(conn, item_id: str) -> list[str]:
    return [
        p["url"]
        for p in conn.execute(
            "SELECT url FROM item_photos WHERE item_id = %s ORDER BY position", (item_id,)
        ).fetchall()
    ]


@router.get("", response_model=list[ClosetItem])
def list_items(wishlist: bool | None = None, user_id: str = Depends(current_user_id)):
    with connect() as conn:
        sql = "SELECT * FROM closet_items WHERE user_id = %s"
        args: list = [user_id]
        if wishlist is not None:
            sql += " AND is_wishlist = %s"
            args.append(wishlist)
        rows = conn.execute(sql + " ORDER BY created_at DESC", args).fetchall()

        photos: dict[str, list[str]] = {}
        if rows:
            for p in conn.execute(
                """SELECT p.item_id, p.url FROM item_photos p
                   JOIN closet_items i ON i.id = p.item_id
                   WHERE i.user_id = %s ORDER BY p.position""",
                (user_id,),
            ).fetchall():
                photos.setdefault(p["item_id"], []).append(p["url"])

    return [_row_to_item(r, photos.get(r["id"], [])) for r in rows]


@router.post("/analyze", response_model=AnalysisResult)
async def analyze(file: UploadFile, user_id: str = Depends(current_user_id)):
    """Pre-fill the add-item form from a photo. Optional - the form still works
    if this fails or the key is missing."""
    data = await file.read()
    try:
        return AnalysisResult(**gemini.analyze_item(data, file.content_type or "image/jpeg"))
    except gemini.GeminiNotConfigured as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(502, gemini.explain(exc))


def _make_cutout(item_id: str, url: str) -> None:
    """Runs after the upload response is sent, so adding an item stays instant."""
    try:
        data = storage.read_url(url)
        out = gemini.cutout_item(data, storage.mime_for_url(url))
        cutout_url = storage.save_bytes(out, "image/png")
        with connect() as conn:
            conn.execute(
                "UPDATE closet_items SET cutout_url = %s WHERE id = %s", (cutout_url, item_id)
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
    user_id: str = Depends(current_user_id),
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
               (id, user_id, category, brand, description, color, image_url, is_wishlist)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (item_id, user_id, category, brand, description, color, urls[0], isWishlist),
        )
        for i, url in enumerate(urls):
            conn.execute(
                "INSERT INTO item_photos (id, item_id, url, position) VALUES (%s, %s, %s, %s)",
                (uuid.uuid4().hex, item_id, url, i),
            )
        row = conn.execute("SELECT * FROM closet_items WHERE id = %s", (item_id,)).fetchone()

    if autoCutout:
        background.add_task(_make_cutout, item_id, urls[0])

    return _row_to_item(row, urls)


@router.patch("/{item_id}", response_model=ClosetItem)
def update_item(item_id: str, patch: ItemUpdate, user_id: str = Depends(current_user_id)):
    fields = {
        "category": patch.category,
        "brand": patch.brand,
        "description": patch.description,
        "color": patch.color,
        "is_wishlist": patch.isWishlist,
    }
    sets = {k: v for k, v in fields.items() if v is not None}

    with connect() as conn:
        _own_item(conn, item_id, user_id)
        if sets:
            assignments = ", ".join(f"{k} = %s" for k in sets)
            conn.execute(
                f"UPDATE closet_items SET {assignments} WHERE id = %s AND user_id = %s",
                [*sets.values(), item_id, user_id],
            )
        row = _own_item(conn, item_id, user_id)
        photos = _photos(conn, item_id)
    return _row_to_item(row, photos)


@router.post("/{item_id}/cutout", response_model=ClosetItem)
def redo_cutout(item_id: str, user_id: str = Depends(current_user_id)):
    with connect() as conn:
        row = _own_item(conn, item_id, user_id)

    if not row["image_url"]:
        raise HTTPException(400, "Item has no photo to work from")

    try:
        data = storage.read_url(row["image_url"])
        out = gemini.cutout_item(data, storage.mime_for_url(row["image_url"]))
    except gemini.GeminiNotConfigured as exc:
        raise HTTPException(503, str(exc))
    except Exception as exc:
        raise HTTPException(502, gemini.explain(exc))

    cutout_url = storage.save_bytes(out, "image/png")
    with connect() as conn:
        conn.execute(
            "UPDATE closet_items SET cutout_url = %s WHERE id = %s", (cutout_url, item_id)
        )
        row = _own_item(conn, item_id, user_id)
        photos = _photos(conn, item_id)
    return _row_to_item(row, photos)


@router.post("/{item_id}/enrich", response_model=ClosetItem)
def enrich_item(item_id: str, user_id: str = Depends(current_user_id)):
    """Backfill whatever this item is missing: details from the photo, then a
    cutout. One item per call so the UI can show progress and nothing times out.
    """
    with connect() as conn:
        row = _own_item(conn, item_id, user_id)
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
            raise HTTPException(502, gemini.explain(exc))

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
            raise HTTPException(502, gemini.explain(exc))

    with connect() as conn:
        if updates:
            assignments = ", ".join(f"{k} = %s" for k in updates)
            conn.execute(
                f"UPDATE closet_items SET {assignments} WHERE id = %s AND user_id = %s",
                [*updates.values(), item_id, user_id],
            )
        row = _own_item(conn, item_id, user_id)
        photos = _photos(conn, item_id)
    return _row_to_item(row, photos)


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: str, user_id: str = Depends(current_user_id)):
    with connect() as conn:
        # Drop any saved outfit that referenced this item, before the item row
        # goes away — `item_ids` is denormalised JSON, so nothing cascades.
        conn.execute(
            """DELETE FROM outfits
                WHERE user_id = %s AND item_ids @> %s::jsonb""",
            (user_id, json.dumps([item_id])),
        )
        conn.execute(
            "DELETE FROM closet_items WHERE id = %s AND user_id = %s", (item_id, user_id)
        )
