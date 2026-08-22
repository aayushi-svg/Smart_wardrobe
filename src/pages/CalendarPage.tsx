import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Loader2,
  Settings2,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { api } from "../api";
import { useCloset } from "../store";
import { useToast } from "../components/Toast";
import Lightbox from "../components/Lightbox";
import type { LightboxImage } from "../components/Lightbox";
import AvatarView from "../components/AvatarView";
import ItemImage from "../components/ItemImage";
import type { CalendarEntry, CalendarSettings, Outfit } from "../types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_SUNDAY = ["S", "M", "T", "W", "T", "F", "S"];

/** Cell heights per preference. "large" is the default because the whole point
 *  of the month view is seeing the looks, not the numbers. */
const CARD_HEIGHTS = {
  compact: "h-24 sm:h-28",
  medium: "h-36 sm:h-44",
  large: "h-52 sm:h-64",
} as const;

const pad = (n: number) => String(n).padStart(2, "0");
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const DEFAULT_SETTINGS: CalendarSettings = {
  weekStartsOn: 0,
  cardSize: "large",
  showWeather: true,
  showStreak: true,
  showItemDots: true,
  highlightToday: true,
};

/** Longest run of consecutive planned days ending today or yesterday. */
function streakFrom(dates: Set<string>): number {
  const cursor = new Date();
  if (!dates.has(todayKey())) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  for (;;) {
    const key = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`;
    if (!dates.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function CalendarPage() {
  const today = new Date();
  const { allOutfits, outfitsById, resolve } = useCloset();
  const toast = useToast();

  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [allDates, setAllDates] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [planFor, setPlanFor] = useState<string | null>(null);
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);

  const monthKey = `${cursor.year}-${pad(cursor.month + 1)}`;

  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await api.calendar(monthKey));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    api.calendarSettings().then(setSettings).catch(() => setSettings(DEFAULT_SETTINGS));
    // The streak spans months, so it needs every planned day, not just this one.
    api
      .calendar()
      .then((all) => setAllDates(new Set(all.map((e) => e.date))))
      .catch(() => setAllDates(new Set()));
  }, []);

  const cells = useMemo(() => {
    const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
    const offset = (firstWeekday - settings.weekStartsOn + 7) % 7;
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
  }, [cursor, settings.weekStartsOn]);

  const weekdayLabels = useMemo(
    () => [...DOW_SUNDAY.slice(settings.weekStartsOn), ...DOW_SUNDAY.slice(0, settings.weekStartsOn)],
    [settings.weekStartsOn],
  );

  /** Every rendered look this month, in grid order — the lightbox gallery. */
  const gallery = useMemo<(LightboxImage & { date: string })[]>(
    () =>
      entries
        .map((entry): (LightboxImage & { date: string }) | null => {
          const outfit = outfitsById.get(entry.outfitId);
          if (!outfit?.avatarUrl) return null;
          return {
            url: outfit.avatarUrl,
            caption: `${outfit.occasion} — ${entry.date}`,
            name: `closei-${entry.date}`,
            date: entry.date,
          };
        })
        .filter((x): x is LightboxImage & { date: string } => x !== null)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [entries, outfitsById],
  );

  const shift = (delta: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const saveSettings = async (patch: Partial<CalendarSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next); // optimistic — the controls must feel instant
    try {
      setSettings(await api.saveCalendarSettings(next));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const plan = async (date: string, outfitId: string) => {
    try {
      await api.planDay(date, outfitId);
      setAllDates((dates) => new Set(dates).add(date));
      await loadMonth();
      setPlanFor(null);
      toast.success("Look planned.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const clear = async (date: string) => {
    try {
      await api.clearDay(date);
      setAllDates((dates) => {
        const next = new Set(dates);
        next.delete(date);
        return next;
      });
      await loadMonth();
      setPlanFor(null);
      toast.success("Day cleared.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const share = async () => {
    const text = `I've planned ${entries.length} outfits for ${MONTHS[cursor.month]} on Closei.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My Closei calendar", text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);
        toast.success("Link copied to clipboard.");
      }
    } catch {
      // A cancelled share dialog throws; that is not an error worth surfacing.
    }
  };

  const streak = streakFrom(allDates);

  return (
    <div className="mx-auto w-full max-w-[1200px] bg-white px-4 pb-28 sm:px-5">
      <header className="flex items-center justify-between pt-4 pb-3">
        <Link
          to="/"
          aria-label="Back to home"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
        >
          <ChevronLeft size={17} strokeWidth={1.8} />
        </Link>

        {settings.showStreak && (
          <span className="flex items-center gap-1.5 text-[13px] text-neutral-700">
            <Flame size={16} strokeWidth={1.7} className={streak > 0 ? "text-orange-500" : ""} />
            {streak}
            <span className="text-neutral-400">day{streak === 1 ? "" : "s"}</span>
          </span>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Calendar settings"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
          >
            <Settings2 size={16} strokeWidth={1.7} />
          </button>
          <button
            type="button"
            onClick={share}
            aria-label="Share calendar"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
          >
            <Share2 size={16} strokeWidth={1.7} />
          </button>
        </div>
      </header>

      <div className="flex items-center justify-center gap-8 pb-5">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
        >
          <ChevronLeft size={18} strokeWidth={1.8} />
        </button>
        <button
          type="button"
          onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
          className="text-[17px] text-neutral-900 hover:text-neutral-600"
          title="Jump to this month"
        >
          {MONTHS[cursor.month]} {cursor.year}
        </button>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-800"
        >
          <ChevronRight size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 pb-2">
        {weekdayLabels.map((d, i) => (
          <span key={i} className="text-center text-[11px] tracking-wide text-neutral-400">
            {d}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className={`skeleton rounded-2xl ${CARD_HEIGHTS[settings.cardSize]}`} />
          ))}
        </div>
      ) : (
        <div key={monthKey} className="animate-fade-in grid grid-cols-7 gap-2">
          {cells.map((day, i) => {
            if (day === null) return <div key={`pad-${i}`} />;

            const date = `${monthKey}-${pad(day)}`;
            const entry = entries.find((e) => e.date === date);
            const outfit = entry ? outfitsById.get(entry.outfitId) : undefined;
            const isToday = date === todayKey();
            const galleryIndex = gallery.findIndex((g) => g.date === date);

            return (
              <div key={date} className="flex flex-col">
                <div
                  className={`group relative overflow-hidden rounded-2xl bg-white ring-1 transition-all duration-300 ${
                    CARD_HEIGHTS[settings.cardSize]
                  } ${
                    isToday && settings.highlightToday
                      ? "ring-2 ring-neutral-900"
                      : "ring-neutral-100 hover:ring-neutral-300"
                  }`}
                >
                  <span
                    className={`absolute left-2 top-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] ${
                      isToday && settings.highlightToday
                        ? "bg-neutral-900 text-white"
                        : "bg-white/80 text-neutral-400 backdrop-blur-sm"
                    }`}
                  >
                    {day}
                  </span>

                  {outfit ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          outfit.avatarUrl && galleryIndex >= 0
                            ? setLightboxAt(galleryIndex)
                            : setPlanFor(date)
                        }
                        title={
                          outfit.avatarUrl
                            ? `View ${outfit.occasion} look`
                            : `${outfit.occasion} — tap to change`
                        }
                        className="h-full w-full bg-white p-1"
                      >
                        <AvatarView
                          outfit={outfit}
                          items={resolve(outfit.itemIds)}
                          className="h-full w-full"
                        />
                      </button>

                      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setPlanFor(date)}
                          className="rounded-full bg-white/95 px-2 py-1 text-[10px] text-neutral-700 shadow-sm hover:text-neutral-900"
                        >
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={() => clear(date)}
                          aria-label={`Clear ${date}`}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-neutral-500 shadow-sm hover:text-rose-600"
                        >
                          <Trash2 size={12} strokeWidth={1.8} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPlanFor(date)}
                      aria-label={`Plan an outfit for ${date}`}
                      className="flex h-full w-full items-center justify-center text-neutral-200 hover:bg-neutral-50 hover:text-neutral-400"
                    >
                      <span className="text-[22px] leading-none">+</span>
                    </button>
                  )}
                </div>

                {settings.showItemDots && outfit && (
                  <div className="flex justify-center gap-1 pt-1.5">
                    {resolve(outfit.itemIds).slice(0, 5).map((item) => (
                      <span
                        key={item.id}
                        title={`${item.brand} ${item.description}`.trim() || item.category}
                        className="h-1.5 w-1.5 rounded-full ring-1 ring-black/5"
                        style={{ backgroundColor: item.color }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between pt-8 text-[12px] text-neutral-400">
        <span>
          {entries.length} day{entries.length === 1 ? "" : "s"} planned in {MONTHS[cursor.month]}
        </span>
        <span>
          {allOutfits.length} look{allOutfits.length === 1 ? "" : "s"} available
        </span>
      </div>

      {lightboxAt !== null && gallery.length > 0 && (
        <Lightbox
          images={gallery}
          index={lightboxAt}
          onIndexChange={setLightboxAt}
          onClose={() => setLightboxAt(null)}
          saveLabel="Save to avatars"
          onSave={async (image) => {
            await api.saveAvatar(image.url, image.caption ?? "");
            toast.success("Saved to your avatars.");
          }}
        />
      )}

      {planFor && (
        <PlanSheet
          date={planFor}
          outfits={allOutfits}
          currentOutfitId={entries.find((e) => e.date === planFor)?.outfitId ?? null}
          resolve={resolve}
          onPick={(outfitId) => plan(planFor, outfitId)}
          onClear={() => clear(planFor)}
          onClose={() => setPlanFor(null)}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          settings={settings}
          onChange={saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

interface PlanSheetProps {
  date: string;
  outfits: Outfit[];
  currentOutfitId: string | null;
  resolve: (ids: string[]) => import("../types").ClosetItem[];
  onPick: (outfitId: string) => void;
  onClear: () => void;
  onClose: () => void;
}

function PlanSheet({
  date, outfits, currentOutfitId, resolve, onPick, onClear, onClose,
}: PlanSheetProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const pretty = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/30"
      onClick={onClose}
    >
      <div
        className="animate-sheet-up max-h-[80vh] w-full max-w-[640px] overflow-y-auto rounded-t-3xl bg-white pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between bg-white px-5 pb-3 pt-4">
          <div>
            <h2 className="text-[16px] text-neutral-900">Plan {pretty}</h2>
            <p className="text-[12px] text-neutral-400">Pick a look from your wardrobe</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        {outfits.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <CalendarDays size={26} strokeWidth={1.4} className="mx-auto text-neutral-300" />
            <p className="pt-3 text-[13px] text-neutral-500">No looks yet.</p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-full bg-neutral-900 px-4 py-2 text-[13px] text-white hover:bg-neutral-800"
            >
              Build looks on Home
            </Link>
          </div>
        ) : (
          <div className="stagger grid grid-cols-2 gap-3 px-5 sm:grid-cols-3">
            {outfits.map((outfit) => {
              const items = resolve(outfit.itemIds);
              const active = outfit.id === currentOutfitId;
              return (
                <button
                  key={outfit.id}
                  type="button"
                  disabled={!!busy}
                  onClick={async () => {
                    setBusy(outfit.id);
                    await onPick(outfit.id);
                    setBusy(null);
                  }}
                  className={`relative overflow-hidden rounded-2xl bg-white p-2 text-left ring-1 transition hover:ring-neutral-900 disabled:opacity-60 ${
                    active ? "ring-2 ring-neutral-900" : "ring-neutral-200"
                  }`}
                >
                  <div className="flex h-32 items-center justify-center bg-white">
                    {outfit.avatarUrl ? (
                      <AvatarView outfit={outfit} items={items} className="h-full w-auto" />
                    ) : (
                      <div className="flex gap-1">
                        {items.slice(0, 3).map((item) => (
                          <ItemImage key={item.id} item={item} className="h-20 w-12" />
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="truncate pt-2 text-[12px] text-neutral-900">{outfit.occasion}</p>
                  <p className="truncate text-[11px] text-neutral-400">{outfit.subTag}</p>

                  {busy === outfit.id && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Loader2 size={18} className="animate-spin text-neutral-700" />
                    </span>
                  )}
                  {active && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-900 text-white">
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {currentOutfitId && (
          <button
            type="button"
            onClick={onClear}
            className="mx-5 mt-5 flex w-[calc(100%-2.5rem)] items-center justify-center gap-2 rounded-full border border-neutral-200 py-3 text-[13px] text-neutral-600 hover:border-rose-300 hover:text-rose-600"
          >
            <Trash2 size={14} strokeWidth={1.7} />
            Clear this day
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

interface SettingsSheetProps {
  settings: CalendarSettings;
  onChange: (patch: Partial<CalendarSettings>) => void;
  onClose: () => void;
}

function SettingsSheet({ settings, onChange, onClose }: SettingsSheetProps) {
  const toggles = [
    { key: "showStreak", label: "Streak counter", hint: "Consecutive days you've planned" },
    { key: "showItemDots", label: "Colour dots", hint: "The palette of each day's look" },
    { key: "highlightToday", label: "Highlight today", hint: "Outline the current date" },
    { key: "showWeather", label: "Weather", hint: "Show conditions on the home screen" },
  ] as const;

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/30"
      onClick={onClose}
    >
      <div
        className="animate-sheet-up max-h-[80vh] w-full max-w-[560px] overflow-y-auto rounded-t-3xl bg-white pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-4 pt-4">
          <h2 className="text-[16px] text-neutral-900">Calendar settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>

        <div className="px-5">
          <p className="pb-2 text-[12px] text-neutral-500">Week starts on</p>
          <div className="flex gap-2 pb-6">
            {([0, 1] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ weekStartsOn: value })}
                className={`flex-1 rounded-xl border py-2.5 text-[13px] ${
                  settings.weekStartsOn === value
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                {value === 0 ? "Sunday" : "Monday"}
              </button>
            ))}
          </div>

          <p className="pb-2 text-[12px] text-neutral-500">Picture size</p>
          <div className="flex gap-2 pb-6">
            {(["compact", "medium", "large"] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onChange({ cardSize: size })}
                className={`flex-1 rounded-xl border py-2.5 text-[13px] capitalize ${
                  settings.cardSize === size
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                {size}
              </button>
            ))}
          </div>

          <div className="flex flex-col divide-y divide-neutral-100 border-t border-neutral-100">
            {toggles.map(({ key, label, hint }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center justify-between gap-4 py-3.5"
              >
                <span>
                  <span className="block text-[13px] text-neutral-900">{label}</span>
                  <span className="block text-[11px] text-neutral-400">{hint}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings[key]}
                  aria-label={label}
                  onClick={() => onChange({ [key]: !settings[key] })}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${
                    settings[key] ? "bg-neutral-900" : "bg-neutral-200"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${
                      settings[key] ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
