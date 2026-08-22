import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Heart, Loader2, X } from "lucide-react";
import { downloadImage } from "../api";

export interface LightboxImage {
  url: string;
  caption?: string;
  /** Filename stem used for the download; falls back to "closei-image". */
  name?: string;
}

interface Props {
  images: LightboxImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Omit to hide the save button — used where saving makes no sense. */
  onSave?: (image: LightboxImage) => Promise<void> | void;
  saveLabel?: string;
}

/** Full-screen image viewer. Rendered in a portal so it is never clipped by a
 *  parent's overflow, and it traps Escape / arrow keys while open. */
export default function Lightbox({
  images,
  index,
  onIndexChange,
  onClose,
  onSave,
  saveLabel = "Save",
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const image = images[index];
  const many = images.length > 1;

  const step = useCallback(
    (delta: number) => onIndexChange((index + delta + images.length) % images.length),
    [index, images.length, onIndexChange],
  );

  useEffect(() => {
    setSaved(false);
    setError(null);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && many) step(1);
      if (e.key === "ArrowLeft" && many) step(-1);
    };
    window.addEventListener("keydown", onKey);
    // Stops the page behind the overlay scrolling under the user's fingers.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, step, many]);

  if (!image) return null;

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      const stem = (image.name || "closei-image").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
      await downloadImage(image.url, `${stem}.png`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  };

  const save = async () => {
    if (!onSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(image);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-50 flex flex-col bg-white/98 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={image.caption || "Image viewer"}
    >
      <header className="flex shrink-0 items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
        >
          <X size={17} strokeWidth={1.8} />
        </button>

        <span className="truncate px-3 text-[13px] text-neutral-500">
          {image.caption}
          {many && <span className="pl-2 text-neutral-300">{index + 1} / {images.length}</span>}
        </span>

        <div className="flex items-center gap-2">
          {onSave && (
            <button
              type="button"
              onClick={save}
              disabled={saving || saved}
              aria-label={saveLabel}
              className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-2 text-[12px] text-neutral-700 hover:bg-neutral-200 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Heart size={15} strokeWidth={1.8} className={saved ? "fill-neutral-900" : ""} />
              )}
              <span className="hidden sm:inline">{saved ? "Saved" : saveLabel}</span>
            </button>
          )}
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            aria-label="Download image"
            className="flex items-center gap-1.5 rounded-full bg-neutral-900 px-3 py-2 text-[12px] text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {downloading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} strokeWidth={1.8} />
            )}
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </header>

      {error && (
        <p className="animate-fade-in px-5 pb-2 text-center text-[12px] text-rose-600">{error}</p>
      )}

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
        {many && (
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous image"
            className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-700 shadow-md hover:bg-neutral-50"
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
          </button>
        )}

        <img
          key={image.url}
          src={image.url}
          alt={image.caption || "Full size"}
          className="animate-pop max-h-full max-w-full rounded-2xl bg-white object-contain"
        />

        {many && (
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next image"
            className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-700 shadow-md hover:bg-neutral-50"
          >
            <ChevronRight size={20} strokeWidth={1.8} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

