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
import AchievementsPage from './AchievementsPage'

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })
    supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })
  }, [])

  if (loading) return null

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={<ProtectedRoute user={user}><Home /></ProtectedRoute>} />
        <Route path="/browse" element={<ProtectedRoute user={user}><Browse /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute user={user}><Profile /></ProtectedRoute>} />
        <Route path="/connections" element={<ProtectedRoute user={user}><Connections /></ProtectedRoute>} />
        <Route path="/chat/:userId" element={<ProtectedRoute user={user}><Chat /></ProtectedRoute>} />
        <Route path="/game-levels" element={<ProtectedRoute user={user}><GameLevels /></ProtectedRoute>} />
        <Route path="/groups" element={<ProtectedRoute user={user}><Groups /></ProtectedRoute>} />
        <Route path="/groups/:groupId" element={<ProtectedRoute user={user}><GroupChat /></ProtectedRoute>} />
        <Route path="/invite/:inviteCode" element={<ProtectedRoute user={user}><InvitePage /></ProtectedRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/messages" element={<ProtectedRoute user={user}><Messages /></ProtectedRoute>} />
        <Route path="/user/:userId" element={<ProtectedRoute user={user}><UserProfile /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute user={user}><Notifications /></ProtectedRoute>} />
        <Route path="/search" element={<ProtectedRoute user={user}><Search /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
        <Route path="/achievements" element={<AchievementsPage />} />
      </Routes>
    </BrowserRouter>
  )
}