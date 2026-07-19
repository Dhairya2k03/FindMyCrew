import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabaseClient';
import { updateLoginStreak } from './lib/streak';

import Navbar from './components/Navbar';
import BlockedUsers from './pages/BlockedUsers';
import Home from './pages/Home';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Browse from './pages/Browse';
import Connections from './pages/Connections';
import Chat from './pages/Chat';
import GameLevels from './pages/GameLevels';
import Groups from './pages/Groups';
import GroupChat from './pages/GroupChat';
import ResetPassword from './pages/ResetPassword';
import InvitePage from './pages/InvitePage';
import UserProfile from './pages/UserProfile';
import Notifications from './pages/Notifications';
import Search from './pages/Search';
import Messages from './pages/Messages';
import AchievementsPage from './pages/AchievementsPage';
import AdminPanel from './pages/AdminPanel';
import Feed from './pages/Feed';
import LFG from './pages/LFG';

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [streakInfo, setStreakInfo] = useState(null);

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data?.session?.user ?? null;

      if (sessionUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_banned, ban_reason')
          .eq('id', sessionUser.id)
          .single();

        if (profile?.is_banned) {
          alert('Your account has been suspended.' + (profile.ban_reason ? ` Reason: ${profile.ban_reason}` : ''));
          await supabase.auth.signOut();
          setUser(null);
          setLoading(false);
          return;
        }
      }

      setUser(sessionUser);
      setLoading(false);

      if (sessionUser) {
        const result = await updateLoginStreak(sessionUser.id);
        setStreakInfo(result);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        updateLoginStreak(sessionUser.id).then(setStreakInfo);
      } else {
        setStreakInfo(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (loading) return null;

  return (
    <BrowserRouter>
      <Navbar theme={theme} setTheme={setTheme} user={user} streakInfo={streakInfo} />

      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />

        <Route path="/" element={<ProtectedRoute user={user}><Home theme={theme} streakInfo={streakInfo} /></ProtectedRoute>} />
        <Route path="/browse" element={<ProtectedRoute user={user}><Browse theme={theme} /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute user={user}><Profile theme={theme} /></ProtectedRoute>} />
        <Route path="/connections" element={<ProtectedRoute user={user}><Connections theme={theme} /></ProtectedRoute>} />
        <Route path="/chat/:userId" element={<ProtectedRoute user={user}><Chat theme={theme} /></ProtectedRoute>} />
        <Route path="/game-levels" element={<ProtectedRoute user={user}><GameLevels theme={theme} /></ProtectedRoute>} />
        <Route path="/groups" element={<ProtectedRoute user={user}><Groups theme={theme} /></ProtectedRoute>} />
        <Route path="/groups/:groupId" element={<ProtectedRoute user={user}><GroupChat theme={theme} /></ProtectedRoute>} />
        <Route path="/invite/:inviteCode" element={<ProtectedRoute user={user}><InvitePage theme={theme} /></ProtectedRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/blocked" element={<ProtectedRoute user={user}><BlockedUsers theme={theme} /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute user={user}><Messages theme={theme} /></ProtectedRoute>} />
        <Route path="/user/:userId" element={<ProtectedRoute user={user}><UserProfile theme={theme} /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute user={user}><Notifications theme={theme} /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute user={user}><Search theme={theme} /></ProtectedRoute>} />
        <Route path="/achievements" element={<ProtectedRoute user={user}><AchievementsPage theme={theme} /></ProtectedRoute>} />

        <Route path="/admin" element={<ProtectedRoute user={user}><AdminPanel theme={theme} /></ProtectedRoute>} />
        <Route path="/feed" element={<ProtectedRoute user={user}><Feed theme={theme} /></ProtectedRoute>} />
        <Route path="/lfg" element={<ProtectedRoute user={user}><LFG theme={theme} /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}