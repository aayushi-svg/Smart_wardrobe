"""Neon Postgres access.

One process-wide pool; `with connect() as conn:` hands out a connection and
commits on clean exit, rolls back on exception. Placeholders are `%s`.
"""

from contextlib import contextmanager

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import DATABASE_URL

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    google_sub    TEXT UNIQUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS profiles (
    user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name    TEXT NOT NULL DEFAULT '',
    username        TEXT UNIQUE,
    photo_url       TEXT,
    birthdate       DATE,
    gender          TEXT NOT NULL DEFAULT '',
    height_cm       INTEGER,
    body_type       TEXT NOT NULL DEFAULT '',
    city            TEXT NOT NULL DEFAULT '',
    bio             TEXT NOT NULL DEFAULT '',
    style_tags      JSONB NOT NULL DEFAULT '[]'::jsonb,
    sizes           JSONB NOT NULL DEFAULT '{}'::jsonb,
    onboarding_step INTEGER NOT NULL DEFAULT 0,
    onboarded_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS calendar_settings (
    user_id         TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    week_starts_on  INTEGER NOT NULL DEFAULT 0,   -- 0 = Sunday, 1 = Monday
    card_size       TEXT NOT NULL DEFAULT 'large', -- compact | medium | large
    show_weather    BOOLEAN NOT NULL DEFAULT TRUE,
    show_streak     BOOLEAN NOT NULL DEFAULT TRUE,
    show_item_dots  BOOLEAN NOT NULL DEFAULT TRUE,
    highlight_today BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS closet_items (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category    TEXT NOT NULL,
    brand       TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    color       TEXT NOT NULL DEFAULT '#cccccc',
    image_url   TEXT,
    cutout_url  TEXT,
    is_wishlist BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS item_photos (
    id       TEXT PRIMARY KEY,
    item_id  TEXT NOT NULL REFERENCES closet_items(id) ON DELETE CASCADE,
    url      TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS avatar_references (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    angle      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outfits (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    occasion   TEXT NOT NULL,
    sub_tag    TEXT NOT NULL DEFAULT '',
    item_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
    avatar_url TEXT,
    status     TEXT NOT NULL DEFAULT 'suggested',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS calendar_entries (
    id        TEXT PRIMARY KEY,
    user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date      DATE NOT NULL,
    outfit_id TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
    note      TEXT NOT NULL DEFAULT '',
    UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS saved_avatars (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    url        TEXT NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    outfit_id  TEXT REFERENCES outfits(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_threads (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL DEFAULT 'New chat',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id         TEXT PRIMARY KEY,
    thread_id  TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    role       TEXT NOT NULL,           -- 'user' | 'assistant'
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_items_user     ON closet_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_item    ON item_photos(item_id, position);
CREATE INDEX IF NOT EXISTS idx_refs_user      ON avatar_references(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_outfits_user   ON outfits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cal_user_date  ON calendar_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_saved_user     ON saved_avatars(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_user   ON chat_threads(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON chat_messages(thread_id, created_at);
"""

_pool: ConnectionPool | None = None


def _require_dsn() -> str:
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy backend/.env.example to backend/.env and paste "
            "your Neon connection string."
        )
    return DATABASE_URL


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        # Neon idles connections aggressively; a small pool that recycles often
        # avoids handing out sockets the server has already dropped.
        _pool = ConnectionPool(
            _require_dsn(),
            min_size=1,
            max_size=8,
            max_idle=120,
            kwargs={"row_factory": dict_row},
            open=True,
        )
    return _pool


@contextmanager
def connect():
    with pool().connection() as conn:
        yield conn


def init_db() -> None:
    with connect() as conn:
        conn.execute(SCHEMA)
        # A row left in 'generating' is a render whose process died mid-call.
        # Nothing is still working on it, so hand it back to the feed.
        conn.execute("UPDATE outfits SET status = 'suggested' WHERE status = 'generating'")


def close_db() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
