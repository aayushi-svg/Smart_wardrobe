import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { api } from "../api";
import { useCloset } from "../store";
import { CATEGORIES } from "../types";
import type { ClosetCategory } from "../types";

export default function AddItem() {
  const navigate = useNavigate();
  const { reload } = useCloset();
  const fileInput = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [category, setCategory] = useState<ClosetCategory>("top");
  const [brand, setBrand] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#cccccc");
  const [isWishlist, setIsWishlist] = useState(false);
  const [autoCutout, setAutoCutout] = useState(true);

  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Object URLs must be revoked or the blobs leak for the page's lifetime.
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
    setError(null);
  };

  const autoFill = async () => {
    if (!files[0]) return;
    setAnalyzing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.analyzePhoto(files[0]);
      setCategory(result.category);
      if (result.brand) setBrand(result.brand);
      if (result.description) setDescription(result.description);
      if (result.color) setColor(result.color);
      setNotice("Filled in from the photo — edit anything that's off.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    if (!files.length) {
      setError("Add at least one photo.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createItem(files, { category, brand, description, color, isWishlist, autoCutout });
      await reload();
      navigate("/closet");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const field = "w-full rounded-xl border border-neutral-200 px-3 py-2 text-[13px] focus:border-neutral-400 focus:outline-none";

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 pb-28">
      <header className="flex items-center justify-between pt-4 pb-4">
        <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50">
          <ChevronLeft size={17} strokeWidth={1.8} />
        </button>
        <h1 className="text-[15px] text-neutral-900">Add to closet</h1>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-neutral-900 px-4 py-1.5 text-[13px] text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {previews.map((src, i) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-xl bg-[#f4f4f5]">
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
              aria-label="Remove photo"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-neutral-600 hover:text-neutral-900"
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-neutral-300 text-neutral-400 transition hover:border-neutral-400 hover:text-neutral-600"
        >
          <ImagePlus size={20} strokeWidth={1.6} />
          <span className="text-[11px]">Add photo</span>
        </button>
      </div>

      <button
        type="button"
        onClick={autoFill}
        disabled={!files.length || analyzing}
        className="mt-4 flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-[13px] text-neutral-800 transition hover:bg-neutral-50 disabled:opacity-40"
      >
        {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} strokeWidth={1.7} />}
        {analyzing ? "Reading the photo…" : "Auto-fill details from photo"}
      </button>

      {notice && <p className="pt-3 text-[12px] text-emerald-600">{notice}</p>}
      {error && <p className="pt-3 text-[12px] text-rose-600">{error}</p>}

      <div className="grid gap-4 pt-6 sm:grid-cols-2">
        <label className="block">
          <span className="text-[12px] text-neutral-500">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as ClosetCategory)} className={`${field} mt-1 capitalize`}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[12px] text-neutral-500">Brand</span>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Zara" className={`${field} mt-1`} />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-[12px] text-neutral-500">Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Black Snake Print Corset Top" className={`${field} mt-1`} />
        </label>

        <label className="block">
          <span className="text-[12px] text-neutral-500">Colour</span>
          <div className="mt-1 flex items-center gap-2">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-neutral-200" />
            <input value={color} onChange={(e) => setColor(e.target.value)} className={field} />
          </div>
        </label>
      </div>

      <div className="space-y-2 pt-5">
        <label className="flex items-center gap-2 text-[13px] text-neutral-600">
          <input type="checkbox" checked={autoCutout} onChange={(e) => setAutoCutout(e.target.checked)} className="h-3.5 w-3.5 accent-neutral-900" />
          Clean up the photo with AI (cut the item out onto a white background)
        </label>
        <label className="flex items-center gap-2 text-[13px] text-neutral-600">
          <input type="checkbox" checked={isWishlist} onChange={(e) => setIsWishlist(e.target.checked)} className="h-3.5 w-3.5 accent-neutral-900" />
          Save to wishlist instead of closet
        </label>
      </div>
    </div>
  );
}
