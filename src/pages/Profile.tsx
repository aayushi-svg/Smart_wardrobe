import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { api } from "../api";
import type { AvatarReference } from "../types";
import TopBar from "../components/TopBar";

const ANGLES = [
  { key: "face", label: "Face", hint: "Close portrait — anchors your identity" },
  { key: "front", label: "Front", hint: "Full body, facing camera" },
  { key: "side", label: "Side", hint: "Optional" },
  { key: "back", label: "Back", hint: "Optional" },
] as const;

export default function Profile() {
  const [refs, setRefs] = useState<AvatarReference[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gemini, setGemini] = useState<{ configured: boolean; error?: string; reply?: string } | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    try {
      setRefs(await api.listReferences());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
    api.geminiHealth().then(setGemini).catch(() => setGemini(null));
  }, []);

  const upload = async (angle: string, file: File | undefined) => {
    if (!file) return;
    setUploading(angle);
    setError(null);
    try {
      await api.addReference(file, angle);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(null);
    }
  };

  const remove = async (id: string) => {
    await api.deleteReference(id);
    await load();
  };

  return (
    <div className="mx-auto w-full max-w-[720px] px-5 pb-28">
      <TopBar />

      <h1 className="pt-4 text-[17px] text-neutral-900">Your body reference</h1>
      <p className="pt-1 text-[13px] text-neutral-500">
        These are what the stylist dresses when you tap Create Avatar. Every photo here is sent
        as an identity reference, so the more you add the more consistent your face stays
        between renders.
      </p>
      <p className="pt-2 text-[12px] text-neutral-400">
        The <strong className="font-medium text-neutral-600">Face</strong> shot matters most — in
        a full-body photo your face is only a few dozen pixels tall, which is why the render can
        drift. Add a sharp, well-lit, front-on close-up with no sunglasses or heavy shadow.
      </p>

      {gemini && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px] ${
            gemini.configured && !gemini.error
              ? "bg-emerald-50 text-emerald-800"
              : "bg-amber-50 text-amber-900"
          }`}
        >
          {gemini.configured && !gemini.error ? (
            <CheckCircle2 size={15} className="mt-px shrink-0" strokeWidth={1.7} />
          ) : (
            <TriangleAlert size={15} className="mt-px shrink-0" strokeWidth={1.7} />
          )}
          <span>
            {gemini.configured && !gemini.error
              ? "Gemini is connected — avatar generation and photo clean-up are live."
              : `Gemini not ready: ${gemini.error ?? "no API key"}. Add GEMINI_API_KEY to backend/.env and restart the API.`}
          </span>
        </div>
      )}

      {error && <p className="pt-3 text-[12px] text-rose-600">{error}</p>}

      <div className="grid grid-cols-4 gap-3 pt-5">
        {ANGLES.map(({ key: angle, label, hint }) => {
          const existing = refs.find((r) => r.angle === angle);
          return (
            <div key={angle}>
              <input
                ref={(el) => {
                  inputs.current[angle] = el;
                }}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => upload(angle, e.target.files?.[0])}
              />
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#f4f4f5]">
                {existing ? (
                  <>
                    <img src={existing.url} alt={`${angle} reference`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => remove(existing.id)}
                      aria-label={`Remove ${angle} reference`}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-neutral-600 hover:text-rose-600"
                    >
                      <Trash2 size={14} strokeWidth={1.7} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputs.current[angle]?.click()}
                    className="flex h-full w-full flex-col items-center justify-center gap-1 text-neutral-400 transition hover:text-neutral-600"
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
        Up to 4 references are sent per render, face first. There is no seed control in the image
        model, so some variation between regenerations is expected — good references shrink it
        rather than remove it.
      </p>
    </div>
  );
}
