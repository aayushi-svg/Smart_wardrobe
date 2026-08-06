import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

DB_PATH = BASE_DIR / "alta.db"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Verified against ai.google.dev/gemini-api/docs (Aug 2026).
IMAGE_MODEL = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3.1-flash-image")
TEXT_MODEL = os.getenv("GEMINI_TEXT_MODEL", "gemini-3.6-flash")

# Single-tenant for now. The schema and API already carry user_id, so adding
# real auth later means replacing this default, not migrating data.
DEMO_USER_ID = "demo-user"
