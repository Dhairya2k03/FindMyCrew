import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0 2rem',
      height: '64px',
      background: 'rgba(15, 15, 26, 0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(108, 99, 255, 0.2)',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      <Link to="/" style={{ fontWeight: '800', fontSize: '1.2rem', marginRight: 'auto', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
        🎮 FindMyCrew
      </Link>
      {[
        { path: '/', label: 'Home' },
        { path: '/browse', label: 'Browse' },
        { path: '/connections', label: 'Connections' },
        { path: '/profile', label: 'Profile' },
      ].map(({ path, label }) => (
        <Link key={path} to={path} style={{
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          color: isActive(path) ? '#6c63ff' : '#aaa',
          fontWeight: isActive(path) ? '600' : '400',
          background: isActive(path) ? 'rgba(108, 99, 255, 0.1)' : 'transparent',
          transition: 'all 0.2s'
        }}>
          {label}
        </Link>
      ))}
      <button onClick={handleLogout} style={{
        marginLeft: '0.5rem',
        padding: '0.5rem 1.25rem',
        background: 'transparent',
        color: '#aaa',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '8px',
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
        fontSize: '0.9rem',
        transition: 'all 0.2s'
      }}>
        Logout
      </button>
    </nav>
  )
}