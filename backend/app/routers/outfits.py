import json
import random
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from .. import gemini, storage
from ..config import DEMO_USER_ID
from ..db import connect
from ..schemas import Outfit

router = APIRouter(prefix="/api/outfits", tags=["outfits"])

# Each rule is (occasion, sub tag, extra categories worth adding, chance of a dress).
OCCASION_RULES = [
    ("Evening Social", "Dressy casual", ["shoes", "bag", "jewelry", "sunglasses"], 0.45),
    ("Weekend Brunch", "Dressy casual", ["shoes", "bag", "sunglasses", "watch"], 0.35),
    ("Evening Activity", "Relaxed casual", ["outerwear", "shoes", "bag", "watch"], 0.15),
    ("Night-time Party", "Night out", ["shoes", "bag", "jewelry"], 0.6),
    ("Weekday Errands", "Relaxed casual", ["outerwear", "shoes", "sunglasses"], 0.1),
]


def _row_to_outfit(row) -> Outfit:
    return Outfit(
        id=row["id"],
        occasion=row["occasion"],
        subTag=row["sub_tag"],
        itemIds=json.loads(row["item_ids"]),
        avatarUrl=row["avatar_url"],
        status=row["status"],
    )


def _build_look(by_category: dict[str, list[str]], rule, rng: random.Random) -> list[str]:
    _, _, extras, dress_chance = rule
    chosen: list[str] = []

    dresses = by_category.get("dress", [])
    tops, bottoms = by_category.get("top", []), by_category.get("bottom", [])

    if dresses and (rng.random() < dress_chance or not (tops and bottoms)):
        chosen.append(rng.choice(dresses))
    elif tops and bottoms:
        chosen.append(rng.choice(tops))
        chosen.append(rng.choice(bottoms))
    else:
        # Not enough to build a real look - use whatever exists.
        chosen.extend(rng.choice(v) for v in by_category.values() if v)
        return chosen[:4]

    for category in extras:
        pool = by_category.get(category, [])
        if pool and rng.random() < 0.8:
            chosen.append(rng.choice(pool))

    return chosen


def _generate_suggestions(count: int = 5) -> list[Outfit]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT id, category FROM closet_items WHERE user_id = ? AND is_wishlist = 0",
            (DEMO_USER_ID,),
        ).fetchall()

    by_category: dict[str, list[str]] = {}
    for row in rows:
        by_category.setdefault(row["category"], []).append(row["id"])

    if not by_category:
        return []

    rng = random.Random()
    created: list[Outfit] = []
    now = datetime.now(timezone.utc).isoformat()

    with connect() as conn:
        # Clear the previous batch. Looks that are currently rendering, saved,
        # or planned on the calendar are all left alone.
        conn.execute(
            """DELETE FROM outfits
               WHERE user_id = ? AND status = 'suggested'
                 AND id NOT IN (SELECT outfit_id FROM calendar_entries WHERE user_id = ?)""",
            (DEMO_USER_ID, DEMO_USER_ID),
        )
        for rule in OCCASION_RULES[:count]:
            item_ids = _build_look(by_category, rule, rng)
            if not item_ids:
                continue
            outfit_id = uuid.uuid4().hex
            conn.execute(
                """INSERT INTO outfits
                   (id, user_id, occasion, sub_tag, item_ids, status, created_at)
                   VALUES (?, ?, ?, ?, ?, 'suggested', ?)""",
                (outfit_id, DEMO_USER_ID, rule[0], rule[1], json.dumps(item_ids), now),
            )
            created.append(
                Outfit(id=outfit_id, occasion=rule[0], subTag=rule[1], itemIds=item_ids)
            )
    return created


@router.get("/suggestions", response_model=list[Outfit])
def suggestions(refresh: bool = False):
    if not refresh:
        with connect() as conn:
            rows = conn.execute(
                """SELECT * FROM outfits WHERE user_id = ?
                   AND status IN ('suggested', 'generating')
                   ORDER BY created_at""",
                (DEMO_USER_ID,),
            ).fetchall()
        if rows:
            return [_row_to_outfit(r) for r in rows]
    return _generate_suggestions()


