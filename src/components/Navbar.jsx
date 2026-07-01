import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ADMIN_ID } from '../lib/constants'

export default function Navbar({ theme, setTheme, user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const isAdmin = user?.id === ADMIN_ID
  const isLight = theme === 'light'

  useEffect(() => {
    const load = async () => {
      if (!user) return
      const chatMatch = location.pathname.match(/\/chat\/([^/]+)/)
      const openChatUserId = chatMatch ? chatMatch[1] : null
      const { data: msgs } = await supabase.from('messages').select('id, sender_id').eq('receiver_id', user.id).is('read_at', null)
      const filtered = msgs?.filter(m => m.sender_id !== openChatUserId) || []
      setUnreadMessages(filtered.length)
      const { data: notifs } = await supabase.from('notifications').select('id').eq('user_id', user.id).eq('read', false)
      setUnreadNotifs(notifs?.length || 0)
    }
    load()
    const channel = supabase.channel('navbar-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [location.pathname, user])

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

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

  const navBg     = isLight ? 'rgba(240,240,247,0.95)' : 'rgba(15,15,26,0.95)'
  const navBorder = isLight ? 'rgba(108,99,255,0.15)'  : 'rgba(108,99,255,0.2)'
  const activeColor   = '#6c63ff'
  const inactiveColor = isLight ? '#666' : '#aaa'
  const activeBg  = 'rgba(108,99,255,0.1)'

  return (
    <>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.5rem', height: '64px', background: navBg, backdropFilter: 'blur(10px)', borderBottom: `1px solid ${navBorder}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <Link to="/" style={{ fontWeight: '800', fontSize: '1.2rem', marginRight: 'auto', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textDecoration: 'none' }}>
          🎮 FindMyCrew
        </Link>

        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {navItems.map(({ path, label, badge }) => (
            <Link key={path} to={path} style={{ padding: '0.5rem 1rem', borderRadius: '8px', color: isActive(path) ? activeColor : inactiveColor, fontWeight: isActive(path) ? '600' : '400', background: isActive(path) ? activeBg : 'transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap', textDecoration: 'none' }}>
              {label}
              {badge > 0 && (
                <span style={{ background: '#6c63ff', color: 'white', borderRadius: '100px', fontSize: '0.65rem', fontWeight: '700', padding: '1px 6px', minWidth: '18px', textAlign: 'center' }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          ))}

          <button
            onClick={() => setTheme(isLight ? 'dark' : 'light')}
            style={{ padding: '0.5rem 0.75rem', background: 'transparent', border: `1px solid ${navBorder}`, borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', color: inactiveColor }}
            title="Toggle theme"
          >
            {isLight ? '🌙' : '☀️'}
          </button>

          <button
            onClick={handleLogout}
            style={{ marginLeft: '0.25rem', padding: '0.5rem 1.25rem', background: 'transparent', color: inactiveColor, border: `1px solid ${isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}
          >
            Logout
          </button>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="hamburger"
          style={{ display: 'none', background: 'none', border: 'none', color: isLight ? '#333' : 'white', fontSize: '1.5rem', cursor: 'pointer', padding: '0.5rem', position: 'relative' }}
        >
          {menuOpen ? '✕' : '☰'}
          {!menuOpen && (unreadMessages > 0 || unreadNotifs > 0) && (
            <span style={{ position: 'absolute', top: '6px', right: '6px', width: '8px', height: '8px', borderRadius: '50%', background: '#6c63ff' }} />
          )}
        </button>
      </nav>

      {menuOpen && (
        <div style={{ position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0, background: isLight ? 'rgba(240,240,247,0.98)' : 'rgba(15,15,26,0.98)', zIndex: 99, display: 'flex', flexDirection: 'column', padding: '1.5rem', gap: '0.5rem', overflowY: 'auto' }}>
          {navItems.map(({ path, label, badge }) => (
            <Link key={path} to={path} style={{ padding: '1rem 1.25rem', borderRadius: '12px', color: isActive(path) ? '#a78bfa' : isLight ? '#333' : 'white', fontWeight: isActive(path) ? '700' : '500', background: isActive(path) ? 'rgba(108,99,255,0.15)' : isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'}`, fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none' }}>
              {label === '🔔' ? '🔔 Notifications' : label === '🔍' ? '🔍 Search' : label}
              {badge > 0 && (
                <span style={{ background: '#6c63ff', color: 'white', borderRadius: '100px', fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px' }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          ))}
          <button onClick={() => setTheme(isLight ? 'dark' : 'light')} style={{ padding: '1rem 1.25rem', background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '1.05rem', color: isLight ? '#333' : 'white', textAlign: 'left' }}>
            {isLight ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
          <button onClick={handleLogout} style={{ marginTop: '0.5rem', padding: '1rem', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '1rem', fontWeight: '600' }}>
            Logout
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .hamburger { display: block !important; }
        }
      `}</style>
    </>
  )
}