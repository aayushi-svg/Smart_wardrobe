from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import gemini
from .config import UPLOAD_DIR
from .db import init_db
from .routers import avatars, calendar, items, outfits


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Alta closet API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items.router)
app.include_router(avatars.router)
app.include_router(outfits.router)
app.include_router(calendar.router)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/health/gemini")
def gemini_health():
    """Confirms the API key works without spending an image generation call."""
    return gemini.health()
