import type { ClosetItem, Outfit } from "../types";
import AvatarSilhouette from "./AvatarSilhouette";

interface AvatarViewProps {
  outfit?: Outfit;
  items: ClosetItem[];
  className?: string;
}

/** The generated try-on photo once it exists, otherwise the croquis stand-in. */
export default function AvatarView({ outfit, items, className = "" }: AvatarViewProps) {
  if (outfit?.avatarUrl) {
    return (
      <img
        src={outfit.avatarUrl}
        alt={`You wearing the ${outfit.occasion} look`}
        loading="lazy"
        className={`object-contain ${className}`}
      />
    );
  }
  return <AvatarSilhouette items={items} className={className} />;
}
