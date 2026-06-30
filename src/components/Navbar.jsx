import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Navbar({ theme, setTheme, user }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const ADMIN_ID = '87d930f5-4ea4-44f5-9f3e-3f1fbf254c38'

  const isAdmin = user?.id === ADMIN_ID

  useEffect(() => {
    const load = async () => {
      if (!user) return

      const chatMatch = location.pathname.match(/\/chat\/([^/]+)/)
      const openChatUserId = chatMatch ? chatMatch[1] : null

      const { data: msgs } = await supabase
        .from('messages')
        .select('id, sender_id')
        .eq('receiver_id', user.id)
        .is('read_at', null)

      const filtered =
        msgs?.filter(m => m.sender_id !== openChatUserId) || []

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
      .channel('navbar-badges')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        load
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        load
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [location.pathname, user])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path
  const isLight = theme === 'light'

  const baseNavItems = [
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
    ? [...baseNavItems, { path: '/admin', label: '🛡️ Admin' }]
    : baseNavItems

  const navBg = isLight ? 'rgba(240,240,247,0.95)' : 'rgba(15,15,26,0.95)'
  const navBorder = isLight ? 'rgba(108,99,255,0.15)' : 'rgba(108,99,255,0.2)'
  const activeColor = '#6c63ff'
  const inactiveColor = isLight ? '#666' : '#aaa'
  const activeBg = 'rgba(108,99,255,0.1)'

  return (
    <>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0 1.5rem',
        height: '64px',
        background: navBg,
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${navBorder}`,
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <Link to="/" style={{
          fontWeight: '800',
          fontSize: '1.2rem',
          marginRight: 'auto',
          background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          🎮 FindMyCrew
        </Link>

        <div className="desktop-nav" style={{ display: 'flex', gap: '0.5rem' }}>
          {navItems.map(({ path, label, badge }) => (
            <Link
              key={path}
              to={path}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                color: isActive(path) ? activeColor : inactiveColor,
                fontWeight: isActive(path) ? '600' : '400',
                background: isActive(path) ? activeBg : 'transparent',
                display: 'flex',
                gap: '0.3rem'
              }}
            >
              {label}
              {badge > 0 && (
                <span style={{
                  background: '#6c63ff',
                  color: 'white',
                  borderRadius: '100px',
                  fontSize: '0.65rem',
                  padding: '1px 6px'
                }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          ))}

          <button onClick={() => setTheme(isLight ? 'dark' : 'light')}>
            {isLight ? '🌙' : '☀️'}
          </button>

          <button onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>
    </>
  )
}