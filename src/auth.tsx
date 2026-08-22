import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Unauthorized, api } from "./api";
import type { ProfilePatch, User } from "./types";

interface AuthState {
  user: User | null;
  /** True until the first /me call settles, so routes don't flash the login screen. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (email: string, password: string, displayName: string) => Promise<User>;
  signInWithGoogle: (credential: string) => Promise<User>;
  signOut: () => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<User>;
  /** Lets callers push a fresh user object in without a round trip. */
  setUser: (user: User) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      // Any failure here — expired cookie, API down — means "not signed in".
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    // A 401 from anywhere in the app means the cookie died mid-session; drop
    // the user so the router sends them to the login screen once, centrally.
    const onRejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof Unauthorized) {
        setUser(null);
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => {
        const next = await api.login(email, password);
        setUser(next);
        return next;
      },
      signUp: async (email, password, displayName) => {
        const next = await api.register(email, password, displayName);
        setUser(next);
        return next;
      },
      signInWithGoogle: async (credential) => {
        const next = await api.loginWithGoogle(credential);
        setUser(next);
        return next;
      },
      signOut: async () => {
        try {
          await api.logout();
        } finally {
          setUser(null);
        }
      },
      updateProfile: async (patch) => {
        const next = await api.updateProfile(patch);
        setUser(next);
        return next;
      },
      setUser,
      refresh,
    }),
    [user, loading, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
