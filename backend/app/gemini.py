"""Gemini calls: item auto-tagging, background cutout, and virtual try-on.

API surface verified against ai.google.dev/gemini-api/docs (Aug 2026):
  - image generation goes through client.interactions.create(...)
    and returns base64 in interaction.output_image.data
  - text/vision goes through client.models.generate_content(...)
"""

import base64
import json
import traceback
from functools import lru_cache
from typing import Any

from google import genai
from google.genai import types
from pydantic import BaseModel

from .config import GEMINI_API_KEY, IMAGE_MODEL, TEXT_MODEL

CATEGORIES = [
    "top", "bottom", "dress", "outerwear", "shoes",
    "bag", "accessory", "jewelry", "sunglasses", "watch",
]


class GeminiNotConfigured(RuntimeError):
    pass


# Gemini's image models refuse to generate or edit pictures of real,
# identifiable people — photos of public figures are refused hardest. The API
# reports this as a 400 with a block_reason rather than a distinct error type,
# so the reason has to be read out of the message text.
BLOCK_MARKERS = (
    "block_reason",
    "prohibited_content",
    "blocked",
    "safety",
    "policy",
)

BLOCKED_MESSAGE = (
    "Gemini refused this image on policy grounds. Its image models will not "
    "generate or edit pictures of real, identifiable people, and photos of "
    "public figures are always rejected. Use a photo of the garment itself — "
    "laid flat, on a hanger, or a shop product shot. Photos of people belong "
    "under Profile → Body refs, which is the one place they are expected."
)


def explain(exc: Exception) -> str:
    """A message worth showing a user, instead of raw provider JSON."""
    text = str(exc)
    lowered = text.lower()
    if any(marker in lowered for marker in BLOCK_MARKERS):
        return BLOCKED_MESSAGE
    if "resource_exhausted" in lowered or "429" in text or "quota" in lowered:
        return "Gemini is rate-limited or out of quota right now. Try again shortly."
    if "deadline" in lowered or "timeout" in lowered:
        return "Gemini took too long to respond. Try again."
    return text


@lru_cache(maxsize=1)
def _cached_client() -> genai.Client:
    return genai.Client(api_key=GEMINI_API_KEY)


def _client() -> genai.Client:
    """One shared client for the process.

    Building a fresh Client per call closes the underlying httpx transport when
    the previous instance is collected, which surfaces as
    "Cannot send a request, as the client has been closed".
    """
    if not GEMINI_API_KEY:
        raise GeminiNotConfigured(
            "GEMINI_API_KEY is not set. Add it to backend/.env and restart the server."
        )
    return _cached_client()


def _image_part(data: bytes, mime_type: str) -> dict[str, Any]:
    return {
        "type": "image",
        "data": base64.b64encode(data).decode("utf-8"),
        "mime_type": mime_type,
    }


def _output_image(interaction: Any) -> bytes:
    image = getattr(interaction, "output_image", None)
    if image is None or not getattr(image, "data", None):
        raise RuntimeError("Gemini returned no image. Try rephrasing or use a clearer photo.")
    return base64.b64decode(image.data)


# --------------------------------------------------------------------------
# 1. Auto-tagging: photo -> brand / category / description / colour
# --------------------------------------------------------------------------

ANALYZE_PROMPT = f"""You are cataloguing a single clothing or accessory item for a personal closet app.
Look at the photo and return JSON with exactly these keys:

- "category": one of {CATEGORIES}
- "brand": the brand if a logo or label is clearly visible, otherwise ""
- "description": a short retail-style description, 2-5 words, e.g. "Black Snake Print Corset Top"
- "color": the dominant colour of the item as a hex code, e.g. "#1c1c1c"

Describe only the item itself, not the background or the person wearing it."""


class ItemAnalysis(BaseModel):
    category: str
    brand: str
    description: str
    color: str


def analyze_item(image_bytes: bytes, mime_type: str) -> dict[str, str]:
    """Raises on failure rather than returning blanks — callers must not
    overwrite good data with empty strings when the model can't be reached."""
    response = _client().models.generate_content(
        model=TEXT_MODEL,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            ANALYZE_PROMPT,
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ItemAnalysis,
        ),
    )

    data: dict[str, Any] | None = None
    parsed = getattr(response, "parsed", None)
    if isinstance(parsed, ItemAnalysis):
        data = parsed.model_dump()
    elif response.text:
        # Some responses come back as raw text; tolerate ```json fences.
        text = response.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
        data = json.loads(text)

    if not data:
        raise RuntimeError("Gemini returned no readable analysis for this photo.")

    category = str(data.get("category", "")).lower()
    return {
        "category": category if category in CATEGORIES else "top",
        "brand": str(data.get("brand") or "")[:80],
        "description": str(data.get("description") or "")[:120],
        "color": str(data.get("color") or "#cccccc")[:9],
    }


