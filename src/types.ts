export type ClosetCategory =
  | "top"
  | "bottom"
  | "dress"
  | "outerwear"
  | "shoes"
  | "bag"
  | "accessory"
  | "jewelry"
  | "sunglasses"
  | "watch";

export const CATEGORIES: ClosetCategory[] = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "bag",
  "accessory",
  "jewelry",
  "sunglasses",
  "watch",
];

export interface ClosetItem {
  id: string;
  brand: string;
  description: string;
  category: ClosetCategory;
  color: string;
  isWishlist: boolean;
  imageUrl: string | null;
  cutoutUrl: string | null;
  photos: string[];
}

export interface Outfit {
  id: string;
  occasion: string;
  subTag: string;
  itemIds: string[];
  avatarUrl: string | null;
  status: string;
}

export interface CalendarEntry {
  date: string; // yyyy-MM-dd
  outfitId: string;
}

export interface AvatarReference {
  id: string;
  url: string;
  angle: "front" | "back" | "side";
}

export interface AnalysisResult {
  category: ClosetCategory;
  brand: string;
  description: string;
  color: string;
}

/** Prefer the AI cutout, fall back to the original upload. */
export function itemImage(item: ClosetItem): string | null {
  return item.cutoutUrl ?? item.imageUrl;
}
