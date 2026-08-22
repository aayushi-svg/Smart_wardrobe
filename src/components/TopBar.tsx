import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarDays, CircleHelp, Flame, X } from "lucide-react";
import { api } from "../api";

const pad = (n: number) => String(n).padStart(2, "0");
const keyFor = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Consecutive planned days ending today (or yesterday, so the streak doesn't
 *  break until a full day has been missed). */
function streakFrom(dates: Set<string>): number {
  const cursor = new Date();
  if (!dates.has(keyFor(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(keyFor(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function TopBar() {
  const [streak, setStreak] = useState(0);
  const [panel, setPanel] = useState<"help" | "alerts" | null>(null);

  useEffect(() => {
    api
      .calendar()
      .then((entries) => setStreak(streakFrom(new Set(entries.map((e) => e.date)))))
      .catch(() => setStreak(0));
  }, []);

  return (
    <>
      <header className="flex items-center justify-between px-1 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <Link
            to="/calendar"
            aria-label="Calendar"
            title="Calendar"
            className="text-neutral-700 hover:text-neutral-900"
          >
            <CalendarDays size={19} strokeWidth={1.6} />
          </Link>
          <Link
            to="/calendar"
            title={`${streak} day planning streak`}
            className="flex items-center gap-1 text-[13px] text-neutral-600 hover:text-neutral-900"
          >
            <Flame
              size={15}
              strokeWidth={1.6}
              className={streak > 0 ? "text-orange-500" : "text-neutral-400"}
            />
            {streak}
          </Link>
        </div>

        <Link to="/" className="text-[19px] font-medium tracking-[0.22em] text-neutral-900">
          CLOSEI
        </Link>

        <div className="flex items-center gap-3 text-neutral-700">
          <button
            type="button"
            onClick={() => setPanel("help")}
            aria-label="Help"
            className="hover:text-neutral-900"
          >
            <CircleHelp size={19} strokeWidth={1.6} />
          </button>
          <button
            type="button"
            onClick={() => setPanel("alerts")}
            aria-label="Notifications"
            className="hover:text-neutral-900"
          >
            <Bell size={19} strokeWidth={1.6} />
          </button>
        </div>
      </header>

      {panel && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-end justify-center bg-neutral-900/30 sm:items-center"
          onClick={() => setPanel(null)}
        >
          <div
            className="animate-sheet-up w-full max-w-[460px] rounded-t-3xl bg-white p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3">
              <h2 className="text-[16px] text-neutral-900">
                {panel === "help" ? "How Closei works" : "Notifications"}
              </h2>
              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </div>

            {panel === "help" ? (
              <ol className="flex flex-col gap-3 text-[13px] text-neutral-600">
                {[
                  "Add pieces to your closet — Closei reads the brand, colour and category from the photo.",
                  "Upload a face and full-body photo under Profile → Body refs so renders look like you.",
                  "Closei builds looks on the home screen. Tap Create avatar to see yourself wearing one.",
                  "Plan looks onto your calendar, and ask Closei anything in the chat tab.",
                ].map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[11px] text-white">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="py-6 text-center">
                <Bell size={24} strokeWidth={1.4} className="mx-auto text-neutral-300" />
                <p className="pt-3 text-[13px] text-neutral-500">You're all caught up.</p>
                <p className="pt-1 text-[12px] text-neutral-400">
                  {streak > 0
                    ? `${streak} day planning streak — keep it going.`
                    : "Plan a look on your calendar to start a streak."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
