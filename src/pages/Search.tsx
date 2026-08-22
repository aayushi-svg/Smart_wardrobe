import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SearchIcon, X } from "lucide-react";
import { useCloset } from "../store";
import ItemImage from "../components/ItemImage";
import TopBar from "../components/TopBar";
import Lightbox from "../components/Lightbox";
import type { LightboxImage } from "../components/Lightbox";
import { CATEGORIES, CATEGORY_LABELS, itemImage } from "../types";
import type { ClosetCategory } from "../types";

export default function Search() {
  const { items, outfits, loading } = useCloset();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ClosetCategory | null>(null);
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category && item.category !== category) return false;
      if (!needle) return true;
      return `${item.brand} ${item.description} ${item.category}`
        .toLowerCase()
        .includes(needle);
    });
  }, [items, query, category]);

  const matchingLooks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return outfits.filter((outfit) =>
      `${outfit.occasion} ${outfit.subTag}`.toLowerCase().includes(needle),
    );
  }, [outfits, query]);

  const gallery = useMemo<LightboxImage[]>(
    () =>
      results
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
    [results],
  );

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 pb-28">
      <TopBar />

      <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-3 focus-within:border-neutral-900">
        <SearchIcon size={16} strokeWidth={1.7} className="shrink-0 text-neutral-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your closet by brand, colour or piece"
          autoFocus
          className="flex-1 bg-transparent text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="shrink-0 text-neutral-400 hover:text-neutral-700"
          >
            <X size={15} strokeWidth={1.8} />
          </button>
        )}
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pt-4">
        <button
          type="button"
          onClick={() => setCategory(null)}
          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] ${
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
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] ${
              category === c
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
            }`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {matchingLooks.length > 0 && (
        <section className="pt-6">
          <h2 className="pb-2 text-[13px] text-neutral-500">Looks</h2>
          <div className="flex flex-wrap gap-2">
            {matchingLooks.map((outfit) => (
              <Link
                key={outfit.id}
                to="/"
                className="rounded-full border border-neutral-200 px-3.5 py-1.5 text-[12px] text-neutral-700 hover:border-neutral-900"
              >
                {outfit.occasion}
                <span className="pl-1.5 text-neutral-400">{outfit.subTag}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="pt-6 pb-3 text-[13px] text-neutral-500">
        {loading
          ? "Loading your closet…"
          : `${results.length} ${results.length === 1 ? "piece" : "pieces"}`}
      </p>

      {!loading && results.length === 0 ? (
        <div className="pt-10 text-center">
          <p className="text-[13px] text-neutral-400">Nothing matches that.</p>
          <Link
            to="/closet/add"
            className="mt-4 inline-block rounded-full bg-neutral-900 px-4 py-2 text-[13px] text-white hover:bg-neutral-800"
          >
            Add a piece
          </Link>
        </div>
      ) : (
        <div className="stagger grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6">
          {results.map((item) => {
            const galleryIndex = gallery.findIndex(
              (g) => g.url === itemImage(item),
            );
            return (
              <figure key={item.id}>
                <button
                  type="button"
                  onClick={() => galleryIndex >= 0 && setLightboxAt(galleryIndex)}
                  className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-[#f4f4f5] p-3 hover:bg-neutral-200"
                  aria-label={`View ${item.brand} ${item.description}`.trim()}
                >
                  <ItemImage item={item} className="h-full w-full" />
                </button>
                <figcaption className="pt-1.5">
                  <p className="truncate text-[12px] text-neutral-900">{item.brand || "—"}</p>
                  <p className="truncate text-[11px] text-neutral-400">{item.description}</p>
                </figcaption>
              </figure>
            );
          })}
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
    </div>
  );
}
