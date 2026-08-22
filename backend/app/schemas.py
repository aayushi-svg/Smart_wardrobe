from datetime import date
from typing import Any

from pydantic import BaseModel, EmailStr, Field


# --------------------------------------------------------------------------
# Users / auth
# --------------------------------------------------------------------------

class User(BaseModel):
    id: str
    email: str
    createdAt: str | None = None
    displayName: str = ""
    username: str | None = None
    photoUrl: str | None = None
    birthdate: str | None = None
    gender: str = ""
    heightCm: int | None = None
    bodyType: str = ""
    city: str = ""
    bio: str = ""
    styleTags: list[str] = []
    sizes: dict[str, str] = {}
    onboardingStep: int = 0
    onboarded: bool = False


def user_public(row: dict[str, Any]) -> User:
    """Maps a users+profiles join row onto the shape the client expects."""
    birthdate = row.get("birthdate")
    created = row.get("created_at")
    return User(
        id=row["id"],
        email=row["email"],
        createdAt=created.isoformat() if created is not None else None,
        displayName=row.get("display_name") or "",
        username=row.get("username"),
        photoUrl=row.get("photo_url"),
        birthdate=birthdate.isoformat() if isinstance(birthdate, date) else None,
        gender=row.get("gender") or "",
        heightCm=row.get("height_cm"),
        bodyType=row.get("body_type") or "",
        city=row.get("city") or "",
        bio=row.get("bio") or "",
        styleTags=list(row.get("style_tags") or []),
        sizes=dict(row.get("sizes") or {}),
        onboardingStep=row.get("onboarding_step") or 0,
        onboarded=row.get("onboarded_at") is not None,
    )


class Credentials(BaseModel):
    email: EmailStr
    password: str
    displayName: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLogin(BaseModel):
    credential: str


class PasswordChange(BaseModel):
    currentPassword: str
    newPassword: str


class ProfileUpdate(BaseModel):
    displayName: str | None = None
    username: str | None = None
    birthdate: str | None = None
    gender: str | None = None
    heightCm: int | None = None
    bodyType: str | None = None
    city: str | None = None
    bio: str | None = None
    styleTags: list[str] | None = None
    sizes: dict[str, str] | None = None
    onboardingStep: int | None = None


class AuthConfig(BaseModel):
    googleEnabled: bool
    googleClientId: str | None = None


# --------------------------------------------------------------------------
# Closet
# --------------------------------------------------------------------------

class ClosetItem(BaseModel):
    id: str
    category: str
    brand: str
    description: str
    color: str
    imageUrl: str | None = None
    cutoutUrl: str | None = None
    isWishlist: bool = False
    photos: list[str] = []


class ItemUpdate(BaseModel):
    category: str | None = None
    brand: str | None = None
    description: str | None = None
    color: str | None = None
    isWishlist: bool | None = None


class AvatarReference(BaseModel):
    id: str
    url: str
    angle: str


class Outfit(BaseModel):
    id: str
    occasion: str
    subTag: str
    itemIds: list[str]
    avatarUrl: str | None = None
    status: str = "suggested"


class AnalysisResult(BaseModel):
    category: str
    brand: str
    description: str
    color: str


# --------------------------------------------------------------------------
# Calendar
# --------------------------------------------------------------------------

class CalendarEntry(BaseModel):
    date: str
    outfitId: str
    note: str = ""


class PlanRequest(BaseModel):
    date: str
    outfitId: str
    note: str = ""


class CalendarSettings(BaseModel):
    weekStartsOn: int = Field(0, ge=0, le=1)
    cardSize: str = "large"
    showWeather: bool = True
    showStreak: bool = True
    showItemDots: bool = True
    highlightToday: bool = True


# --------------------------------------------------------------------------
# Saved avatars
# --------------------------------------------------------------------------

class SavedAvatar(BaseModel):
    id: str
    url: str
    title: str = ""
    outfitId: str | None = None
    createdAt: str


class SaveAvatarRequest(BaseModel):
    url: str
    title: str = ""
    outfitId: str | None = None


class RenameAvatarRequest(BaseModel):
    title: str = ""


# --------------------------------------------------------------------------
# Chat
# --------------------------------------------------------------------------

class ChatThread(BaseModel):
    id: str
    title: str
    createdAt: str
    updatedAt: str


class ChatMessage(BaseModel):
    id: str
    role: str
    content: str
    createdAt: str


class ChatThreadDetail(ChatThread):
    messages: list[ChatMessage] = []


class SendMessage(BaseModel):
    threadId: str | None = None
    message: str
