import type {
  AnalysisResult,
  AuthConfig,
  AvatarReference,
  CalendarEntry,
  CalendarSettings,
  ChatThread,
  ChatThreadDetail,
  ClosetItem,
  Outfit,
  ProfilePatch,
  SavedAvatar,
  User,
} from "./types";

/** Thrown for 401s so the auth layer can drop the session instead of showing
 *  a raw error to someone whose cookie simply expired. */
export class Unauthorized extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
    this.name = "Unauthorized";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (res.status === 401) throw new Unauthorized();
  if (!res.ok) {
    // FastAPI puts the human-readable reason in `detail`.
    const detail = await res
      .json()
      .then((body) => body?.detail)
      .catch(() => null);
    throw new Error(
      typeof detail === "string" ? detail : `${res.status} ${res.statusText}`,
    );
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const json = (body: unknown): RequestInit => ({
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export interface ChatStreamHandlers {
  onThread: (threadId: string) => void;
  onDelta: (text: string) => void;
  onDone: (info: { messageId: string; title: string | null }) => void;
  onError: (message: string) => void;
}

export const api = {
  // ---- auth -------------------------------------------------------------
  authConfig: () => request<AuthConfig>("/api/auth/config"),

  register: (email: string, password: string, displayName: string) =>
    request<User>("/api/auth/register", {
      method: "POST",
      ...json({ email, password, displayName }),
    }),

  login: (email: string, password: string) =>
    request<User>("/api/auth/login", { method: "POST", ...json({ email, password }) }),

  loginWithGoogle: (credential: string) =>
    request<User>("/api/auth/google", { method: "POST", ...json({ credential }) }),

  me: () => request<User>("/api/auth/me"),

  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>("/api/auth/password", {
      method: "POST",
      ...json({ currentPassword, newPassword }),
    }),

  deleteAccount: () => request<void>("/api/auth/account", { method: "DELETE" }),

  // ---- profile / onboarding ---------------------------------------------
  updateProfile: (patch: ProfilePatch) =>
    request<User>("/api/me", { method: "PATCH", ...json(patch) }),

  uploadProfilePhoto: (file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<User>("/api/me/photo", { method: "POST", body });
  },

  removeProfilePhoto: () => request<User>("/api/me/photo", { method: "DELETE" }),

  completeOnboarding: () =>
    request<User>("/api/me/onboarding/complete", { method: "POST" }),

  restartOnboarding: () =>
    request<User>("/api/me/onboarding/restart", { method: "POST" }),

  // ---- closet -----------------------------------------------------------
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
    request<ClosetItem>(`/api/items/${id}`, { method: "PATCH", ...json(patch) }),

  redoCutout: (id: string) =>
    request<ClosetItem>(`/api/items/${id}/cutout`, { method: "POST" }),

  enrichItem: (id: string) =>
    request<ClosetItem>(`/api/items/${id}/enrich`, { method: "POST" }),

  deleteItem: (id: string) => request<void>(`/api/items/${id}`, { method: "DELETE" }),

  // ---- body references --------------------------------------------------
  listReferences: () => request<AvatarReference[]>("/api/avatar-references"),

  addReference: (file: File, angle: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("angle", angle);
    return request<AvatarReference>("/api/avatar-references", { method: "POST", body });
  },

  deleteReference: (id: string) =>
    request<void>(`/api/avatar-references/${id}`, { method: "DELETE" }),

  // ---- outfits ----------------------------------------------------------
  suggestions: (refresh = false) =>
    request<Outfit[]>(`/api/outfits/suggestions${refresh ? "?refresh=true" : ""}`),

  listOutfits: () => request<Outfit[]>("/api/outfits"),

  generateAvatar: (outfitId: string) =>
    request<Outfit>(`/api/outfits/${outfitId}/avatar`, { method: "POST" }),

  deleteOutfit: (id: string) => request<void>(`/api/outfits/${id}`, { method: "DELETE" }),

  // ---- saved avatars ----------------------------------------------------
  listSavedAvatars: () => request<SavedAvatar[]>("/api/saved-avatars"),

  saveAvatar: (url: string, title = "", outfitId: string | null = null) =>
    request<SavedAvatar>("/api/saved-avatars", {
      method: "POST",
      ...json({ url, title, outfitId }),
    }),

  renameSavedAvatar: (id: string, title: string) =>
    request<SavedAvatar>(`/api/saved-avatars/${id}`, { method: "PATCH", ...json({ title }) }),

  deleteSavedAvatar: (id: string) =>
    request<void>(`/api/saved-avatars/${id}`, { method: "DELETE" }),

  // ---- calendar ---------------------------------------------------------
  calendar: (month?: string) =>
    request<CalendarEntry[]>(`/api/calendar${month ? `?month=${month}` : ""}`),

  planDay: (date: string, outfitId: string, note = "") =>
    request<CalendarEntry>("/api/calendar", {
      method: "PUT",
      ...json({ date, outfitId, note }),
    }),

  clearDay: (date: string) => request<void>(`/api/calendar/${date}`, { method: "DELETE" }),

  calendarSettings: () => request<CalendarSettings>("/api/calendar-settings"),

  saveCalendarSettings: (settings: CalendarSettings) =>
    request<CalendarSettings>("/api/calendar-settings", { method: "PUT", ...json(settings) }),

  // ---- chat -------------------------------------------------------------
  chatThreads: () => request<ChatThread[]>("/api/chat/threads"),

  chatThread: (id: string) => request<ChatThreadDetail>(`/api/chat/threads/${id}`),

  deleteChatThread: (id: string) =>
    request<void>(`/api/chat/threads/${id}`, { method: "DELETE" }),

  /** Streams a reply. Returns once the stream closes; `signal` aborts it. */
  async sendChatMessage(
    threadId: string | null,
    message: string,
    handlers: ChatStreamHandlers,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await fetch("/api/chat/messages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, message }),
      signal,
    });

    if (res.status === 401) throw new Unauthorized();
    if (!res.ok || !res.body) {
      const detail = await res
        .json()
        .then((b) => b?.detail)
        .catch(() => null);
      handlers.onError(typeof detail === "string" ? detail : "Closei could not reply.");
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line; anything after the last one
      // is a partial frame that has to wait for the next chunk.
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        const line = frame.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        let event: Record<string, string>;
        try {
          event = JSON.parse(line.slice(5).trim());
        } catch {
          continue;
        }
        if (event.type === "thread") handlers.onThread(event.threadId);
        else if (event.type === "delta") handlers.onDelta(event.text);
        else if (event.type === "error") handlers.onError(event.message);
        else if (event.type === "done")
          handlers.onDone({ messageId: event.messageId, title: event.title ?? null });
      }
    }
  },

  // ---- health -----------------------------------------------------------
  geminiHealth: () =>
    request<{ configured: boolean; error?: string; reply?: string }>("/api/health/gemini"),
};

/** Saves any image the API serves to the user's downloads folder. */
export async function downloadImage(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("That image could not be downloaded.");
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in Safari; one tick is enough.
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
