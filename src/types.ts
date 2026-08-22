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
  note: string;
}

export interface AvatarReference {
  id: string;
  url: string;
  angle: "face" | "front" | "back" | "side";
}

export interface AnalysisResult {
  category: ClosetCategory;
  brand: string;
  description: string;
  color: string;
}

export interface User {
  id: string;
  email: string;
  createdAt: string | null;
  displayName: string;
  username: string | null;
  photoUrl: string | null;
  birthdate: string | null;
  gender: string;
  heightCm: number | null;
  bodyType: string;
  city: string;
  bio: string;
  styleTags: string[];
  sizes: Record<string, string>;
  onboardingStep: number;
  onboarded: boolean;
}

export type ProfilePatch = Partial<
  Pick<
    User,
    | "displayName"
    | "username"
    | "birthdate"
    | "gender"
    | "heightCm"
    | "bodyType"
    | "city"
    | "bio"
    | "styleTags"
    | "sizes"
    | "onboardingStep"
  >
>;

export interface AuthConfig {
  googleEnabled: boolean;
  googleClientId: string | null;
}

export interface CalendarSettings {
  weekStartsOn: 0 | 1;
  cardSize: "compact" | "medium" | "large";
  showWeather: boolean;
  showStreak: boolean;
  showItemDots: boolean;
  highlightToday: boolean;
}

export interface SavedAvatar {
  id: string;
  url: string;
  title: string;
  outfitId: string | null;
  createdAt: string;
}

export interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatThreadDetail extends ChatThread {
  messages: ChatMessage[];
}

/** Prefer the AI cutout, fall back to the original upload. */
export function itemImage(item: ClosetItem): string | null {
  return item.cutoutUrl ?? item.imageUrl;
}

export const CATEGORY_LABELS: Record<ClosetCategory, string> = {
  top: "Tops",
  bottom: "Bottoms",
  dress: "Dresses",
  outerwear: "Outerwear",
  shoes: "Shoes",
  bag: "Bags",
  accessory: "Accessories",
  jewelry: "Jewelry",
  sunglasses: "Sunglasses",
  watch: "Watches",
};