# --------------------------------------------------------------------------
# 2. Cutout: photo -> item isolated on a plain background
# --------------------------------------------------------------------------

CUTOUT_PROMPT = """Isolate the single clothing or accessory item in this photo.
Place it flat, centred, and upright on a plain solid white background, as in an
e-commerce product listing. Remove the person, hanger, and all background clutter.
Keep the item's true colour, pattern, texture and shape exactly as photographed.
Do not add any text, watermark, shadow or decoration."""


def cutout_item(image_bytes: bytes, mime_type: str) -> bytes:
    interaction = _client().interactions.create(
        model=IMAGE_MODEL,
        input=[
            {"type": "text", "text": CUTOUT_PROMPT},
            _image_part(image_bytes, mime_type),
        ],
        response_format={"type": "image", "aspect_ratio": "1:1", "image_size": "1K"},
    )
    return _output_image(interaction)


# --------------------------------------------------------------------------
# 3. Virtual try-on: body reference + garment photos -> full-body render
# --------------------------------------------------------------------------


# Character-consistency reference images are capped at 4 for the Flash image
# models; sending more identity shots than that is wasted budget.
MAX_IDENTITY_IMAGES = 4


def generate_tryon(
    identity_images: list[tuple[bytes, str]],
    garments: list[tuple[bytes, str, str]],
    occasion: str = "",
) -> bytes:
    """Render the person from `identity_images` wearing every garment.

    `identity_images` is (bytes, mime_type), face shots first - a close portrait
    carries far more identity signal than a face that is 40px tall in a
    full-body shot. `garments` is (bytes, mime_type, description).

    The prompt is deliberately framed as an *edit* of a real person rather than
    a generation, which is what stops the model inventing a new model's face.
    """
    if not identity_images:
        raise ValueError("At least one identity reference image is required")

    identity_images = identity_images[:MAX_IDENTITY_IMAGES]
    count = len(identity_images)
    span = "Image 1" if count == 1 else f"Images 1-{count}"
    listed = "\n".join(f"- {desc}" for _, _, desc in garments if desc)
    occasion_line = f"\nThe look is for: {occasion}." if occasion else ""

    prompt = f"""Virtual try-on: photograph a specific real person wearing specific garments.

IMAGE ROLES
- {span}: photographs of the SAME real person. This is the person you must depict.
- Every image after that: an individual clothing item to put on them.

IDENTITY - this is the single most important requirement.
Ensure the person's face and features remain completely unchanged. Reproduce their exact
face shape, eyes, nose, mouth, eyebrows, jawline, hairline, hair colour and texture, skin
tone and body proportions from the reference photographs. Do not beautify, slim, smooth,
retouch, age, de-age or restyle them, and do not replace them with a professional model or
an idealised version of them. Someone who knows this person must recognise them instantly.

Keep their hair exactly as it is in the reference photographs - same length, same parting,
same styling. Do not tie it up, let it down, cut it or restyle it.

CLOTHING
Change only the clothing. Replace whatever they are currently wearing with exactly these
items, and nothing else:
{listed}
Match each garment's colour, pattern, cut, length and proportions to its reference image.
Do not add, remove or substitute any item. In particular, do not invent jewellery, earrings,
watches, bags, belts, hats, glasses or any other accessory that is not in the list above -
if it is not listed, it must not appear.{occasion_line}

FRAMING
Full body from head to shoes, standing naturally, facing the camera. Plain light neutral
studio background, soft even lighting. No text, watermark or logo overlay."""

    parts: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    for data, mime in identity_images:
        parts.append(_image_part(data, mime))
    # Gemini accepts up to 14 images per call, identity shots included.
    for data, mime, _ in garments[: 14 - count]:
        parts.append(_image_part(data, mime))

    interaction = _client().interactions.create(
        model=IMAGE_MODEL,
        input=parts,
        response_format={"type": "image", "aspect_ratio": "3:4", "image_size": "2K"},
    )
    return _output_image(interaction)


