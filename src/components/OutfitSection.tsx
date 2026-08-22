import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, Loader2, Pencil, Send, Shirt, ThumbsDown } from "lucide-react";
import type { Outfit } from "../types";
import { api } from "../api";
import { useCloset } from "../store";
import { useToast } from "./Toast";
import FlatLayCard from "./FlatLayCard";

interface OutfitSectionProps {
  outfit: Outfit;
  onCreateAvatar: (outfit: Outfit) => void;
}

export default function OutfitSection({ outfit, onCreateAvatar }: OutfitSectionProps) {
  const { resolve, reload } = useCloset();
  const navigate = useNavigate();
  const toast = useToast();

  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const items = resolve(outfit.itemIds);

  if (!items.length || dismissed) return null;

  const save = async () => {
    if (!outfit.avatarUrl) {
      toast.show("Render this look first — then you can save it to your avatars.");
      onCreateAvatar(outfit);
      return;
    }
    setBusy("save");
    try {
      await api.saveAvatar(outfit.avatarUrl, outfit.occasion, outfit.id);
      setSaved(true);
      toast.success("Saved to your avatars.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const dismiss = async () => {
    setBusy("dismiss");
    try {
      await api.deleteOutfit(outfit.id);
      setDismissed(true);
      toast.success("Look dismissed. Tap New looks for more.");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const share = async () => {
    const text = `${outfit.occasion} — ${outfit.subTag}, styled on Closei from ${items.length} pieces in my closet.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: outfit.occasion, text, url: window.location.origin });
      } else {
        await navigator.clipboard.writeText(`${text} ${window.location.origin}`);
        toast.success("Look copied to clipboard.");
      }
    } catch {
      /* a cancelled share dialog throws; nothing to report */
    }
  };

  return (
    <section className="animate-rise pt-7">
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
          <button
            type="button"
            onClick={save}
            disabled={busy === "save"}
            aria-label="Save to avatars"
            title="Save to your avatars"
            className="hover:text-neutral-700 disabled:opacity-50"
          >
            {busy === "save" ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <Heart
                size={17}
                strokeWidth={1.6}
                className={saved ? "fill-rose-500 text-rose-500" : ""}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate("/closet")}
            aria-label="Edit pieces"
            title="Edit the pieces in your closet"
            className="hover:text-neutral-700"
          >
            <Pencil size={17} strokeWidth={1.6} />
          </button>

          <button
            type="button"
            onClick={dismiss}
            disabled={busy === "dismiss"}
            aria-label="Not for me"
            title="Dismiss this look"
            className="hover:text-neutral-700 disabled:opacity-50"
          >
            {busy === "dismiss" ? (
              <Loader2 size={17} className="animate-spin" />
            ) : (
              <ThumbsDown size={17} strokeWidth={1.6} />
            )}
          </button>

          <button
            type="button"
            onClick={share}
            aria-label="Share"
            title="Share this look"
            className="hover:text-neutral-700"
          >
            <Send size={17} strokeWidth={1.6} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => onCreateAvatar(outfit)}
          className="rounded-full bg-neutral-900 px-4 py-1.5 text-[13px] text-white hover:bg-neutral-800"
        >
          {outfit.avatarUrl ? "View avatar" : "Create avatar"}
        </button>
      </div>

      <div className="flex items-center justify-between pt-3 text-[12px] text-neutral-400">
        <span className="flex items-center gap-1.5">
          <Shirt size={14} strokeWidth={1.6} />
          {items.length} piece{items.length === 1 ? "" : "s"} from your closet
        </span>
      </div>
    </section>
  );
}
