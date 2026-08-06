import type {
  AnalysisResult,
  AvatarReference,
  CalendarEntry,
  ClosetItem,
  Outfit,
} from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    // FastAPI puts the human-readable reason in `detail`.
    const detail = await res
      .json()
      .then((body) => body?.detail)
      .catch(() => null);
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  listItems: (wishlist?: boolean) =>
    request<ClosetItem[]>(
      `/api/items${wishlist === undefined ? "" : `?wishlist=${wishlist}`}`,
    ),

  analyzePhoto: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<AnalysisResult>("/api/items/analyze", { method: "POST", body });
  },

  createItem: (files: File[], fields: Record<string, string | boolean>) => {
    const body = new FormData();
    files.forEach((f) => body.append("files", f));
    Object.entries(fields).forEach(([k, v]) => body.append(k, String(v)));
    return request<ClosetItem>("/api/items", { method: "POST", body });
  },

  updateItem: (id: string, patch: Partial<ClosetItem>) =>
    request<ClosetItem>(`/api/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),

  redoCutout: (id: string) =>
    request<ClosetItem>(`/api/items/${id}/cutout`, { method: "POST" }),

  enrichItem: (id: string) =>
    request<ClosetItem>(`/api/items/${id}/enrich`, { method: "POST" }),

  deleteItem: (id: string) => request<void>(`/api/items/${id}`, { method: "DELETE" }),

  listReferences: () => request<AvatarReference[]>("/api/avatar-references"),

  addReference: (file: File, angle: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("angle", angle);
    return request<AvatarReference>("/api/avatar-references", { method: "POST", body });
  },

  deleteReference: (id: string) =>
    request<void>(`/api/avatar-references/${id}`, { method: "DELETE" }),

  suggestions: (refresh = false) =>
    request<Outfit[]>(`/api/outfits/suggestions${refresh ? "?refresh=true" : ""}`),

  listOutfits: () => request<Outfit[]>("/api/outfits"),

  generateAvatar: (outfitId: string) =>
    request<Outfit>(`/api/outfits/${outfitId}/avatar`, { method: "POST" }),

  calendar: (month?: string) =>
    request<CalendarEntry[]>(`/api/calendar${month ? `?month=${month}` : ""}`),

  planDay: (date: string, outfitId: string) =>
    request<CalendarEntry>("/api/calendar", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, outfitId }),
    }),

  clearDay: (date: string) => request<void>(`/api/calendar/${date}`, { method: "DELETE" }),

  geminiHealth: () =>
    request<{ configured: boolean; error?: string; reply?: string }>("/api/health/gemini"),
};
