import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Pencil,
  Settings as SettingsIcon,
  Share2,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useCloset } from "../store";
import { useToast } from "../components/Toast";
import Lightbox from "../components/Lightbox";
import type { LightboxImage } from "../components/Lightbox";
import AvatarView from "../components/AvatarView";
import TopBar from "../components/TopBar";
import type { AvatarReference, SavedAvatar } from "../types";

const ANGLES = [
  { key: "face", label: "Face", hint: "Anchors your identity" },
  { key: "front", label: "Front", hint: "Full body, facing camera" },
  { key: "side", label: "Side", hint: "Optional" },
  { key: "back", label: "Back", hint: "Optional" },
] as const;

const STYLE_TAGS = [
  "minimal", "streetwear", "classic", "romantic", "edgy", "sporty",
  "boho", "preppy", "vintage", "glam", "workwear", "cosy",
];

type Tab = "looks" | "avatars" | "body";

export default function Profile() {
  const { user, updateProfile, setUser } = useAuth();
  const { items, outfits, resolve } = useCloset();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("looks");
  const [refs, setRefs] = useState<AvatarReference[]>([]);
  const [savedAvatars, setSavedAvatars] = useState<SavedAvatar[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  const refInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const photoInput = useRef<HTMLInputElement>(null);

  // Edit-profile draft
  const [draftName, setDraftName] = useState(user?.displayName ?? "");
  const [draftUsername, setDraftUsername] = useState(user?.username ?? "");
  const [draftBio, setDraftBio] = useState(user?.bio ?? "");
  const [draftCity, setDraftCity] = useState(user?.city ?? "");
  const [draftTags, setDraftTags] = useState<string[]>(user?.styleTags ?? []);
  const [savingProfile, setSavingProfile] = useState(false);

  const loadRefs = async () => {
    try {
      setRefs(await api.listReferences());
    } catch {
      setRefs([]);
    }
  };

  useEffect(() => {
    void loadRefs();
    api.listSavedAvatars().then(setSavedAvatars).catch(() => setSavedAvatars([]));
  }, []);

  const renderedLooks = useMemo(() => outfits.filter((o) => o.avatarUrl), [outfits]);

  const openEditor = () => {
    setDraftName(user?.displayName ?? "");
    setDraftUsername(user?.username ?? "");
    setDraftBio(user?.bio ?? "");
    setDraftCity(user?.city ?? "");
    setDraftTags(user?.styleTags ?? []);
    setEditing(true);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({
        displayName: draftName,
        username: draftUsername.trim() || undefined,
        bio: draftBio,
        city: draftCity,
        styleTags: draftTags,
      });
      setEditing(false);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const uploadReference = async (angle: string, file: File | undefined) => {
    if (!file) return;
    setUploading(angle);
    try {
      await api.addReference(file, angle);
      await loadRefs();
      toast.success(`${angle} photo saved.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(null);
    }
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading("profile");
    try {
      setUser(await api.uploadProfilePhoto(file));
      toast.success("Profile photo updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(null);
    }
  };

  const share = async () => {
    const handle = user?.username ? `@${user.username}` : user?.displayName;
    const url = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${handle} on Closei`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied.");
      }
    } catch {
      /* cancelled share dialogs throw; nothing to report */
    }
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        month: "short",
        year: "2-digit",
      })
    : "";

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 pb-28">
      <TopBar />

      <div className="flex items-center justify-between pt-1">
        <h1 className="text-[19px] text-neutral-900">Profile</h1>
        <Link
          to="/settings"
          aria-label="Settings"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
        >
          <SettingsIcon size={18} strokeWidth={1.7} />
        </Link>
      </div>

      <div className="flex items-center gap-5 pt-5">
        <button
          type="button"
          onClick={() => photoInput.current?.click()}
          className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-neutral-100"
          aria-label="Change profile photo"
        >
          {user?.photoUrl ? (
            <img src={user.photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <UserRound size={28} strokeWidth={1.3} className="m-auto text-neutral-400" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-neutral-900/50 opacity-0 transition group-hover:opacity-100">
            {uploading === "profile" ? (
              <Loader2 size={18} className="animate-spin text-white" />
            ) : (
              <Camera size={18} className="text-white" />
            )}
          </span>
        </button>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => uploadPhoto(e.target.files?.[0])}
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] text-neutral-900">
            {user?.displayName || user?.email}
          </p>
          {user?.username && (
            <p className="truncate text-[13px] text-neutral-400">@{user.username}</p>
          )}
          <div className="flex gap-5 pt-2 text-center">
            <span className="text-[13px] text-neutral-900">
              {renderedLooks.length}
              <span className="block text-[11px] text-neutral-400">looks</span>
            </span>
            <span className="text-[13px] text-neutral-900">
              {savedAvatars.length}
              <span className="block text-[11px] text-neutral-400">avatars</span>
            </span>
            <span className="text-[13px] text-neutral-900">
              {items.length}
              <span className="block text-[11px] text-neutral-400">items</span>
            </span>
          </div>
        </div>
      </div>

      {user?.bio && <p className="pt-4 text-[13px] text-neutral-700">{user.bio}</p>}
      {(user?.city || memberSince) && (
        <p className="pt-2 text-[11px] text-neutral-400">
          {user?.city && `${user.city}`}
          {user?.city && memberSince && " · "}
          {memberSince && `Member since ${memberSince}`}
        </p>
      )}

      {user && user.styleTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-3">
          {user.styleTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-3 py-1 text-[11px] capitalize text-neutral-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-5">
        <button
          type="button"
          onClick={openEditor}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 py-2.5 text-[13px] text-neutral-800 hover:border-neutral-400"
        >
          <Pencil size={14} strokeWidth={1.7} />
          Edit profile
        </button>
        <button
          type="button"
          onClick={share}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-neutral-200 py-2.5 text-[13px] text-neutral-800 hover:border-neutral-400"
        >
          <Share2 size={14} strokeWidth={1.7} />
          Share profile
        </button>
      </div>

      <div className="mt-6 grid grid-cols-3 border-b border-neutral-200">
        {(["looks", "avatars", "body"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`pb-2.5 text-[14px] capitalize ${
              tab === t
                ? "border-b-[1.5px] border-neutral-900 text-neutral-900"
                : "border-b-[1.5px] border-transparent text-neutral-400 hover:text-neutral-600"
            }`}
          >
            {t === "body" ? "Body refs" : t}
          </button>
        ))}
      </div>

      {tab === "looks" && (
        <div className="pt-5">
          {renderedLooks.length === 0 ? (
            <p className="pt-10 text-center text-[13px] text-neutral-400">
              No rendered looks yet. Create one from the home screen.
            </p>
          ) : (
            <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {renderedLooks.map((outfit, i) => (
                <button
                  key={outfit.id}
                  type="button"
                  onClick={() =>
                    setLightbox({
                      images: renderedLooks.map((o) => ({
                        url: o.avatarUrl!,
                        caption: `${o.occasion} — ${o.subTag}`,
                        name: `closei-${o.occasion}`,
                      })),
                      index: i,
                    })
                  }
                  className="overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-100 hover:ring-neutral-300"
                >
                  <div className="aspect-[3/4] bg-white">
                    <AvatarView
                      outfit={outfit}
                      items={resolve(outfit.itemIds)}
                      className="h-full w-full"
                    />
                  </div>
                  <p className="truncate px-2 py-2 text-left text-[12px] text-neutral-700">
                    {outfit.occasion}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "avatars" && (
        <div className="pt-5">
          {savedAvatars.length === 0 ? (
            <div className="pt-10 text-center">
              <p className="text-[13px] text-neutral-400">Nothing saved yet.</p>
              <Link
                to="/avatars"
                className="mt-4 inline-block rounded-full bg-neutral-900 px-4 py-2 text-[13px] text-white hover:bg-neutral-800"
              >
                Open avatars
              </Link>
            </div>
          ) : (
            <>
              <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {savedAvatars.map((avatar, i) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() =>
                      setLightbox({
                        images: savedAvatars.map((a) => ({
                          url: a.url,
                          caption: a.title,
                          name: `closei-avatar-${a.createdAt.slice(0, 10)}`,
                        })),
                        index: i,
                      })
                    }
                    className="overflow-hidden rounded-2xl bg-white ring-1 ring-neutral-100 hover:ring-neutral-300"
                  >
                    <div className="aspect-[3/4] bg-white">
                      <img
                        src={avatar.url}
                        alt={avatar.title || "Saved look"}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </button>
                ))}
              </div>
              <Link
                to="/avatars"
                className="mt-5 block text-center text-[12px] text-neutral-400 hover:text-neutral-700"
              >
                Manage all avatars
              </Link>
            </>
          )}
        </div>
      )}

      {tab === "body" && (
        <div className="pt-5">
          <p className="text-[13px] text-neutral-500">
            These are what the stylist dresses. Every photo is sent as an identity reference, so
            the more you add the more consistent your face stays between renders.
          </p>

          <div className="grid grid-cols-4 gap-3 pt-5">
            {ANGLES.map(({ key: angle, label, hint }) => {
              const existing = refs.find((r) => r.angle === angle);
              return (
                <div key={angle}>
                  <input
                    ref={(el) => {
                      refInputs.current[angle] = el;
                    }}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => uploadReference(angle, e.target.files?.[0])}
                  />
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#f4f4f5]">
                    {existing ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setLightbox({
                              images: refs.map((r) => ({ url: r.url, caption: r.angle })),
                              index: refs.findIndex((r) => r.id === existing.id),
                            })
                          }
                          className="h-full w-full"
                          aria-label={`View ${label} reference`}
                        >
                          <img
                            src={existing.url}
                            alt={`${angle} reference`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.deleteReference(existing.id);
                            await loadRefs();
                          }}
                          aria-label={`Remove ${angle} reference`}
                          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-neutral-600 hover:text-rose-600"
                        >
                          <Trash2 size={14} strokeWidth={1.7} />
                        </button>
                        <span className="absolute bottom-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => refInputs.current[angle]?.click()}
                        className="flex h-full w-full flex-col items-center justify-center gap-1 text-neutral-400 hover:text-neutral-600"
                      >
                        {uploading === angle ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : (
                          <ImagePlus size={20} strokeWidth={1.6} />
                        )}
                        <span className="text-[11px]">Upload</span>
                      </button>
                    )}
                  </div>
                  <p className="pt-1.5 text-center text-[12px] text-neutral-700">{label}</p>
                  <p className="text-center text-[10px] leading-tight text-neutral-400">{hint}</p>
                </div>
              );
            })}
          </div>

          <p className="pt-5 text-[12px] text-neutral-400">
            Up to 4 references are sent per render, face first. There is no seed control in the
            image model, so some variation between regenerations is expected — good references
            shrink it rather than remove it.
          </p>
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onIndexChange={(index) => setLightbox({ ...lightbox, index })}
          onClose={() => setLightbox(null)}
        />
      )}

      {editing && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/30 sm:items-center"
          onClick={() => setEditing(false)}
        >
          <form
            onSubmit={saveProfile}
            onClick={(e) => e.stopPropagation()}
            className="animate-sheet-up max-h-[85vh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
          >
            <div className="flex items-center justify-between pb-4">
              <h2 className="text-[16px] text-neutral-900">Edit profile</h2>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <label className="block">
                <span className="text-[12px] text-neutral-500">Name</span>
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-900"
                />
              </label>

              <label className="block">
                <span className="text-[12px] text-neutral-500">Username</span>
                <input
                  value={draftUsername}
                  onChange={(e) => setDraftUsername(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-900"
                />
              </label>

              <label className="block">
                <span className="text-[12px] text-neutral-500">City</span>
                <input
                  value={draftCity}
                  onChange={(e) => setDraftCity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-900"
                />
              </label>

              <label className="block">
                <span className="text-[12px] text-neutral-500">Bio</span>
                <textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  rows={3}
                  maxLength={280}
                  className="mt-1 w-full resize-none rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-900"
                />
              </label>

              <div>
                <span className="text-[12px] text-neutral-500">Styles you like</span>
                <div className="flex flex-wrap gap-2 pt-2">
                  {STYLE_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setDraftTags((tags) =>
                          tags.includes(tag)
                            ? tags.filter((t) => t !== tag)
                            : [...tags, tag].slice(0, 12),
                        )
                      }
                      className={`rounded-full border px-3 py-1.5 text-[12px] capitalize ${
                        draftTags.includes(tag)
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 py-3.5 text-[14px] text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {savingProfile && <Loader2 size={15} className="animate-spin" />}
              Save changes
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
