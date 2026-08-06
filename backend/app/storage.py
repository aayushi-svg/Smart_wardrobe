import uuid
from pathlib import Path

from .config import UPLOAD_DIR

EXT_BY_MIME = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
}


def save_bytes(data: bytes, mime_type: str = "image/png") -> str:
    """Write bytes to the upload dir and return the public URL path."""
    ext = EXT_BY_MIME.get(mime_type.lower(), ".png")
    name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return f"/uploads/{name}"


def read_url(url: str) -> bytes:
    """Read back a file previously stored by save_bytes."""
    return (UPLOAD_DIR / Path(url).name).read_bytes()


def mime_for_url(url: str) -> str:
    ext = Path(url).suffix.lower()
    for mime, e in EXT_BY_MIME.items():
        if e == ext and mime != "image/jpg":
            return mime
    return "image/png"
