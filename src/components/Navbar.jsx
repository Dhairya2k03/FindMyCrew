import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRole } from '../hooks/useRole'

export default function Navbar({ theme, setTheme, user }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const { isAdmin } = useRole(user)

  useEffect(() => {
    if (!user) return

    const load = async () => {
      const chatMatch = location.pathname.match(/\/chat\/([^/]+)/)
      const openChatUserId = chatMatch ? chatMatch[1] : null

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, sender_id')
        .eq('receiver_id', user.id)
        .is('read_at', null)

      const filtered = msgs?.filter(m => m.sender_id !== openChatUserId) || []
      setUnreadMessages(filtered.length)

      const { data: notifs } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('read', false)

      setUnreadNotifs(notifs?.length || 0)
    }

    load()

    const channel = supabase
      .channel('navbar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, load)
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [location.pathname, user])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path
  const isLight = theme === 'light'

  const baseNav = [
    { path: '/', label: 'Home' },
    { path: '/browse', label: 'Browse' },
    { path: '/search', label: '🔍' },
    { path: '/messages', label: 'Messages', badge: unreadMessages },
    { path: '/groups', label: 'Groups' },
    { path: '/connections', label: 'Connections' },
    { path: '/notifications', label: '🔔', badge: unreadNotifs },
    { path: '/profile', label: 'Profile' },
  ]

  const navItems = isAdmin
    ? [...baseNav, { path: '/admin', label: '🛡️ Admin' }]
    : baseNav

  return (
    <nav>
      <Link to="/">🎮 FindMyCrew</Link>

      {navItems.map(({ path, label, badge }) => (
        <Link key={path} to={path}>
          {label}
          {badge > 0 && <span>{badge > 9 ? '9+' : badge}</span>}
        </Link>
      ))}

      <button onClick={() => setTheme(isLight ? 'dark' : 'light')}>
        {isLight ? '🌙' : '☀️'}
      </button>

      <button onClick={handleLogout}>Logout</button>
    </nav>
  )
}