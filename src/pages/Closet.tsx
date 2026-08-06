import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Trash2, Wand2 } from "lucide-react";
import { api } from "../api";
import { useCloset } from "../store";
import ItemImage from "../components/ItemImage";
import TopBar from "../components/TopBar";

type Tab = "closet" | "wishlist";

export default function Closet() {
  const { items, loading, error, reload, refreshSuggestions } = useCloset();
  const [tab, setTab] = useState<Tab>("closet");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState<{ done: number; total: number } | null>(null);

  const visible = items.filter((i) => (tab === "wishlist" ? i.isWishlist : !i.isWishlist));
  const incomplete = items.filter((i) => !i.cutoutUrl || (!i.brand && !i.description));

  const enrichAll = async () => {
    setActionError(null);
    setEnriching({ done: 0, total: incomplete.length });
    try {
      for (let i = 0; i < incomplete.length; i++) {
        await api.enrichItem(incomplete[i].id);
        setEnriching({ done: i + 1, total: incomplete.length });
      }
      // Enrichment can re-categorise items, so existing looks may now be
      // nonsense (two bottoms, no top). Rebuild them against the new data.
      await refreshSuggestions();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
      await reload();
    } finally {
      setEnriching(null);
    }
  };

  const cleanUp = async (id: string) => {
    setBusy(id);
    setActionError(null);
    try {
      await api.redoCutout(id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    setBusy(id);
    try {
      await api.deleteItem(id);
      await reload();
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
            className={`pb-2.5 text-[15px] capitalize transition ${
              tab === t
                ? "border-b-[1.5px] border-neutral-900 text-neutral-900"
                : "border-b-[1.5px] border-transparent text-neutral-400 hover:text-neutral-600"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="pt-5 text-[13px] text-rose-600">{error}</p>}
      {actionError && <p className="pt-5 text-[13px] text-rose-600">{actionError}</p>}

      {incomplete.length > 0 && tab === "closet" && (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-4 py-3">
          <p className="text-[12px] text-neutral-600">
            {incomplete.length} {incomplete.length === 1 ? "item is" : "items are"} missing details
            or a cut-out photo.
          </p>
          <button
            type="button"
            onClick={enrichAll}
            disabled={!!enriching}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-1.5 text-[12px] text-white transition hover:bg-neutral-800 disabled:opacity-60"
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
        <div className="flex justify-center pt-20 text-neutral-300">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-5 pt-5 sm:grid-cols-4 md:grid-cols-6">
          {visible.map((item) => (
            <figure key={item.id} className="group">
              <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-[#f4f4f5] p-3">
                <ItemImage item={item} className="h-full w-full" />

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
          ))}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <div className="pt-16 text-center">
          <p className="text-[13px] text-neutral-400">Nothing here yet.</p>
          <Link
            to="/closet/add"
            className="mt-3 inline-block rounded-full bg-neutral-900 px-4 py-2 text-[13px] text-white hover:bg-neutral-800"
          >
            Add your first piece
          </Link>
        </div>
      )}
    </div>
  );
}
