import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarPlus,
  Check,
  ChevronLeft,
  Download,
  Heart,
  Loader2,
  RefreshCw,
  UserRound,
} from "lucide-react";
import type { Outfit } from "../types";
import { api, downloadImage } from "../api";
import { useCloset } from "../store";
import { useToast } from "./Toast";
import AvatarView from "./AvatarView";

interface AvatarModalProps {
  outfit: Outfit;
  onClose: () => void;
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function AvatarModal({ outfit, onClose }: AvatarModalProps) {
  const { resolve, replaceOutfit } = useCloset();
  const toast = useToast();

  const [current, setCurrent] = useState(outfit);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [planDate, setPlanDate] = useState(todayIso());

  const items = resolve(current.itemIds);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const updated = await api.generateAvatar(current.id);
      setCurrent(updated);
      replaceOutfit(updated);
      // A regenerated render is a different image, so it has not been saved yet.
      setSaved(false);
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
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const save = async () => {
    if (!current.avatarUrl) return;
    setBusy("save");
    try {
      await api.saveAvatar(current.avatarUrl, current.occasion, current.id);
      setSaved(true);
      toast.success("Saved to your avatars.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    if (!current.avatarUrl) return;
    setBusy("download");
    try {
      const stem = current.occasion.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      await downloadImage(current.avatarUrl, `closei-${stem || "look"}.png`);
      toast.success("Downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const plan = async () => {
    setBusy("plan");
    try {
      await api.planDay(planDate, current.id);
      toast.success(`Planned for ${planDate}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const needsBodyPhoto = error?.toLowerCase().includes("photo of yourself");

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-white">
      <div className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col overflow-y-auto px-5 pb-6">
        <header className="flex items-center justify-between pt-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
          >
            <ChevronLeft size={17} strokeWidth={1.8} />
          </button>

          <div className="text-center">
            <h2 className="text-[15px] text-neutral-900">{current.occasion}</h2>
            <p className="text-[11px] text-neutral-400">{current.subTag}</p>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={!current.avatarUrl || busy === "save" || saved}
            className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3.5 py-2 text-[13px] text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
          >
            {busy === "save" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saved ? (
              <Check size={14} strokeWidth={2.2} />
            ) : (
              <Heart size={14} strokeWidth={1.8} />
            )}
            {saved ? "Saved" : "Save"}
          </button>
        </header>

        <div className="relative mt-5 flex min-h-[50vh] flex-1 items-center justify-center overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-100">
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
                <Link
                  to="/profile"
                  onClick={onClose}
                  className="mt-3 inline-block rounded-full bg-neutral-900 px-4 py-2 text-[13px] text-white hover:bg-neutral-800"
                >
                  Upload a body photo
                </Link>
              )}
              <button
                type="button"
                onClick={generate}
                className="mt-3 block w-full text-[12px] text-neutral-400 hover:text-neutral-700"
              >
                Try again
              </button>
            </div>
          ) : (
            <AvatarView
              outfit={current}
              items={items}
              className="animate-pop h-full max-h-[62vh] w-auto py-6"
            />
          )}

          <div className="absolute bottom-4 left-4 flex gap-2">
            <Link
              to="/profile"
              onClick={onClose}
              aria-label="Change body reference"
              title="Change body reference"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            >
              <UserRound size={15} strokeWidth={1.7} />
            </Link>
            <button
              type="button"
              onClick={download}
              disabled={!current.avatarUrl || busy === "download"}
              aria-label="Download avatar"
              title="Download"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 disabled:opacity-40"
            >
              {busy === "download" ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Download size={15} strokeWidth={1.7} />
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2.5 text-[13px] text-white shadow-sm hover:bg-neutral-800 disabled:opacity-50"
          >
            <RefreshCw size={14} strokeWidth={1.8} className={generating ? "animate-spin" : ""} />
            {current.avatarUrl ? "Regenerate" : "Generate"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-2 text-[13px] text-neutral-600 focus-within:border-neutral-900">
            <CalendarPlus size={15} strokeWidth={1.7} className="shrink-0 text-neutral-400" />
            <input
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
              className="bg-transparent text-[13px] text-neutral-800 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={plan}
            disabled={busy === "plan"}
            className="flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2.5 text-[13px] text-neutral-800 hover:bg-neutral-200 disabled:opacity-50"
          >
            {busy === "plan" && <Loader2 size={14} className="animate-spin" />}
            Add to calendar
          </button>

          <span className="ml-auto text-[12px] text-neutral-400">
            {items.length} piece{items.length === 1 ? "" : "s"} from your closet
          </span>
        </div>
      </div>
    </div>
  );
}
