import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Browse from './pages/Browse'
import Connections from './pages/Connections'
import Chat from './pages/Chat'
import GameLevels from './pages/GameLevels'
import Groups from './pages/Groups'
import GroupChat from './pages/GroupChat'
import ResetPassword from './pages/ResetPassword'
import InvitePage from './pages/InvitePage'
import UserProfile from './pages/UserProfile'
import Notifications from './pages/Notifications'
import Search from './pages/Search'
import Messages from './pages/Messages'
import AchievementsPage from './pages/AchievementsPage'
import AdminPanel from './pages/AdminPanel'
import Feed from './pages/Feed'
import LFG from './pages/LFG'

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light')
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      setUser(data?.session?.user ?? null)
      setLoading(false)
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  if (loading) return null

  return (
    <BrowserRouter>
      <Navbar theme={theme} setTheme={setTheme} user={user} />

      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />

        <Route path="/" element={<ProtectedRoute user={user}><Home theme={theme} /></ProtectedRoute>} />
        <Route path="/browse" element={<ProtectedRoute user={user}><Browse theme={theme} /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute user={user}><Profile theme={theme} /></ProtectedRoute>} />
        <Route path="/connections" element={<ProtectedRoute user={user}><Connections theme={theme} /></ProtectedRoute>} />
        <Route path="/chat/:userId" element={<ProtectedRoute user={user}><Chat theme={theme} /></ProtectedRoute>} />
        <Route path="/game-levels" element={<ProtectedRoute user={user}><GameLevels theme={theme} /></ProtectedRoute>} />
        <Route path="/groups" element={<ProtectedRoute user={user}><Groups theme={theme} /></ProtectedRoute>} />
        <Route path="/groups/:groupId" element={<ProtectedRoute user={user}><GroupChat theme={theme} /></ProtectedRoute>} />
        <Route path="/invite/:inviteCode" element={<ProtectedRoute user={user}><InvitePage theme={theme} /></ProtectedRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
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
  )
}