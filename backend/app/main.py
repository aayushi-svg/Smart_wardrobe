from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import gemini
from .config import CORS_ORIGINS, UPLOAD_DIR
from .db import close_db, init_db
from .routers import auth, avatars, calendar, chat, items, me, outfits


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield
    close_db()


app = FastAPI(title="Closei closet API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    # The session cookie only rides along on cross-origin calls with this on.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(items.router)
app.include_router(avatars.router)
app.include_router(outfits.router)
app.include_router(calendar.router)
app.include_router(chat.router)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/health/gemini")
def gemini_health():
    """Confirms the API key works without spending an image generation call."""
    return gemini.health()
