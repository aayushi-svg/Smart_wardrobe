import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Closet from "./pages/Closet";
import AddItem from "./pages/AddItem";
import Profile from "./pages/Profile";
import CalendarPage from "./pages/CalendarPage";
import BottomNav from "./components/BottomNav";
import { ClosetProvider } from "./store";

export default function App() {
  return (
    <ClosetProvider>
      <div className="min-h-full bg-white">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/closet" element={<Closet />} />
          <Route path="/closet/add" element={<AddItem />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
        <BottomNav />
      </div>
    </ClosetProvider>
  );
}
