import type { CalendarEntry, Outfit } from "../types";
import { useCloset } from "../store";
import AvatarView from "./AvatarView";

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface DayStripProps {
  selected: Date;
  onSelect: (date: Date) => void;
  entries: CalendarEntry[];
  outfits: Outfit[];
}

/** The Sun–Sat week containing `date`. */
function weekOf(date: Date) {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function DayStrip({ selected, onSelect, entries, outfits }: DayStripProps) {
  const { resolve } = useCloset();
  const days = weekOf(selected);

  return (
    <div className="grid grid-cols-7 gap-1 border-b border-neutral-200">
      {days.map((day, i) => {
        const isActive = day.toDateString() === selected.toDateString();
        const entry = entries.find((e) => e.date === iso(day));
        const outfit = entry ? outfits.find((o) => o.id === entry.outfitId) : undefined;

        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelect(day)}
            className="flex flex-col items-center gap-1 pt-1"
          >
            <span className={`text-[10px] tracking-wide ${isActive ? "text-neutral-900" : "text-neutral-400"}`}>
              {DAY_LABELS[i]} {day.getDate()}
            </span>
            <div className="flex h-16 items-end">
              {outfit ? (
                <AvatarView
                  outfit={outfit}
                  items={resolve(outfit.itemIds)}
                  className={`h-16 w-auto transition ${isActive ? "opacity-100" : "opacity-45"}`}
                />
              ) : (
                <span className="h-16" />
              )}
            </div>
            <span className={`h-[2px] w-full rounded-full ${isActive ? "bg-neutral-900" : "bg-transparent"}`} />
          </button>
        );
      })}
    </div>
  );
}
