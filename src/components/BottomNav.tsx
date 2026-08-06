import { NavLink, useNavigate } from "react-router-dom";
import { Home, Shirt, Plus, Search } from "lucide-react";

export default function BottomNav() {
  const navigate = useNavigate();
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex h-11 w-11 items-center justify-center rounded-full transition ${
      isActive ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
    }`;

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-4">
      <div className="pointer-events-auto flex items-center gap-6 rounded-full border border-neutral-200/80 bg-white/95 px-5 py-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.10)] backdrop-blur">
        <NavLink to="/" className={link} aria-label="Home">
          <Home size={21} strokeWidth={1.7} />
        </NavLink>

        <NavLink to="/closet" className={link} aria-label="Closet">
          <Shirt size={21} strokeWidth={1.7} />
        </NavLink>

        <button
          type="button"
          onClick={() => navigate("/closet/add")}
          aria-label="Add item"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-md transition hover:bg-neutral-800"
        >
          <Plus size={24} strokeWidth={2} />
        </button>

        <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full text-neutral-400 transition hover:text-neutral-600" aria-label="Search">
          <Search size={21} strokeWidth={1.7} />
        </button>

        <NavLink to="/profile" className={link} aria-label="Profile">
          <span className="h-7 w-7 overflow-hidden rounded-full bg-gradient-to-br from-amber-200 to-rose-300 ring-1 ring-neutral-200" />
        </NavLink>
      </div>
    </nav>
  );
}
