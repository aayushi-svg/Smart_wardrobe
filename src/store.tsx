import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./api";
import { useAuth } from "./auth";
import type { ClosetItem, Outfit } from "./types";

interface ClosetState {
  items: ClosetItem[];
  /** The current suggestion feed — what the home screen renders. */
  outfits: Outfit[];
  /** Every look this user owns, suggestions and saved alike. The calendar and
   *  day strip look up planned days here: a planned look is marked 'saved' and
   *  so never appears in the suggestion feed. */
  allOutfits: Outfit[];
  itemsById: Map<string, ClosetItem>;
  outfitsById: Map<string, Outfit>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  refreshSuggestions: () => Promise<void>;
  replaceOutfit: (outfit: Outfit) => void;
  resolve: (ids: string[]) => ClosetItem[];
}

const Ctx = createContext<ClosetState | null>(null);

export function ClosetProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [allOutfits, setAllOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keyed on identity *and* onboarding state: onboarding adds a first piece
  // while the same user stays signed in, so the id alone never changes and the
  // closet would stay stale on the way out of the wizard.
  const scope = user ? `${user.id}:${user.onboarded ? "ready" : "onboarding"}` : null;

  const load = useCallback(
    async (refreshSuggestions = false) => {
      if (!scope) {
        // Signed out: drop the previous account's data rather than leaving it
        // on screen behind the login redirect.
        setItems([]);
        setOutfits([]);
        setAllOutfits([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [nextItems, nextOutfits] = await Promise.all([
          api.listItems(),
          api.suggestions(refreshSuggestions),
        ]);
        setItems(nextItems);
        setOutfits(nextOutfits);
        setError(null);
        // Runs after the suggestion sweep so it sees the batch that survived.
        setAllOutfits(await api.listOutfits());
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [scope],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Suggestions come second so a freshly rendered avatar wins over the copy
  // that was read before the render finished.
  const outfitsById = useMemo(
    () => new Map([...allOutfits, ...outfits].map((o) => [o.id, o] as const)),
    [allOutfits, outfits],
  );

  const value = useMemo<ClosetState>(
    () => ({
      items,
      outfits,
      allOutfits,
      itemsById,
      outfitsById,
      loading,
      error,
      reload: () => load(false),
      refreshSuggestions: () => load(true),
      replaceOutfit: (outfit) => {
        const swap = (list: Outfit[]) => list.map((o) => (o.id === outfit.id ? outfit : o));
        setOutfits(swap);
        setAllOutfits((list) =>
          list.some((o) => o.id === outfit.id) ? swap(list) : [outfit, ...list],
        );
      },
      resolve: (ids) => ids.map((id) => itemsById.get(id)).filter((i): i is ClosetItem => !!i),
    }),
    [items, outfits, allOutfits, itemsById, outfitsById, loading, error, load],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCloset() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCloset must be used inside <ClosetProvider>");
  return ctx;
}
