import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import Home from "./pages/Home";
import Closet from "./pages/Closet";
import AddItem from "./pages/AddItem";
import Profile from "./pages/Profile";
import CalendarPage from "./pages/CalendarPage";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Avatars from "./pages/Avatars";
import Search from "./pages/Search";
import Settings from "./pages/Settings";
import BottomNav from "./components/BottomNav";
import { ToastProvider } from "./components/Toast";
import { AuthProvider, useAuth } from "./auth";
import { ClosetProvider } from "./store";

function FullScreenSpinner() {
  return (
    <div className="flex h-full items-center justify-center bg-white text-neutral-300">
      <Loader2 size={24} className="animate-spin" />
    </div>
  );
}

/** Signed in and finished onboarding, or bounced to the right screen. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenSpinner />;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!user.onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/** Signed in, but onboarding is still in progress. */
function RequireOnboarding({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.onboarded) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** The login screen itself is pointless once you are signed in. */
function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenSpinner />;
  if (user) return <Navigate to={user.onboarded ? "/" : "/onboarding"} replace />;
  return <>{children}</>;
}

/** The nav bar belongs to the signed-in app, not to login or onboarding. */
function AppChrome() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const hidden = pathname === "/login" || pathname === "/onboarding";
  if (!user || hidden) return null;
  return <BottomNav />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ClosetProvider>
          <div className="min-h-full bg-white">
            <Routes>
              <Route
                path="/login"
                element={
                  <RedirectIfSignedIn>
                    <Login />
                  </RedirectIfSignedIn>
                }
              />
              <Route
                path="/onboarding"
                element={
                  <RequireOnboarding>
                    <Onboarding />
                  </RequireOnboarding>
                }
              />

              <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
              <Route path="/closet" element={<RequireAuth><Closet /></RequireAuth>} />
              <Route path="/closet/add" element={<RequireAuth><AddItem /></RequireAuth>} />
              <Route path="/calendar" element={<RequireAuth><CalendarPage /></RequireAuth>} />
              <Route path="/chat" element={<RequireAuth><Chat /></RequireAuth>} />
              <Route path="/avatars" element={<RequireAuth><Avatars /></RequireAuth>} />
              <Route path="/search" element={<RequireAuth><Search /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <AppChrome />
          </div>
        </ClosetProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
