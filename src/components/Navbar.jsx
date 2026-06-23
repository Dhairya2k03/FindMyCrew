import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: msgs } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .is('read_at', null)
      setUnreadMessages(msgs?.length || 0)

      const { data: notifs } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('read', false)
      setUnreadNotifs(notifs?.length || 0)
    }
    load()

    const channel = supabase.channel('navbar-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/browse', label: 'Browse' },
    { path: '/search', label: '🔍' },
    { path: '/messages', label: 'Messages', badge: unreadMessages },
    { path: '/groups', label: 'Groups' },
    { path: '/connections', label: 'Connections' },
    { path: '/notifications', label: '🔔', badge: unreadNotifs },
    { path: '/profile', label: 'Profile' },
  ]

  return (
    <>
      <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1.5rem', height: '64px', background: 'rgba(15, 15, 26, 0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(108, 99, 255, 0.2)', position: 'sticky', top: 0, zIndex: 100 }}>
        <Link to="/" style={{ fontWeight: '800', fontSize: '1.2rem', marginRight: 'auto', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          🎮 FindMyCrew
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} className="desktop-nav">
          {navItems.map(({ path, label, badge }) => (
            <Link key={path} to={path} style={{ padding: '0.5rem 1rem', borderRadius: '8px', color: isActive(path) ? '#6c63ff' : '#aaa', fontWeight: isActive(path) ? '600' : '400', background: isActive(path) ? 'rgba(108, 99, 255, 0.1)' : 'transparent', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
              {label}
              {badge > 0 && (
                <span style={{ background: '#6c63ff', color: 'white', borderRadius: '100px', fontSize: '0.65rem', fontWeight: '700', padding: '1px 6px', minWidth: '18px', textAlign: 'center' }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          ))}
          <button onClick={handleLogout} style={{ marginLeft: '0.5rem', padding: '0.5rem 1.25rem', background: 'transparent', color: '#aaa', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>
            Logout
          </button>
        </div>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="hamburger"
          style={{ display: 'none', background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', padding: '0.5rem', position: 'relative' }}
        >
          {menuOpen ? '✕' : '☰'}
          {!menuOpen && (unreadMessages > 0 || unreadNotifs > 0) && (
            <span style={{ position: 'absolute', top: '6px', right: '6px', width: '8px', height: '8px', borderRadius: '50%', background: '#6c63ff' }} />
          )}
        </button>
      </nav>

      {menuOpen && (
        <div style={{ position: 'fixed', top: '64px', left: 0, right: 0, bottom: 0, background: 'rgba(15,15,26,0.98)', zIndex: 99, display: 'flex', flexDirection: 'column', padding: '1.5rem', gap: '0.5rem', overflowY: 'auto' }}>
          {navItems.map(({ path, label, badge }) => (
            <Link key={path} to={path} style={{ padding: '1rem 1.25rem', borderRadius: '12px', color: isActive(path) ? '#a78bfa' : 'white', fontWeight: isActive(path) ? '700' : '500', background: isActive(path) ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {label === '🔔' ? '🔔 Notifications' : label === '🔍' ? '🔍 Search' : label}
              {badge > 0 && (
                <span style={{ background: '#6c63ff', color: 'white', borderRadius: '100px', fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px' }}>
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
            </Link>
          ))}
          <button onClick={handleLogout} style={{ marginTop: '1rem', padding: '1rem', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '1rem', fontWeight: '600' }}>
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