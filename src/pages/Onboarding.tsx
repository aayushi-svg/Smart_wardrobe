import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ImagePlus,
  Loader2,
  Shirt,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useToast } from "../components/Toast";
import { CATEGORIES, CATEGORY_LABELS } from "../types";
import type { AvatarReference, ClosetCategory } from "../types";

const STEPS = ["You", "Fit", "Avatar", "First piece"] as const;

const GENDERS = ["woman", "man", "non-binary", "prefer not to say"];
const BODY_TYPES = ["petite", "slim", "athletic", "average", "curvy", "plus", "tall"];
const STYLE_TAGS = [
  "minimal", "streetwear", "classic", "romantic", "edgy", "sporty",
  "boho", "preppy", "vintage", "glam", "workwear", "cosy",
];
const SIZE_FIELDS = [
  { key: "top", label: "Top" },
  { key: "bottom", label: "Bottom" },
  { key: "dress", label: "Dress" },
  { key: "shoe", label: "Shoe" },
];

/** The two identity shots the try-on renderer leans on most. */
const REFERENCE_ANGLES = [
  { key: "face", label: "Face", hint: "Close, well-lit, no sunglasses" },
  { key: "front", label: "Full body", hint: "Head to shoes, facing camera" },
] as const;

export default function Onboarding() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, updateProfile, setUser } = useAuth();

  const [step, setStep] = useState(user?.onboardingStep ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — identity
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [birthdate, setBirthdate] = useState(user?.birthdate ?? "");
  const [gender, setGender] = useState(user?.gender ?? "");
  const [city, setCity] = useState(user?.city ?? "");

  // Step 2 — fit
  const [heightCm, setHeightCm] = useState<string>(
    user?.heightCm ? String(user.heightCm) : "",
  );
  const [bodyType, setBodyType] = useState(user?.bodyType ?? "");
  const [styleTags, setStyleTags] = useState<string[]>(user?.styleTags ?? []);
  const [sizes, setSizes] = useState<Record<string, string>>(user?.sizes ?? {});

  // Step 3 — avatar references
  const [refs, setRefs] = useState<AvatarReference[]>([]);
  const [uploadingAngle, setUploadingAngle] = useState<string | null>(null);
  const refInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const photoInput = useRef<HTMLInputElement>(null);

  // Step 4 — first item
  const [itemFile, setItemFile] = useState<File | null>(null);
  const [itemPreview, setItemPreview] = useState<string | null>(null);
  const [itemCategory, setItemCategory] = useState<ClosetCategory>("top");
  const [itemBrand, setItemBrand] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const itemInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 2) api.listReferences().then(setRefs).catch(() => setRefs([]));
  }, [step]);

  useEffect(() => {
    // Object URLs for the local preview have to be released by hand.
    return () => {
      if (itemPreview) URL.revokeObjectURL(itemPreview);
    };
  }, [itemPreview]);

  const go = async (next: number) => {
    setError(null);
    setStep(next);
    // Remembering the step server-side means closing the tab mid-signup
    // resumes here rather than starting over.
    try {
      await api.updateProfile({ onboardingStep: next });
    } catch {
      /* Not worth blocking the wizard over. */
    }
  };

  const saveIdentity = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        displayName,
        username: username.trim() || undefined,
        birthdate: birthdate || null,
        gender,
        city,
      });
      await go(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const saveFit = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        heightCm: heightCm ? Number(heightCm) : undefined,
        bodyType,
        styleTags,
        sizes,
      });
      await go(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const uploadReference = async (angle: string, file: File | undefined) => {
    if (!file) return;
    setUploadingAngle(angle);
    setError(null);
    try {
      await api.addReference(file, angle);
      setRefs(await api.listReferences());
      toast.success(`${angle === "face" ? "Face" : "Full body"} photo saved.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploadingAngle(null);
    }
  };

  const removeReference = async (id: string) => {
    await api.deleteReference(id);
    setRefs(await api.listReferences());
  };

  const uploadProfilePhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      setUser(await api.uploadProfilePhoto(file));
      toast.success("Profile photo updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pickItem = async (file: File | undefined) => {
    if (!file) return;
    if (itemPreview) URL.revokeObjectURL(itemPreview);
    setItemFile(file);
    setItemPreview(URL.createObjectURL(file));
    setError(null);

    // Auto-tagging is a nicety — a failure here must not block the upload.
    setAnalyzing(true);
    try {
      const found = await api.analyzePhoto(file);
      setItemCategory(found.category);
      if (found.brand) setItemBrand(found.brand);
      if (found.description) setItemDescription(found.description);
    } catch {
      /* leave the fields for the user to fill in */
    } finally {
      setAnalyzing(false);
    }
  };

  const finish = async (withItem: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (withItem && itemFile) {
        await api.createItem([itemFile], {
          category: itemCategory,
          brand: itemBrand,
          description: itemDescription,
          isWishlist: false,
          autoCutout: true,
        });
      }
      setUser(await api.completeOnboarding());
      toast.success("You're all set. Welcome to Closei.");
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const toggleTag = (tag: string) =>
    setStyleTags((tags) =>
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag].slice(0, 12),
    );

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[560px] flex-col px-5 pb-10">
      <header className="pt-8">
        <div className="flex items-center gap-1.5">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div
                className={`h-1 rounded-full transition-all duration-500 ${
                  i <= step ? "bg-neutral-900" : "bg-neutral-200"
                }`}
              />
              <span
                className={`mt-1.5 block text-[10px] ${
                  i <= step ? "text-neutral-700" : "text-neutral-300"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </header>

      {error && (
        <p className="animate-rise mt-5 rounded-xl bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
          {error}
        </p>
      )}

      {/* ---------------------------------------------------------------- */}
      {step === 0 && (
        <section key="step0" className="animate-slide-left pt-8">
          <h1 className="text-[24px] font-semibold text-neutral-900">
            Let&rsquo;s get you set up
          </h1>
          <p className="pt-1.5 text-[13px] text-neutral-500">
            Closei uses this to make suggestions that actually sound like you.
          </p>

          <div className="flex flex-col gap-4 pt-7">
            <label className="block">
              <span className="text-[12px] text-neutral-500">Your name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Alex Rivera"
                className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-900"
              />
            </label>

            <label className="block">
              <span className="text-[12px] text-neutral-500">Username</span>
              <div className="mt-1 flex items-center rounded-xl border border-neutral-200 px-4 focus-within:border-neutral-900">
                <span className="text-[14px] text-neutral-300">@</span>
                <input
                  value={username ?? ""}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="alexrivera"
                  className="w-full bg-transparent py-3 pl-1 text-[14px] outline-none"
                />
              </div>
              <span className="pt-1 block text-[11px] text-neutral-400">
                Lowercase letters, numbers, dots and underscores.
              </span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[12px] text-neutral-500">Birthday</span>
                <input
                  type="date"
                  value={birthdate ?? ""}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setBirthdate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-900"
                />
              </label>
              <label className="block">
                <span className="text-[12px] text-neutral-500">City</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Mumbai"
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-900"
                />
              </label>
            </div>

            <div>
              <span className="text-[12px] text-neutral-500">You dress as</span>
              <div className="flex flex-wrap gap-2 pt-2">
                {GENDERS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setGender(gender === option ? "" : option)}
                    className={`rounded-full border px-3.5 py-2 text-[12px] capitalize ${
                      gender === option
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={saveIdentity}
            disabled={busy || !displayName.trim()}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 py-3.5 text-[14px] text-white hover:bg-neutral-800 disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}
            Continue
            <ArrowRight size={15} strokeWidth={1.8} />
          </button>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {step === 1 && (
        <section key="step1" className="animate-slide-left pt-8">
          <h1 className="text-[24px] font-semibold text-neutral-900">How things fit</h1>
          <p className="pt-1.5 text-[13px] text-neutral-500">
            All optional — but the more Closei knows, the better the looks.
          </p>

          <div className="flex flex-col gap-5 pt-7">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[12px] text-neutral-500">Height (cm)</span>
                <input
                  type="number"
                  min={90}
                  max={250}
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="170"
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-900"
                />
              </label>
            </div>

            <div>
              <span className="text-[12px] text-neutral-500">Body type</span>
              <div className="flex flex-wrap gap-2 pt-2">
                {BODY_TYPES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setBodyType(bodyType === option ? "" : option)}
                    className={`rounded-full border px-3.5 py-2 text-[12px] capitalize ${
                      bodyType === option
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[12px] text-neutral-500">
                Styles you like{" "}
                <span className="text-neutral-300">({styleTags.length} selected)</span>
              </span>
              <div className="flex flex-wrap gap-2 pt-2">
                {STYLE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full border px-3.5 py-2 text-[12px] capitalize ${
                      styleTags.includes(tag)
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[12px] text-neutral-500">Your sizes</span>
              <div className="grid grid-cols-4 gap-2 pt-2">
                {SIZE_FIELDS.map(({ key, label }) => (
                  <label key={key} className="block">
                    <input
                      value={sizes[key] ?? ""}
                      onChange={(e) => setSizes({ ...sizes, [key]: e.target.value })}
                      placeholder={label}
                      className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-center text-[13px] outline-none focus:border-neutral-900"
                    />
                    <span className="mt-1 block text-center text-[10px] text-neutral-400">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => go(0)}
              className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-5 py-3.5 text-[14px] text-neutral-600 hover:border-neutral-400"
            >
              <ArrowLeft size={15} strokeWidth={1.8} />
              Back
            </button>
            <button
              type="button"
              onClick={saveFit}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-neutral-900 py-3.5 text-[14px] text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              Continue
              <ArrowRight size={15} strokeWidth={1.8} />
            </button>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {step === 2 && (
        <section key="step2" className="animate-slide-left pt-8">
          <h1 className="text-[24px] font-semibold text-neutral-900">Create your avatar</h1>
          <p className="pt-1.5 text-[13px] text-neutral-500">
            These photos are what Closei dresses. The face shot matters most — in a full-body
            photo your face is only a few dozen pixels tall, which is what makes renders drift.
          </p>

          <div className="flex items-center gap-4 pt-7">
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-neutral-100"
              aria-label="Upload profile photo"
            >
              {user?.photoUrl ? (
                <img src={user.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserRound size={26} strokeWidth={1.4} className="m-auto text-neutral-400" />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-neutral-900/50 opacity-0 transition group-hover:opacity-100">
                <Camera size={18} className="text-white" />
              </span>
            </button>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => uploadProfilePhoto(e.target.files?.[0])}
            />
            <div>
              <p className="text-[13px] text-neutral-800">Profile photo</p>
              <p className="text-[12px] text-neutral-400">
                Shown on your profile. Optional.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-7">
            {REFERENCE_ANGLES.map(({ key: angle, label, hint }) => {
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
                  <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-neutral-100">
                    {existing ? (
                      <>
                        <img
                          src={existing.url}
                          alt={`${label} reference`}
                          className="animate-fade-in h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeReference(existing.id)}
                          aria-label={`Remove ${label} photo`}
                          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-neutral-600 shadow-sm hover:text-rose-600"
                        >
                          <Trash2 size={14} strokeWidth={1.7} />
                        </button>
                        <span className="absolute bottom-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-white">
                          <Check size={13} strokeWidth={2.4} />
                        </span>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => refInputs.current[angle]?.click()}
                        className="flex h-full w-full flex-col items-center justify-center gap-2 text-neutral-400 hover:text-neutral-700"
                      >
                        {uploadingAngle === angle ? (
                          <Loader2 size={22} className="animate-spin" />
                        ) : (
                          <ImagePlus size={22} strokeWidth={1.5} />
                        )}
                        <span className="text-[12px]">Upload</span>
                      </button>
                    )}
                  </div>
                  <p className="pt-2 text-center text-[13px] text-neutral-800">{label}</p>
                  <p className="text-center text-[11px] leading-tight text-neutral-400">{hint}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => go(1)}
              className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-5 py-3.5 text-[14px] text-neutral-600 hover:border-neutral-400"
            >
              <ArrowLeft size={15} strokeWidth={1.8} />
              Back
            </button>
            <button
              type="button"
              onClick={() => go(3)}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-neutral-900 py-3.5 text-[14px] text-white hover:bg-neutral-800"
            >
              {refs.length === 0 ? "Skip for now" : "Continue"}
              <ArrowRight size={15} strokeWidth={1.8} />
            </button>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {step === 3 && (
        <section key="step3" className="animate-slide-left pt-8">
          <h1 className="text-[24px] font-semibold text-neutral-900">Add your first piece</h1>
          <p className="pt-1.5 text-[13px] text-neutral-500">
            One photo is enough to start. Closei reads the brand, colour and category for you,
            then cuts the background out.
          </p>

          <input
            ref={itemInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pickItem(e.target.files?.[0])}
          />

          <button
            type="button"
            onClick={() => itemInput.current?.click()}
            className="mt-7 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-neutral-100 hover:bg-neutral-200"
          >
            {itemPreview ? (
              <img
                src={itemPreview}
                alt="Selected piece"
                className="animate-pop h-full w-full object-contain p-4"
              />
            ) : (
              <span className="flex flex-col items-center gap-2 text-neutral-400">
                <Shirt size={30} strokeWidth={1.4} />
                <span className="text-[13px]">Choose a photo</span>
              </span>
            )}
          </button>

          {itemFile && (
            <div className="animate-rise flex flex-col gap-3 pt-5">
              {analyzing && (
                <p className="flex items-center gap-2 text-[12px] text-neutral-500">
                  <Sparkles size={14} className="animate-pulse" />
                  Reading the photo…
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setItemCategory(category)}
                    className={`rounded-full border px-3.5 py-2 text-[12px] ${
                      itemCategory === category
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                    }`}
                  >
                    {CATEGORY_LABELS[category]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  value={itemBrand}
                  onChange={(e) => setItemBrand(e.target.value)}
                  placeholder="Brand"
                  className="rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-900"
                />
                <input
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Description"
                  className="rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-900"
                />
              </div>
            </div>
          )}

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => go(2)}
              className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-5 py-3.5 text-[14px] text-neutral-600 hover:border-neutral-400"
            >
              <ArrowLeft size={15} strokeWidth={1.8} />
              Back
            </button>
            <button
              type="button"
              onClick={() => finish(true)}
              disabled={busy}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-neutral-900 py-3.5 text-[14px] text-white hover:bg-neutral-800 disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              {itemFile ? "Add and finish" : "Finish"}
            </button>
          </div>

          {itemFile && (
            <button
              type="button"
              onClick={() => finish(false)}
              disabled={busy}
              className="mt-3 w-full text-center text-[12px] text-neutral-400 hover:text-neutral-700"
            >
              Skip this piece and finish
            </button>
          )}
        </section>
      )}
    </div>
  );
}
