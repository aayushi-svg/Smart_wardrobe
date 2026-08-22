"""Import the legacy pre-Postgres SQLite database into a Neon account.

The file is still named alta.db — it predates the rename to Closei, and the
name is left alone so existing installs keep working.

    cd backend
    venv/Scripts/python scripts/import_sqlite.py you@example.com

Everything in the old single-tenant database is copied onto the account with
that email: closet items, their photos, body references, outfits and calendar
entries. Image files are already on disk under backend/uploads and are simply
re-pointed, so nothing is re-uploaded.

Safe to re-run: rows are inserted with their original ids and ON CONFLICT DO
NOTHING, so a second run imports only what is missing.
"""

import json
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import BASE_DIR  # noqa: E402
from app.db import close_db, connect  # noqa: E402

DB_PATH = BASE_DIR / "alta.db"


def main(email: str) -> None:
    if not DB_PATH.exists():
        sys.exit(f"No SQLite database at {DB_PATH} — nothing to import.")

    old = sqlite3.connect(DB_PATH)
    old.row_factory = sqlite3.Row

    def table_exists(name: str) -> bool:
        return (
            old.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
            ).fetchone()
            is not None
        )

    with connect() as conn:
        user = conn.execute(
            "SELECT id FROM users WHERE email = %s", (email.lower().strip(),)
        ).fetchone()
        if user is None:
            sys.exit(f"No account with email {email}. Sign up in the app first.")
        user_id = user["id"]

        counts = {"items": 0, "photos": 0, "references": 0, "outfits": 0, "calendar": 0}

        for row in old.execute("SELECT * FROM closet_items").fetchall():
            conn.execute(
                """INSERT INTO closet_items
                   (id, user_id, category, brand, description, color, image_url,
                    cutout_url, is_wishlist)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (id) DO NOTHING""",
                (
                    row["id"], user_id, row["category"], row["brand"], row["description"],
                    row["color"], row["image_url"], row["cutout_url"],
                    bool(row["is_wishlist"]),
                ),
            )
            counts["items"] += 1

        if table_exists("item_photos"):
            for row in old.execute("SELECT * FROM item_photos").fetchall():
                conn.execute(
                    """INSERT INTO item_photos (id, item_id, url, position)
                       VALUES (%s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
                    (row["id"], row["item_id"], row["url"], row["position"]),
                )
                counts["photos"] += 1

        if table_exists("avatar_references"):
            for row in old.execute("SELECT * FROM avatar_references").fetchall():
                conn.execute(
                    """INSERT INTO avatar_references (id, user_id, url, angle)
                       VALUES (%s, %s, %s, %s) ON CONFLICT (id) DO NOTHING""",
                    (row["id"], user_id, row["url"], row["angle"]),
                )
                counts["references"] += 1

        if table_exists("outfits"):
            for row in old.execute("SELECT * FROM outfits").fetchall():
                # item_ids was a JSON string in SQLite and is jsonb here.
                item_ids = row["item_ids"]
                if isinstance(item_ids, str):
                    item_ids = json.loads(item_ids or "[]")
                conn.execute(
                    """INSERT INTO outfits
                       (id, user_id, occasion, sub_tag, item_ids, avatar_url, status)
                       VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s)
                       ON CONFLICT (id) DO NOTHING""",
                    (
                        row["id"], user_id, row["occasion"], row["sub_tag"],
                        json.dumps(item_ids), row["avatar_url"], row["status"],
                    ),
                )
                counts["outfits"] += 1

        if table_exists("calendar_entries"):
            for row in old.execute("SELECT * FROM calendar_entries").fetchall():
                conn.execute(
                    """INSERT INTO calendar_entries (id, user_id, date, outfit_id)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT (user_id, date) DO NOTHING""",
                    (row["id"], user_id, row["date"], row["outfit_id"]),
                )
                counts["calendar"] += 1

    old.close()
    # Short-lived script: shut the pool down explicitly or psycopg complains
    # about worker threads still running at interpreter exit.
    close_db()

    print(f"Imported into {email}:")
    for name, n in counts.items():
        print(f"  {n:>4} {name}")
    print("\nRows already present were skipped. Old alta.db was not modified.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