# --------------------------------------------------------------------------
# 4. Stylist chat
# --------------------------------------------------------------------------

CHAT_SYSTEM = """You are Closei, a warm, decisive personal stylist inside a closet app.

You can see the user's profile and their full wardrobe, listed below. Ground every
suggestion in items they actually own, and name them the way the list does so they can
find them. If a look needs something they do not own, say so plainly and describe the
gap in one line rather than pretending it is in the closet.

Style of reply: conversational and short. Two or three sentences for a simple question.
For an outfit, give the pieces as a short list, then one sentence on why it works.
No markdown headers, no preamble, no "As an AI". Never invent items, brands or colours
that are not in the wardrobe list."""


def _wardrobe_brief(profile: dict[str, Any], items: list[dict[str, Any]]) -> str:
    """Compact, token-cheap context block appended to the system instruction."""
    lines = ["USER"]
    for label, key in (
        ("Name", "display_name"), ("Gender", "gender"), ("Body type", "body_type"),
        ("City", "city"), ("Height", "height_cm"),
    ):
        value = profile.get(key)
        if value:
            lines.append(f"- {label}: {value}{'cm' if key == 'height_cm' else ''}")
    if profile.get("style_tags"):
        lines.append(f"- Style they like: {', '.join(profile['style_tags'])}")
    if profile.get("sizes"):
        sizes = ", ".join(f"{k} {v}" for k, v in profile["sizes"].items())
        lines.append(f"- Sizes: {sizes}")

    lines.append("")
    lines.append(f"WARDROBE ({len(items)} items)" if items else "WARDROBE (empty)")
    for item in items:
        label = " ".join(x for x in [item.get("brand"), item.get("description")] if x)
        flag = " [wishlist, not owned yet]" if item.get("is_wishlist") else ""
        lines.append(f"- {item['category']}: {label or 'unlabelled'} ({item['color']}){flag}")
    return "\n".join(lines)


def chat_stream(
    profile: dict[str, Any],
    items: list[dict[str, Any]],
    history: list[dict[str, str]],
    message: str,
):
    """Yields reply text chunks. `history` is [{'role': 'user'|'assistant', 'content': ...}]."""
    contents = [
        types.Content(
            role="model" if turn["role"] == "assistant" else "user",
            parts=[types.Part.from_text(text=turn["content"])],
        )
        for turn in history
    ]
    contents.append(types.Content(role="user", parts=[types.Part.from_text(text=message)]))

    stream = _client().models.generate_content_stream(
        model=TEXT_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=f"{CHAT_SYSTEM}\n\n{_wardrobe_brief(profile, items)}",
            temperature=0.8,
            max_output_tokens=900,
        ),
    )
    for chunk in stream:
        if chunk.text:
            yield chunk.text


def title_for(message: str) -> str:
    """Names a new thread. Falls back to a trimmed first message on any failure,
    so a thread is never left with a blank title."""
    fallback = message.strip().split("\n")[0][:48] or "New chat"
    try:
        response = _client().models.generate_content(
            model=TEXT_MODEL,
            contents=(
                "Write a 2-4 word title for a chat that starts with this message. "
                f"Reply with the title only, no quotes.\n\n{message[:400]}"
            ),
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=64,
                # Naming a thread needs no reasoning, and at the default level
                # thinking eats the whole output allowance and returns "".
                # This model rejects thinking_budget=0 outright — the Gemini 3
                # family takes thinking_level instead.
                thinking_config=types.ThinkingConfig(thinking_level="minimal"),
            ),
        )
        return (response.text or "").strip().strip('"')[:60] or fallback
    except Exception:
        return fallback


def health() -> dict[str, Any]:
    """Cheap round-trip so the key can be verified without burning an image call."""
    if not GEMINI_API_KEY:
        return {"configured": False, "error": "GEMINI_API_KEY is not set"}
    try:
        response = _client().models.generate_content(
            model=TEXT_MODEL, contents="Reply with the single word: ok"
        )
        return {
            "configured": True,
            "text_model": TEXT_MODEL,
            "image_model": IMAGE_MODEL,
            "reply": (response.text or "").strip()[:40],
        }
    except Exception as exc:  # surfaced to the user so a bad key is obvious
        traceback.print_exc()
        return {"configured": True, "error": f"{type(exc).__name__}: {exc}"}
