import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./api";
import type { ClosetItem, Outfit } from "./types";

interface ClosetState {
  items: ClosetItem[];
  outfits: Outfit[];
  itemsById: Map<string, ClosetItem>;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  refreshSuggestions: () => Promise<void>;
  replaceOutfit: (outfit: Outfit) => void;
  resolve: (ids: string[]) => ClosetItem[];
}

const Ctx = createContext<ClosetState | null>(null);

export function ClosetProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ClosetItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refreshSuggestions = false) => {
    setLoading(true);
    try {
      const [nextItems, nextOutfits] = await Promise.all([
        api.listItems(),
        api.suggestions(refreshSuggestions),
      ]);
      setItems(nextItems);
      setOutfits(nextOutfits);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const value: ClosetState = {
    items,
    outfits,
    itemsById,
    loading,
    error,
    reload: () => load(false),
    refreshSuggestions: () => load(true),
    replaceOutfit: (outfit) =>
      setOutfits((list) => list.map((o) => (o.id === outfit.id ? outfit : o))),
    resolve: (ids) => ids.map((id) => itemsById.get(id)).filter((i): i is ClosetItem => !!i),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCloset() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCloset must be used inside <ClosetProvider>");
  return ctx;
}
