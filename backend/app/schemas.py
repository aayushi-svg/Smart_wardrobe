from pydantic import BaseModel


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


class CalendarEntry(BaseModel):
    date: str
    outfitId: str


class PlanRequest(BaseModel):
    date: str
    outfitId: str


class AnalysisResult(BaseModel):
    category: str
    brand: str
    description: str
    color: str
