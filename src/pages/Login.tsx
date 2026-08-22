import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import type { AuthConfig } from "../types";

type Mode = "choose" | "signin" | "signup";

/** The slice of Google Identity Services this screen uses. */
interface GoogleIdentity {
  accounts?: {
    id?: {
      initialize: (options: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
}

/** Renders the Google logo inline — the login screen must not depend on a
 *  remote asset that a blocked CDN would turn into a broken button. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.9 24.6c0-1.6-.1-3.2-.4-4.6H24v9.1h12.9c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.4-4.1 7.3-10.2 7.3-17.7z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.4 0-11.7-3.7-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<Mode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const googleSlot = useRef<HTMLDivElement>(null);

  // Send people back where they were headed before the redirect to /login.
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  useEffect(() => {
    api.authConfig().then(setConfig).catch(() => setConfig(null));
  }, []);

  useEffect(() => {
    // Google Identity Services is loaded from Google's own domain; without a
    // client id there is nothing to initialise and the button stays hidden.
    if (!config?.googleEnabled || !config.googleClientId || mode !== "choose") return;

    // Captured here so the narrowing survives into the async onload closure.
    const clientId = config.googleClientId;
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const google = (window as unknown as { google?: GoogleIdentity }).google;
      if (!google?.accounts?.id || !googleSlot.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          setBusy(true);
          setError(null);
          try {
            const user = await signInWithGoogle(response.credential);
            navigate(user.onboarded ? from : "/onboarding", { replace: true });
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        },
      });
      google.accounts.id.renderButton(googleSlot.current, {
        theme: "outline",
        size: "large",
        width: 340,
        shape: "pill",
        text: "continue_with",
      });
    };
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [config, mode, signInWithGoogle, navigate, from]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user =
        mode === "signup"
          ? await signUp(email.trim(), password, name.trim())
          : await signIn(email.trim(), password);
      navigate(user.onboarded ? from : "/onboarding", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col items-center bg-white px-5">
      <h1 className="animate-rise pt-[12vh] text-[34px] font-extrabold tracking-[0.14em] text-neutral-900">
        CLOSEI
      </h1>
      <p className="animate-rise pt-2 text-[13px] text-neutral-400">Your personal stylist</p>

      <div className="w-full max-w-[420px] pt-[8vh]">
        {error && (
          <p className="animate-rise mb-4 rounded-xl bg-rose-50 px-4 py-3 text-center text-[13px] text-rose-700">
            {error}
          </p>
        )}

        {mode === "choose" ? (
          <div className="animate-rise flex flex-col gap-3">
            {config?.googleEnabled ? (
              <div ref={googleSlot} className="flex justify-center [&>div]:!w-full" />
            ) : (
              <button
                type="button"
                onClick={() =>
                  setError(
                    "Google sign-in isn't configured on this server yet. Add GOOGLE_CLIENT_ID to backend/.env, or continue with email below.",
                  )
                }
                className="flex w-full items-center justify-center gap-2.5 rounded-full bg-neutral-100 py-3.5 text-[14px] text-neutral-500 hover:bg-neutral-200"
              >
                <GoogleMark />
                Continue with Google
              </button>
            )}

            <button
              type="button"
              onClick={() => setMode("signin")}
              className="flex w-full items-center justify-center gap-2.5 rounded-full bg-neutral-100 py-3.5 text-[14px] text-neutral-800 hover:bg-neutral-200"
            >
              <Mail size={16} strokeWidth={1.7} />
              Continue with email
            </button>

            <p className="pt-4 text-center text-[12px] text-neutral-400">
              New here?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-neutral-800 underline underline-offset-2 hover:text-neutral-900"
              >
                Create an account
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="animate-slide-left flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                setMode("choose");
                setError(null);
              }}
              className="mb-1 flex items-center gap-1.5 self-start text-[13px] text-neutral-400 hover:text-neutral-700"
            >
              <ArrowLeft size={15} strokeWidth={1.7} />
              Back
            </button>

            {mode === "signup" && (
              <label className="block">
                <span className="text-[12px] text-neutral-500">Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Alex Rivera"
                  className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] text-neutral-900 outline-none focus:border-neutral-900"
                />
              </label>
            )}

            <label className="block">
              <span className="text-[12px] text-neutral-500">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] text-neutral-900 outline-none focus:border-neutral-900"
              />
            </label>

            <label className="block">
              <span className="text-[12px] text-neutral-500">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-4 py-3 text-[14px] text-neutral-900 outline-none focus:border-neutral-900"
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 py-3.5 text-[14px] text-white hover:bg-neutral-800 disabled:opacity-60"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </button>

            <p className="pt-2 text-center text-[12px] text-neutral-400">
              {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signup" ? "signin" : "signup");
                  setError(null);
                }}
                className="text-neutral-800 underline underline-offset-2 hover:text-neutral-900"
              >
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>
          </form>
        )}
      </div>

      <p className="mt-auto py-8 text-center text-[11px] text-neutral-300">
        By continuing you agree to Closei&rsquo;s terms.{" "}
        <Link to="/" className="underline underline-offset-2 hover:text-neutral-500">
          Back to app
        </Link>
      </p>
    </div>
  );
}
