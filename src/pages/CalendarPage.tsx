import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Flame, Share } from "lucide-react";
import type { CalendarEntry } from "../types";
import { api } from "../api";
import { useCloset } from "../store";
import AvatarView from "../components/AvatarView";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

const pad = (n: number) => String(n).padStart(2, "0");

export default function CalendarPage() {
  const today = new Date();
  const { outfits, resolve } = useCloset();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [entries, setEntries] = useState<CalendarEntry[]>([]);

  const monthKey = `${cursor.year}-${pad(cursor.month + 1)}`;

  useEffect(() => {
    api.calendar(monthKey).then(setEntries).catch(() => setEntries([]));
  }, [monthKey]);

  const cells = useMemo(() => {
    const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
  }, [cursor]);

  const shift = (delta: number) =>
    setCursor(({ year, month }) => {
      const d = new Date(year, month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const plan = async (date: string) => {
    // Cycle through saved looks so tapping + repeatedly walks the wardrobe.
    if (!outfits.length) return;
    const current = entries.find((e) => e.date === date);
    const idx = current ? outfits.findIndex((o) => o.id === current.outfitId) : -1;
    const next = outfits[(idx + 1) % outfits.length];
    await api.planDay(date, next.id);
    setEntries(await api.calendar(monthKey));
  };

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 pb-28">
      <header className="flex items-center justify-between pt-4 pb-3">
        <Link to="/" aria-label="Back" className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50">
          <ChevronLeft size={17} strokeWidth={1.8} />
        </Link>
        <span className="flex items-center gap-1 text-[13px] text-neutral-600">
          <Flame size={15} strokeWidth={1.6} /> {entries.length}
        </span>
        <button type="button" aria-label="Share" className="text-neutral-700 hover:text-neutral-900">
          <Share size={18} strokeWidth={1.6} />
        </button>
      </header>

      <div className="flex items-center justify-center gap-6 pb-4">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="text-neutral-400 hover:text-neutral-800">
          <ChevronLeft size={16} strokeWidth={1.8} />
        </button>
        <span className="text-[14px] text-neutral-900">
          {MONTHS[cursor.month]} {cursor.year}
        </span>
        <button type="button" onClick={() => shift(1)} aria-label="Next month" className="text-neutral-400 hover:text-neutral-800">
          <ChevronRight size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-x-2 pb-1">
        {DOW.map((d, i) => (
          <span key={i} className="text-center text-[11px] text-neutral-400">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-x-2 gap-y-3">
        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;

          const date = `${monthKey}-${pad(day)}`;
          const entry = entries.find((e) => e.date === date);
          const outfit = entry ? outfits.find((o) => o.id === entry.outfitId) : undefined;
          const isToday =
            day === today.getDate() &&
            cursor.month === today.getMonth() &&
            cursor.year === today.getFullYear();

          return (
            <div key={date} className={`flex flex-col items-center rounded-lg py-1 ${isToday ? "bg-neutral-100" : ""}`}>
              <span className="text-[10px] text-neutral-400">{day}</span>
              <div className="flex h-20 items-end justify-center">
                {outfit ? (
                  <AvatarView outfit={outfit} items={resolve(outfit.itemIds)} className="h-[72px] w-auto" />
                ) : (
                  <span className="h-[72px]" />
                )}
              </div>
              <button
                type="button"
                onClick={() => plan(date)}
                aria-label={`Plan outfit for ${date}`}
                className="text-[13px] leading-none text-neutral-300 hover:text-neutral-600"
              >
                +
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-8 text-[12px] text-neutral-400">
        <span>{entries.length} days planned this month</span>
        <span>{outfits.length} looks available</span>
      </div>
    </div>
  );
}
