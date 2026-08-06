import type { ClosetItem } from "../types";
import { itemImage } from "../types";
import GarmentShape from "./GarmentShape";

interface ItemImageProps {
  item: ClosetItem;
  className?: string;
}

/** Real photo when one exists, otherwise the drawn placeholder. */
export default function ItemImage({ item, className = "" }: ItemImageProps) {
  const src = itemImage(item);

  if (!src) {
    return <GarmentShape category={item.category} color={item.color} className={className} />;
  }

  return (
    <img
      src={src}
      alt={`${item.brand} ${item.description}`.trim() || item.category}
      loading="lazy"
      // Cut-outs come back on solid white rather than transparent; multiply
      // drops the white into the card background and leaves the garment.
      style={{ mixBlendMode: "multiply" }}
      className={`object-contain ${className}`}
    />
  );
}
