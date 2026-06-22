import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const loadUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .is('read_at', null)
      setUnreadCount(data?.length || 0)
    }
    loadUnread()

    const channel = supabase.channel('navbar-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadUnread())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  const navItems = [
    { path: '/', label: 'Home' },
    { path: '/browse', label: 'Browse' },
    { path: '/messages', label: 'Messages', badge: unreadCount },
    { path: '/groups', label: 'Groups' },
    { path: '/connections', label: 'Connections' },
    { path: '/profile', label: 'Profile' },
  ]

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 2rem', height: '64px', background: 'rgba(15, 15, 26, 0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(108, 99, 255, 0.2)', position: 'sticky', top: 0, zIndex: 100 }}>
      <Link to="/" style={{ fontWeight: '800', fontSize: '1.2rem', marginRight: 'auto', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        🎮 FindMyCrew
      </Link>
      {navItems.map(({ path, label, badge }) => (
        <Link key={path} to={path} style={{ padding: '0.5rem 1rem', borderRadius: '8px', color: isActive(path) ? '#6c63ff' : '#aaa', fontWeight: isActive(path) ? '600' : '400', background: isActive(path) ? 'rgba(108, 99, 255, 0.1)' : 'transparent', transition: 'all 0.2s', position: 'relative', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
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
    </nav>
  )
}
