import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const GAMING_OPTIONS = [
  { label: 'FPS', icon: '🎯' },
  { label: 'RPG', icon: '⚔️' },
  { label: 'Strategy', icon: '♟️' },
  { label: 'Sports', icon: '⚽' },
  { label: 'MMO', icon: '🌍' },
  { label: 'Indie', icon: '🎨' },
  { label: 'Horror', icon: '👻' },
  { label: 'Battle Royale', icon: '🏆' },
  { label: 'PC', icon: '💻' },
  { label: 'Xbox', icon: '🟢' },
  { label: 'PlayStation', icon: '🔵' },
  { label: 'Switch', icon: '🔴' },
  { label: 'Mobile', icon: '📱' },
]


export default function Profile() {
  const [user, setUser] = useState(null)
  const [selected, setSelected] = useState([])
  const [username, setUsername] = useState('')
  const [saved, setSaved] = useState(false)
  const [platforms, setPlatforms] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) { setSelected(data.hobbies || []); setUsername(data.username || '') }
    }
    load()
  }, [])

  const toggle = (tag) => {
    setSelected(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const saveProfile = async () => {
    if (!user) return alert('Not logged in')
    const { error } = await supabase.from('profiles').upsert({
      id: user.id, email: user.email, username, hobbies: selected, updated_at: new Date()
    })
    if (error) alert(error.message)
    else { setSaved(true); setTimeout(() => setSaved(false), 3000) }
  }

  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const name = username || user?.email?.split('@')[0] || 'U'
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length]

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '2rem' }}>Your Profile</h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.5rem', flexShrink: 0 }}>
          {name[0]?.toUpperCase()}
        </div>
        <div>
          <p style={{ fontWeight: '600', fontSize: '1.1rem' }}>{name}</p>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>{user?.email}</p>
        </div>
      </div>

      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
      <input
        type="text"
        placeholder="e.g. xXGamer42Xx"
        value={username}
        onChange={e => setUsername(e.target.value)}
        style={{ padding: '0.85rem 1rem', width: '100%', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem', fontSize: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', outline: 'none' }}
      />

      <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gaming Interests</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2rem' }}>
        {GAMING_OPTIONS.map(({ label, icon }) => (
          <button key={label} onClick={() => toggle(label)} style={{
            padding: '0.6rem 1.25rem',
            background: selected.includes(label) ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : 'rgba(255,255,255,0.05)',
            color: selected.includes(label) ? 'white' : '#888',
            border: selected.includes(label) ? 'none' : '1px solid rgba(255,255,255,0.1)',
            borderRadius: '100px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '500',
            fontFamily: 'Inter, sans-serif',
            boxShadow: selected.includes(label) ? '0 0 20px rgba(108, 99, 255, 0.3)' : 'none'
          }}>
            {icon} {label}
          </button>
        ))}
      </div>

      <button onClick={saveProfile} style={{
        padding: '0.85rem 2.5rem',
        background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
        color: 'white',
        border: 'none',
        borderRadius: '10px',
        fontSize: '1rem',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
        boxShadow: '0 0 30px rgba(108, 99, 255, 0.3)'
      }}>
        Save Profile
      </button>
      {saved && <span style={{ marginLeft: '1rem', color: '#4caf50', fontWeight: '500' }}>✓ Saved!</span>}
    </div>
  )
}