@router.get("", response_model=list[Outfit])
def list_outfits():
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM outfits WHERE user_id = ? ORDER BY created_at DESC", (DEMO_USER_ID,)
        ).fetchall()
    return [_row_to_outfit(r) for r in rows]


@router.post("/{outfit_id}/avatar", response_model=Outfit)
def generate_avatar(outfit_id: str):
    """Render the user wearing this outfit: body reference + garment photos -> photo."""
    with connect() as conn:
        outfit = conn.execute(
            "SELECT * FROM outfits WHERE id = ? AND user_id = ?", (outfit_id, DEMO_USER_ID)
        ).fetchone()
        if outfit is None:
            raise HTTPException(404, "Outfit not found")

        # Every reference feeds the model as a character anchor, face first: a
        # close portrait pins the identity far better than a full-body shot
        # where the face is only a few dozen pixels tall.
        references = conn.execute(
            """SELECT url FROM avatar_references WHERE user_id = ?
               ORDER BY CASE angle
                   WHEN 'face'  THEN 0
                   WHEN 'front' THEN 1
                   WHEN 'side'  THEN 2
                   ELSE 3
               END, created_at""",
            (DEMO_USER_ID,),
        ).fetchall()
        if not references:
            raise HTTPException(
                400,
                "Upload a full-body photo of yourself first (Profile -> body reference).",
            )

        item_ids = json.loads(outfit["item_ids"])
        placeholders = ",".join("?" * len(item_ids))
        items = conn.execute(
            f"SELECT * FROM closet_items WHERE id IN ({placeholders})", item_ids
        ).fetchall()

    if not items:
        raise HTTPException(400, "This outfit has no items left in your closet.")

    garments = []
    for item in items:
        # The cutout is a cleaner reference; fall back to the original photo.
        url = item["cutout_url"] or item["image_url"]
        if not url:
            continue
        label = " ".join(x for x in [item["brand"], item["description"]] if x) or item["category"]
        garments.append((storage.read_url(url), storage.mime_for_url(url), label))

    if not garments:
        raise HTTPException(400, "None of this outfit's items have photos yet.")

    # Rendering takes ~30s. Park the look in 'generating' first so a concurrent
    # suggestion refresh - which sweeps away rows still marked 'suggested' -
    # can't delete it out from under us mid-call.
    # A row still marked 'generating' is left over from an interrupted run;
    # treat it as a plain suggestion so the state can't get stuck.
    previous_status = "suggested" if outfit["status"] == "generating" else outfit["status"]
    with connect() as conn:
        conn.execute(
            "UPDATE outfits SET status = 'generating' WHERE id = ?", (outfit_id,)
        )

    identity_images = [
        (storage.read_url(r["url"]), storage.mime_for_url(r["url"])) for r in references
    ]

    try:
        rendered = gemini.generate_tryon(
            identity_images=identity_images,
            garments=garments,
            occasion=f"{outfit['occasion']} ({outfit['sub_tag']})",
        )
    except Exception as exc:
        with connect() as conn:
            conn.execute(
                "UPDATE outfits SET status = ? WHERE id = ?", (previous_status, outfit_id)
            )
        if isinstance(exc, gemini.GeminiNotConfigured):
            raise HTTPException(503, str(exc))
        raise HTTPException(502, f"Avatar generation failed: {exc}")

    avatar_url = storage.save_bytes(rendered, "image/png")
    with connect() as conn:
        # Restore the status it had before rendering. Staying 'suggested' keeps
        # the look - and its new avatar - visible in the home feed until the
        # user asks for new looks; calendar entries are protected separately.
        conn.execute(
            "UPDATE outfits SET avatar_url = ?, status = ? WHERE id = ?",
            (avatar_url, previous_status, outfit_id),
        )
        row = conn.execute("SELECT * FROM outfits WHERE id = ?", (outfit_id,)).fetchone()

    if row is None:
        raise HTTPException(409, "That outfit was removed while the avatar was rendering.")
    return _row_to_outfit(row)
