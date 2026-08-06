import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Check, RefreshCw, Trash2, UserRound, Loader2 } from "lucide-react";
import type { Outfit } from "../types";
import { api } from "../api";
import { useCloset } from "../store";
import AvatarView from "./AvatarView";

interface AvatarModalProps {
  outfit: Outfit;
  onClose: () => void;
}

export default function AvatarModal({ outfit, onClose }: AvatarModalProps) {
  const { resolve, replaceOutfit } = useCloset();
  const [current, setCurrent] = useState(outfit);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);

  const items = resolve(current.itemIds);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const updated = await api.generateAvatar(current.id);
      setCurrent(updated);
      replaceOutfit(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [current.id, replaceOutfit]);

  // Render on open only if this look has never been generated.
  useEffect(() => {
    if (!outfit.avatarUrl) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const planToday = async () => {
    setPlanning(true);
    try {
      await api.planDay(new Date().toISOString().slice(0, 10), current.id);
    } finally {
      setPlanning(false);
    }
  };

  const needsBodyPhoto = error?.toLowerCase().includes("full-body photo");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col px-5 pb-6">
        <header className="flex items-center justify-between pt-5">
          <button type="button" onClick={onClose} aria-label="Back" className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50">
            <ChevronLeft size={17} strokeWidth={1.8} />
          </button>
          <h2 className="text-[15px] text-neutral-900">{current.occasion}</h2>
          <button type="button" onClick={onClose} className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3.5 py-1.5 text-[13px] text-neutral-800 hover:bg-neutral-50">
            <Check size={14} strokeWidth={2} /> Save
          </button>
        </header>

        <div className="relative mt-5 flex flex-1 items-center justify-center overflow-hidden rounded-2xl bg-[#fafafa]">
          {generating ? (
            <div className="flex flex-col items-center gap-2 text-neutral-400">
              <Loader2 size={26} className="animate-spin" strokeWidth={1.6} />
              <span className="text-[13px]">Styling your avatar…</span>
              <span className="text-[11px] text-neutral-300">this takes a few seconds</span>
            </div>
          ) : error ? (
            <div className="max-w-sm px-6 text-center">
              <p className="text-[13px] text-rose-600">{error}</p>
              {needsBodyPhoto && (
                <Link to="/profile" onClick={onClose} className="mt-3 inline-block rounded-full bg-neutral-900 px-4 py-2 text-[13px] text-white hover:bg-neutral-800">
                  Upload a body photo
                </Link>
              )}
            </div>
          ) : (
            <AvatarView outfit={current} items={items} className="h-full max-h-[62vh] w-auto py-6" />
          )}

          <div className="absolute bottom-4 left-4 flex gap-2">
            <Link to="/profile" onClick={onClose} aria-label="Change body reference" className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50">
              <UserRound size={15} strokeWidth={1.7} />
            </Link>
            <button type="button" onClick={onClose} aria-label="Discard" className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50">
              <Trash2 size={15} strokeWidth={1.7} />
            </button>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-[13px] text-white shadow-sm transition hover:bg-neutral-800 disabled:opacity-50"
          >
            <RefreshCw size={14} strokeWidth={1.8} className={generating ? "animate-spin" : ""} />
            {current.avatarUrl ? "Regenerate" : "Generate"}
          </button>
        </div>

        <button
          type="button"
          onClick={planToday}
          disabled={planning}
          className="mt-4 flex items-center gap-2 text-[13px] text-neutral-500 hover:text-neutral-800 disabled:opacity-50"
        >
          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border border-neutral-400" />
          {planning ? "Adding…" : "Show on calendar (today)"}
        </button>
      </div>
    </div>
  );
}
