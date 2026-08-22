import { NavLink, useNavigate } from "react-router-dom";
import { Home, MessageCircle, Plus, Search, Shirt, UserRound } from "lucide-react";
import { useAuth } from "../auth";

export default function BottomNav() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const link = ({ isActive }: { isActive: boolean }) =>
    `flex h-11 w-11 items-center justify-center rounded-full transition ${
      isActive ? "bg-neutral-100 text-neutral-900" : "text-neutral-400 hover:text-neutral-600"
    }`;

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-4">
      <div className="animate-rise pointer-events-auto flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white/95 px-3 py-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.10)] backdrop-blur sm:gap-4 sm:px-5">
        <NavLink to="/" className={link} aria-label="Home" title="Home">
          <Home size={20} strokeWidth={1.7} />
        </NavLink>

        <NavLink to="/closet" className={link} aria-label="Closet" title="Closet">
          <Shirt size={20} strokeWidth={1.7} />
        </NavLink>

        <NavLink to="/chat" className={link} aria-label="Ask Closei" title="Ask Closei">
          <MessageCircle size={20} strokeWidth={1.7} />
        </NavLink>

        <NavLink to="/search" className={link} aria-label="Search" title="Search">
          <Search size={20} strokeWidth={1.7} />
        </NavLink>

        <NavLink to="/profile" className={link} aria-label="Profile" title="Profile">
          {user?.photoUrl ? (
            <img
              src={user.photoUrl}
              alt=""
              className="h-7 w-7 rounded-full object-cover ring-1 ring-neutral-200"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 ring-1 ring-neutral-200">
              <UserRound size={15} strokeWidth={1.7} className="text-neutral-500" />
            </span>
          )}
        </NavLink>

        <button
          type="button"
          onClick={() => navigate("/closet/add")}
          aria-label="Add item"
          title="Add a piece"
          className="ml-1 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-white shadow-md hover:bg-neutral-800"
        >
          <Plus size={22} strokeWidth={2} />
        </button>
      </div>
    </nav>
  );
}
