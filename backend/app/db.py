import sqlite3
from contextlib import contextmanager

from .config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS closet_items (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    category    TEXT NOT NULL,
    brand       TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#cccccc',
    image_url   TEXT,
    cutout_url  TEXT,
    is_wishlist INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item_photos (
    id       TEXT PRIMARY KEY,
    item_id  TEXT NOT NULL REFERENCES closet_items(id) ON DELETE CASCADE,
    url      TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS avatar_references (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    url        TEXT NOT NULL,
    angle      TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS outfits (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    occasion   TEXT NOT NULL,
    sub_tag    TEXT NOT NULL DEFAULT '',
    item_ids   TEXT NOT NULL,
    avatar_url TEXT,
    status     TEXT NOT NULL DEFAULT 'suggested',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calendar_entries (
    id        TEXT PRIMARY KEY,
    user_id   TEXT NOT NULL,
    date      TEXT NOT NULL,
    outfit_id TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
    UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_items_user ON closet_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cal_user_date ON calendar_entries(user_id, date);
"""


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
        # Any 'generating' row is a render the last process died in the middle
        # of; nothing is still working on it, so hand it back to the feed.
        conn.execute("UPDATE outfits SET status = 'suggested' WHERE status = 'generating'")


@contextmanager
def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()
