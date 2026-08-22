import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, SlidersHorizontal, Trash2, Wand2, X } from "lucide-react";
import { api } from "../api";
import { useCloset } from "../store";
import { useToast } from "../components/Toast";
import ItemImage from "../components/ItemImage";
import TopBar from "../components/TopBar";
import Lightbox from "../components/Lightbox";
import type { LightboxImage } from "../components/Lightbox";
import { CATEGORIES, CATEGORY_LABELS, itemImage } from "../types";
import type { ClosetCategory } from "../types";

type Tab = "closet" | "wishlist";
type Sort = "newest" | "brand" | "category";

export default function Closet() {
  const { items, loading, error, reload, refreshSuggestions } = useCloset();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("closet");
  const [busy, setBusy] = useState<string | null>(null);
  const [enriching, setEnriching] = useState<{ done: number; total: number } | null>(null);
  const [category, setCategory] = useState<ClosetCategory | null>(null);
  const [sort, setSort] = useState<Sort>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);

  const visible = useMemo(() => {
    const list = items.filter((i) => {
      if (tab === "wishlist" ? !i.isWishlist : i.isWishlist) return false;
      return !category || i.category === category;
    });
    if (sort === "brand") {
      return [...list].sort((a, b) => (a.brand || "~").localeCompare(b.brand || "~"));
    }
    if (sort === "category") {
      return [...list].sort((a, b) => a.category.localeCompare(b.category));
    }
    return list; // the API already returns newest first
  }, [items, tab, category, sort]);

  const incomplete = items.filter((i) => !i.cutoutUrl || (!i.brand && !i.description));

  const gallery = useMemo<LightboxImage[]>(
    () =>
      visible
        .map((item): LightboxImage | null => {
          const url = itemImage(item);
          return url
            ? {
                url,
                caption: `${item.brand} ${item.description}`.trim() || item.category,
                name: `closei-${item.category}`,
              }
            : null;
        })
        .filter((x): x is LightboxImage => x !== null),
    [visible],
  );

  const enrichAll = async () => {
    setEnriching({ done: 0, total: incomplete.length });
    try {
      for (let i = 0; i < incomplete.length; i++) {
        await api.enrichItem(incomplete[i].id);
        setEnriching({ done: i + 1, total: incomplete.length });
      }
      // Enrichment can re-categorise items, so existing looks may now be
      // nonsense (two bottoms, no top). Rebuild them against the new data.
      await refreshSuggestions();
      toast.success("Closet completed with AI.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      await reload();
    } finally {
      setEnriching(null);
    }
  };

  const cleanUp = async (id: string) => {
    setBusy(id);
    try {
      await api.redoCutout(id);
      await reload();
      toast.success("Background removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    try {
      await api.deleteItem(id);
      await reload();
      toast.success("Piece removed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const toggleWishlist = async (id: string, isWishlist: boolean) => {
    setBusy(id);
    try {
      await api.updateItem(id, { isWishlist: !isWishlist });
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 pb-28">
      <TopBar />

      <div className="grid grid-cols-2 border-b border-neutral-200">
        {(["closet", "wishlist"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`pb-2.5 text-[15px] capitalize ${
              tab === t
                ? "border-b-[1.5px] border-neutral-900 text-neutral-900"
                : "border-b-[1.5px] border-transparent text-neutral-400 hover:text-neutral-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4">
        <span className="text-[12px] text-neutral-400">
          {visible.length} item{visible.length === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[12px] text-neutral-600 hover:border-neutral-400"
        >
          <SlidersHorizontal size={13} strokeWidth={1.7} />
          {category ? CATEGORY_LABELS[category] : "Filter"}
        </button>
      </div>

      {error && <p className="pt-4 text-[13px] text-rose-600">{error}</p>}

      {incomplete.length > 0 && tab === "closet" && (
        <div className="animate-rise mt-4 flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3">
          <p className="text-[12px] text-neutral-600">
            {incomplete.length} {incomplete.length === 1 ? "item is" : "items are"} missing details
            or a cut-out photo.
          </p>
          <button
            type="button"
            onClick={enrichAll}
            disabled={!!enriching}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-1.5 text-[12px] text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {enriching ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                {enriching.done}/{enriching.total}
              </>
            ) : (
              <>
                <Wand2 size={13} strokeWidth={1.7} />
                Complete with AI
              </>
            )}
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 pt-5 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="skeleton aspect-square rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="stagger grid grid-cols-3 gap-x-3 gap-y-5 pt-5 sm:grid-cols-4 md:grid-cols-6">
          {visible.map((item) => {
            const galleryIndex = gallery.findIndex((g) => g.url === itemImage(item));
            return (
              <figure key={item.id} className="group">
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[#f4f4f5] p-3">
                  <button
                    type="button"
                    onClick={() => galleryIndex >= 0 && setLightboxAt(galleryIndex)}
                    className="flex h-full w-full items-center justify-center"
                    aria-label={`View ${item.brand} ${item.description}`.trim()}
                  >
                    <ItemImage item={item} className="h-full w-full" />
                  </button>

                  <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                    {!item.cutoutUrl && (
                      <button
                        type="button"
                        onClick={() => cleanUp(item.id)}
                        disabled={busy === item.id}
                        title="Cut the item out with AI"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-neutral-600 shadow-sm hover:text-neutral-900"
                      >
                        {busy === item.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Wand2 size={13} strokeWidth={1.7} />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleWishlist(item.id, item.isWishlist)}
                      disabled={busy === item.id}
                      title={item.isWishlist ? "Move to closet" : "Move to wishlist"}
                      className="flex h-7 items-center justify-center rounded-full bg-white/95 px-2 text-[10px] text-neutral-600 shadow-sm hover:text-neutral-900"
                    >
                      {item.isWishlist ? "Own it" : "Wishlist"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      disabled={busy === item.id}
                      title="Delete item"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-neutral-600 shadow-sm hover:text-rose-600"
                    >
                      <Trash2 size={13} strokeWidth={1.7} />
                    </button>
                  </div>
                </div>
                <figcaption className="pt-1.5">
                  <p className="truncate text-[12px] text-neutral-900">{item.brand || "—"}</p>
                  <p className="truncate text-[11px] text-neutral-400">{item.description}</p>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="animate-rise pt-16 text-center">
          <p className="text-[13px] text-neutral-400">Nothing here yet.</p>
          <Link
            to="/closet/add"
            className="mt-3 inline-block rounded-full bg-neutral-900 px-4 py-2 text-[13px] text-white hover:bg-neutral-800"
          >
            Add your first piece
          </Link>
        </div>
      )}

      {lightboxAt !== null && gallery.length > 0 && (
        <Lightbox
          images={gallery}
          index={lightboxAt}
          onIndexChange={setLightboxAt}
          onClose={() => setLightboxAt(null)}
        />
      )}

      {filtersOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/30"
          onClick={() => setFiltersOpen(false)}
        >
          <div
            className="animate-sheet-up max-h-[80vh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4">
              <h2 className="text-[16px] text-neutral-900">Filter &amp; sort</h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>

            <p className="pb-2 text-[12px] text-neutral-500">Category</p>
            <div className="flex flex-wrap gap-2 pb-6">
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={`rounded-full border px-3.5 py-2 text-[12px] ${
                  category === null
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                All
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(category === c ? null : c)}
                  className={`rounded-full border px-3.5 py-2 text-[12px] ${
                    category === c
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                  }`}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>

            <p className="pb-2 text-[12px] text-neutral-500">Sort by</p>
            <div className="flex gap-2 pb-6">
              {(["newest", "brand", "category"] as Sort[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSort(s)}
                  className={`flex-1 rounded-xl border py-2.5 text-[13px] capitalize ${
                    sort === s
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategory(null);
                  setSort("newest");
                }}
                className="flex-1 rounded-full border border-neutral-200 py-3 text-[13px] text-neutral-600 hover:border-neutral-400"
              >
                Clear filters
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="flex-1 rounded-full bg-neutral-900 py-3 text-[13px] text-white hover:bg-neutral-800"
              >
                Show results
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
