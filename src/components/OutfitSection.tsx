import { useState } from "react";
import { Heart, Pencil, ThumbsDown, Send, Shirt } from "lucide-react";
import type { Outfit } from "../types";
import { useCloset } from "../store";
import FlatLayCard from "./FlatLayCard";

interface OutfitSectionProps {
  outfit: Outfit;
  onCreateAvatar: (outfit: Outfit) => void;
}

export default function OutfitSection({ outfit, onCreateAvatar }: OutfitSectionProps) {
  const { resolve } = useCloset();
  const [liked, setLiked] = useState(false);
  const items = resolve(outfit.itemIds);

  if (!items.length) return null;

  return (
    <section className="pt-7">
      <div className="flex items-baseline justify-between pb-2.5">
        <h3 className="text-[15px] text-neutral-900">{outfit.occasion}</h3>
        <span className="text-[12px] text-neutral-400">{outfit.subTag}</span>
      </div>

      <FlatLayCard
        items={items}
        avatarUrl={outfit.avatarUrl}
        occasion={outfit.occasion}
        onAvatarClick={() => onCreateAvatar(outfit)}
      />

      <div className="flex items-center justify-between pt-3">
        <div className="flex items-center gap-4 text-neutral-400">
          <button type="button" onClick={() => setLiked((v) => !v)} aria-label="Like" className="hover:text-neutral-700">
            <Heart size={17} strokeWidth={1.6} className={liked ? "fill-rose-500 text-rose-500" : ""} />
          </button>
          <button type="button" aria-label="Edit" className="hover:text-neutral-700">
            <Pencil size={17} strokeWidth={1.6} />
          </button>
          <button type="button" aria-label="Not for me" className="hover:text-neutral-700">
            <ThumbsDown size={17} strokeWidth={1.6} />
          </button>
          <button type="button" aria-label="Share" className="hover:text-neutral-700">
            <Send size={17} strokeWidth={1.6} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onCreateAvatar(outfit)}
          className="rounded-full bg-neutral-900 px-4 py-1.5 text-[13px] text-white transition hover:bg-neutral-800"
        >
          {outfit.avatarUrl ? "View Avatar" : "Create Avatar"}
        </button>
      </div>

      <div className="flex items-center justify-between pt-3 text-[12px] text-neutral-400">
        <span className="flex items-center gap-1.5">
          <Shirt size={14} strokeWidth={1.6} />
          {items.length} pieces from your closet
        </span>
      </div>
    </section>
  );
}
