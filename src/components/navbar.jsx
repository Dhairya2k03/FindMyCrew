import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Navbar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 2rem', background: '#1a1a2e', color: 'white' }}>
      <span style={{ fontWeight: 'bold', fontSize: '1.1rem', marginRight: 'auto' }}>🎮 FindMyCrew</span>
      <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Home</Link>
      <Link to="/browse" style={{ color: 'white', textDecoration: 'none' }}>Browse</Link>
      <Link to="/profile" style={{ color: 'white', textDecoration: 'none' }}>Profile</Link>
      <button onClick={handleLogout} style={{ color: 'white', background: 'none', border: '1px solid white', borderRadius: '6px', padding: '0.3rem 0.75rem', cursor: 'pointer' }}>Logout</button>
    </nav>
  )
}