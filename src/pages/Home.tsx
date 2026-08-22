import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, RefreshCw, Sparkles, Sun } from "lucide-react";
import type { CalendarEntry, CalendarSettings, Outfit } from "../types";
import { api } from "../api";
import { useAuth } from "../auth";
import { useCloset } from "../store";
import TopBar from "../components/TopBar";
import DayStrip from "../components/DayStrip";
import OutfitSection from "../components/OutfitSection";
import AvatarModal from "../components/AvatarModal";

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, outfits, allOutfits, loading, error, refreshSuggestions } = useCloset();

  const [selected, setSelected] = useState(new Date());
  const [avatarFor, setAvatarFor] = useState<Outfit | null>(null);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [ask, setAsk] = useState("");
  const [showWeather, setShowWeather] = useState(true);

  useEffect(() => {
    api.calendar().then(setEntries).catch(() => setEntries([]));
  }, [outfits]);

  useEffect(() => {
    api
      .calendarSettings()
      .then((s: CalendarSettings) => setShowWeather(s.showWeather))
      .catch(() => setShowWeather(true));
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshSuggestions();
    } finally {
      setRefreshing(false);
    }
  };

  const firstName = (user?.displayName || "").trim().split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-[1080px] px-5 pb-28">
      <TopBar />
      <DayStrip selected={selected} onSelect={setSelected} entries={entries} outfits={allOutfits} />

      <div className="flex items-start justify-between pt-5">
        <h1 className="text-[19px] text-neutral-900">
          {greeting(new Date())}
          {firstName && `, ${firstName}`}
        </h1>
        {showWeather && (
          <div className="flex items-center gap-2 text-neutral-500">
            <Sun size={17} strokeWidth={1.6} />
            <span className="text-[15px] text-neutral-800">33°</span>
            <span className="text-[11px] text-neutral-400">H:38° L:20°</span>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          // The chat page owns the conversation; hand the question straight over.
          navigate("/chat", { state: { prompt: ask.trim() } });
        }}
        className="mt-5 flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 focus-within:border-neutral-900"
      >
        <Sparkles size={15} strokeWidth={1.6} className="shrink-0 text-neutral-400" />
        <input
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          className="flex-1 bg-transparent text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
          placeholder="Ask Closei what to wear to school"
        />
        <button
          type="submit"
          aria-label="Ask Closei"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800"
        >
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </form>

      {error && <p className="pt-5 text-[13px] text-rose-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center pt-20 text-neutral-300">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="animate-rise pt-16 text-center">
          <p className="text-[14px] text-neutral-700">Your closet is empty.</p>
          <p className="pt-1 text-[13px] text-neutral-400">
            Add a few pieces and Closei will start building looks from them.
          </p>
          <Link
            to="/closet/add"
            className="mt-4 inline-block rounded-full bg-neutral-900 px-4 py-2 text-[13px] text-white hover:bg-neutral-800"
          >
            Add your first piece
          </Link>
        </div>
      ) : (
        <>
          <div className="flex justify-end pt-6">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-[12px] text-neutral-400 hover:text-neutral-700 disabled:opacity-50"
            >
              <RefreshCw size={13} strokeWidth={1.7} className={refreshing ? "animate-spin" : ""} />
              New looks
            </button>
          </div>
          {outfits.map((outfit) => (
            <OutfitSection key={outfit.id} outfit={outfit} onCreateAvatar={setAvatarFor} />
          ))}
        </>
      )}

      {avatarFor && <AvatarModal outfit={avatarFor} onClose={() => setAvatarFor(null)} />}
    </div>
  );
}
