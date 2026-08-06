import type { ClosetCategory, ClosetItem } from "../types";
import ItemImage from "./ItemImage";

const GARMENTS: ClosetCategory[] = ["outerwear", "dress", "top", "bottom", "shoes"];

interface Placed {
  item: ClosetItem;
  left: number;
  top: number;
  size: number;
}

/**
 * Splits the look into a garment column and an accessory grid, the way the
 * reference flat-lays read. Deterministic — the same outfit always lays out the
 * same way. When a generated avatar is shown alongside, both columns shift left
 * to give it the right-hand third of the card.
 */
function layout(items: ClosetItem[], withAvatar: boolean): Placed[] {
  const order = (c: ClosetCategory) => GARMENTS.indexOf(c);
  const garments = items
    .filter((i) => GARMENTS.includes(i.category))
    .sort((a, b) => order(a.category) - order(b.category));
  const accessories = items.filter((i) => !GARMENTS.includes(i.category));

  const garmentLeft = withAvatar ? 5 : 13;
  const accessoryLeft = withAvatar ? 30 : 54;

  // Sizes are % of card width; each tile is square, so 15% wide is ~30% of a
  // 2:1 card's height — which is what keeps three garments from colliding.
  // Shorter looks sit tighter so a two-piece outfit doesn't leave a hole.
  const [from, to] = garments.length > 2 ? [3, 67] : [8, 55];
  const garmentPlaces: Placed[] = garments.map((item, i) => ({
    item,
    left: garmentLeft + (i % 2) * 4,
    top: garments.length === 1 ? 32 : from + ((to - from) / (garments.length - 1)) * i,
    size: 15,
  }));

  const accessoryPlaces: Placed[] = accessories.map((item, i) => ({
    item,
    left: accessoryLeft + (i % 2) * 13,
    top: 10 + Math.floor(i / 2) * 28,
    size: 11,
  }));

  return [...garmentPlaces, ...accessoryPlaces];
}

interface FlatLayCardProps {
  items: ClosetItem[];
  avatarUrl?: string | null;
  occasion?: string;
  onAvatarClick?: () => void;
  className?: string;
}

export default function FlatLayCard({
  items,
  avatarUrl,
  occasion,
  onAvatarClick,
  className = "",
}: FlatLayCardProps) {
  const placed = layout(items, Boolean(avatarUrl));

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl bg-[#f4f4f5] ${className}`}
      style={{ aspectRatio: "2 / 1" }}
    >
      {placed.map(({ item, left, top, size }) => (
        <div
          key={item.id}
          className="absolute"
          style={{ left: `${left}%`, top: `${top}%`, width: `${size}%`, aspectRatio: "1 / 1" }}
          title={`${item.brand} — ${item.description}`}
        >
          <ItemImage item={item} className="h-full w-full" />
        </div>
      ))}

      {avatarUrl && (
        <button
          type="button"
          onClick={onAvatarClick}
          aria-label={occasion ? `View your ${occasion} avatar` : "View your avatar"}
          className="absolute inset-y-3 right-4 cursor-pointer overflow-hidden rounded-xl bg-white transition hover:opacity-95"
          style={{ aspectRatio: "3 / 4" }}
        >
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        </button>
      )}
    </div>
  );
}
