import os
import secrets
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Neon Postgres. Everything user-scoped lives here; only image bytes stay on disk.
DATABASE_URL = os.getenv("DATABASE_URL", "")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Verified against ai.google.dev/gemini-api/docs (Aug 2026).
IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")
TEXT_MODEL = os.getenv("GEMINI_TEXT_MODEL", "gemini-3.6-flash")

# Sessions are signed JWTs in an httpOnly cookie. A generated fallback keeps dev
# working out of the box, at the cost of logging everyone out on restart — set
# JWT_SECRET in .env for anything you want to survive a reboot.
JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_urlsafe(48)
JWT_ALGORITHM = "HS256"
SESSION_DAYS = int(os.getenv("SESSION_DAYS", "30"))
COOKIE_NAME = "closei_session"
# Vite dev serves over http, so the cookie cannot be Secure locally.
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

# Optional. When set, the login screen offers "Continue with Google" and
# verifies the ID token the browser hands back.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175"
    ).split(",")
    if o.strip()
]
