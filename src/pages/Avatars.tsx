import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Loader2, Pencil, Sparkles, Trash2 } from "lucide-react";
import { api, downloadImage } from "../api";
import { useToast } from "../components/Toast";
import Lightbox from "../components/Lightbox";
import type { LightboxImage } from "../components/Lightbox";
import TopBar from "../components/TopBar";
import type { SavedAvatar } from "../types";

export default function Avatars() {
  const toast = useToast();
  const [saved, setSaved] = useState<SavedAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setSaved(await api.listSavedAvatars());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // `load` is stable enough for a mount-only fetch; the page has a manual
    // refresh through its own actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gallery = useMemo<LightboxImage[]>(
    () =>
      saved.map((avatar) => ({
        url: avatar.url,
        caption: avatar.title || new Date(avatar.createdAt).toLocaleDateString(),
        name: `closei-avatar-${avatar.createdAt.slice(0, 10)}`,
      })),
    [saved],
  );

  const download = async (avatar: SavedAvatar) => {
    setBusy(avatar.id);
    try {
      await downloadImage(avatar.url, `closei-avatar-${avatar.createdAt.slice(0, 10)}.png`);
      toast.success("Downloaded.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const rename = async (avatar: SavedAvatar) => {
    const title = window.prompt("Name this look", avatar.title);
    if (title === null) return;
    try {
      const updated = await api.renameSavedAvatar(avatar.id, title);
      setSaved((list) => list.map((a) => (a.id === updated.id ? updated : a)));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (avatar: SavedAvatar) => {
    setBusy(avatar.id);
    try {
      await api.deleteSavedAvatar(avatar.id);
      setSaved((list) => list.filter((a) => a.id !== avatar.id));
      toast.success("Removed from your avatars.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 pb-28">
      <TopBar />

      <div className="flex items-end justify-between pt-2 pb-5">
        <div>
          <h1 className="text-[19px] text-neutral-900">Your avatars</h1>
          <p className="pt-1 text-[13px] text-neutral-400">
            Every look you've saved. Tap one to view it full size or download it.
          </p>
        </div>
        <span className="shrink-0 text-[12px] text-neutral-400">
          {saved.length} saved
        </span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : saved.length === 0 ? (
        <div className="animate-rise pt-20 text-center">
          <Sparkles size={28} strokeWidth={1.3} className="mx-auto text-neutral-300" />
          <p className="pt-4 text-[14px] text-neutral-700">No saved avatars yet.</p>
          <p className="pt-1 text-[13px] text-neutral-400">
            Render a look on the home screen, then tap the heart to keep it here.
          </p>
          <Link
            to="/"
            className="mt-5 inline-block rounded-full bg-neutral-900 px-5 py-2.5 text-[13px] text-white hover:bg-neutral-800"
          >
            Build a look
          </Link>
        </div>
      ) : (
        <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {saved.map((avatar, i) => (
            <figure key={avatar.id} className="group">
              <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-100">
                <button
                  type="button"
                  onClick={() => setLightboxAt(i)}
                  className="block aspect-[3/4] w-full bg-white"
                  aria-label={`View ${avatar.title || "saved look"}`}
                >
                  <img
                    src={avatar.url}
                    alt={avatar.title || "Saved look"}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </button>

                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => rename(avatar)}
                    title="Rename"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-neutral-600 shadow-sm hover:text-neutral-900"
                  >
                    <Pencil size={12} strokeWidth={1.8} />
                  </button>
                  <button
                    type="button"
                    onClick={() => download(avatar)}
                    disabled={busy === avatar.id}
                    title="Download"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-neutral-600 shadow-sm hover:text-neutral-900"
                  >
                    {busy === avatar.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Download size={12} strokeWidth={1.8} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(avatar)}
                    disabled={busy === avatar.id}
                    title="Delete"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-neutral-600 shadow-sm hover:text-rose-600"
                  >
                    <Trash2 size={12} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
              <figcaption className="truncate pt-2 text-[12px] text-neutral-700">
                {avatar.title || new Date(avatar.createdAt).toLocaleDateString()}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {lightboxAt !== null && (
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
