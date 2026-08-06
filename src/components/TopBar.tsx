import { Link } from "react-router-dom";
import { CalendarDays, Flame, CircleHelp, Bell } from "lucide-react";

interface TopBarProps {
  streak?: number;
}

export default function TopBar({ streak = 47 }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-1 pt-4 pb-2">
      <div className="flex items-center gap-3">
        <Link to="/calendar" aria-label="Calendar" className="text-neutral-700 hover:text-neutral-900">
          <CalendarDays size={19} strokeWidth={1.6} />
        </Link>
        <span className="flex items-center gap-1 text-[13px] text-neutral-600">
          <Flame size={15} strokeWidth={1.6} className="text-neutral-700" />
          {streak}
        </span>
      </div>

      <Link to="/" className="text-[19px] font-medium tracking-[0.22em] text-neutral-900">
        ALTA
      </Link>

      <div className="flex items-center gap-3 text-neutral-700">
        <button type="button" aria-label="Help" className="hover:text-neutral-900">
          <CircleHelp size={19} strokeWidth={1.6} />
        </button>
        <button type="button" aria-label="Notifications" className="hover:text-neutral-900">
          <Bell size={19} strokeWidth={1.6} />
        </button>
      </div>
    </header>
  );
}
