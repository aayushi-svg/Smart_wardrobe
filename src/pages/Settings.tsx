import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useToast } from "../components/Toast";

export default function Settings() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, signOut, setUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [gemini, setGemini] = useState<{
    configured: boolean;
    error?: string;
    reply?: string;
  } | null>(null);

  useEffect(() => {
    api.geminiHealth().then(setGemini).catch(() => setGemini(null));
  }, []);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("password");
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      toast.success("Password updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const restartOnboarding = async () => {
    if (!window.confirm("Run through setup again? Your closet and looks stay as they are.")) {
      return;
    }
    setBusy("onboarding");
    try {
      setUser(await api.restartOnboarding());
      navigate("/onboarding", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const deleteAccount = async () => {
    const typed = window.prompt(
      "This permanently deletes your account, closet, looks and chats. Type DELETE to confirm.",
    );
    if (typed !== "DELETE") return;
    setBusy("delete");
    try {
      await api.deleteAccount();
      // The cookie is already cleared server-side; drop local state and land
      // on the login screen.
      await signOut();
      navigate("/login", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const geminiOk = gemini?.configured && !gemini.error;

  return (
    <div className="mx-auto w-full max-w-[640px] px-5 pb-28">
      <header className="flex items-center gap-3 pt-4 pb-5">
        <Link
          to="/profile"
          aria-label="Back to profile"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
        >
          <ChevronLeft size={17} strokeWidth={1.8} />
        </Link>
        <h1 className="text-[19px] text-neutral-900">Settings</h1>
      </header>

      <section className="animate-rise rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-[14px] text-neutral-900">Account</h2>
        <dl className="pt-3 text-[13px]">
          <div className="flex justify-between py-1.5">
            <dt className="text-neutral-400">Email</dt>
            <dd className="text-neutral-800">{user?.email}</dd>
          </div>
          <div className="flex justify-between py-1.5">
            <dt className="text-neutral-400">Username</dt>
            <dd className="text-neutral-800">@{user?.username ?? "—"}</dd>
          </div>
        </dl>
        <Link
          to="/profile"
          className="mt-3 flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-[13px] text-neutral-700 hover:bg-neutral-100"
        >
          Edit your profile
          <ChevronRight size={15} strokeWidth={1.7} />
        </Link>
      </section>

      <section className="animate-rise mt-4 rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-[14px] text-neutral-900">Password</h2>
        <p className="pt-1 text-[12px] text-neutral-400">
          Signed up with Google? Leave the current password blank to set your first one.
        </p>
        <form onSubmit={changePassword} className="flex flex-col gap-3 pt-4">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Current password"
            className="rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-900"
          />
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="New password (at least 8 characters)"
            className="rounded-xl border border-neutral-200 px-4 py-3 text-[14px] outline-none focus:border-neutral-900"
          />
          <button
            type="submit"
            disabled={busy === "password" || !newPassword}
            className="flex items-center justify-center gap-2 rounded-full bg-neutral-900 py-3 text-[13px] text-white hover:bg-neutral-800 disabled:opacity-40"
          >
            {busy === "password" && <Loader2 size={14} className="animate-spin" />}
            Update password
          </button>
        </form>
      </section>

      <section className="animate-rise mt-4 rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-[14px] text-neutral-900">AI</h2>
        {gemini ? (
          <div
            className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px] ${
              geminiOk ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
            }`}
          >
            {geminiOk ? (
              <CheckCircle2 size={15} className="mt-px shrink-0" strokeWidth={1.7} />
            ) : (
              <TriangleAlert size={15} className="mt-px shrink-0" strokeWidth={1.7} />
            )}
            <span>
              {geminiOk
                ? "Gemini is connected — chat, avatar rendering and photo clean-up are live."
                : `Gemini not ready: ${gemini.error ?? "no API key"}. Add GEMINI_API_KEY to backend/.env and restart the API.`}
            </span>
          </div>
        ) : (
          <p className="pt-3 text-[12px] text-neutral-400">Checking…</p>
        )}
      </section>

      <section className="animate-rise mt-4 rounded-2xl border border-neutral-200 p-5">
        <h2 className="text-[14px] text-neutral-900">Setup</h2>
        <button
          type="button"
          onClick={restartOnboarding}
          disabled={busy === "onboarding"}
          className="mt-3 flex w-full items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-[13px] text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          <span className="flex items-center gap-2">
            <RotateCcw size={15} strokeWidth={1.7} />
            Run setup again
          </span>
          {busy === "onboarding" ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <ChevronRight size={15} strokeWidth={1.7} />
          )}
        </button>
      </section>

      <section className="animate-rise mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate("/login", { replace: true });
          }}
          className="flex items-center justify-center gap-2 rounded-full border border-neutral-200 py-3.5 text-[13px] text-neutral-700 hover:border-neutral-400"
        >
          <LogOut size={15} strokeWidth={1.7} />
          Sign out
        </button>

        <button
          type="button"
          onClick={deleteAccount}
          disabled={busy === "delete"}
          className="flex items-center justify-center gap-2 rounded-full py-3 text-[12px] text-rose-500 hover:text-rose-700 disabled:opacity-50"
        >
          {busy === "delete" && <Loader2 size={14} className="animate-spin" />}
          Delete my account
        </button>
      </section>
    </div>
  );
}
