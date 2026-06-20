import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const PLATFORMS = [
  { id: 'steam', label: 'Steam', icon: '🖥️' },
  { id: 'epic', label: 'Epic Games', icon: '🎮' },
  { id: 'playstation', label: 'PlayStation', icon: '🎮' },
  { id: 'xbox', label: 'Xbox', icon: '🟢' },
  { id: 'nintendo', label: 'Nintendo', icon: '🔴' },
  { id: 'mobile', label: 'Mobile', icon: '📱' },
]

const GAMES_BY_PLATFORM = {
  steam: ['CS2', 'Dota 2', 'Elden Ring', 'Baldurs Gate 3', 'Rust', 'Terraria', 'Stardew Valley', 'Deep Rock Galactic'],
  epic: ['Fortnite', 'Rocket League', 'Fall Guys', 'Borderlands 3', 'GTA V', 'Among Us', 'Splitgate'],
  playstation: ['God of War', 'Spider-Man 2', 'The Last of Us', 'Gran Turismo 7', 'Horizon Forbidden West', 'Demon Souls', 'Ghost of Tsushima'],
  xbox: ['Halo Infinite', 'Forza Horizon 5', 'Gears 5', 'Sea of Thieves', 'Starfield', 'Microsoft Flight Simulator'],
  nintendo: ['Zelda Tears of the Kingdom', 'Mario Kart 8', 'Splatoon 3', 'Pokemon Scarlet', 'Super Smash Bros', 'Animal Crossing'],
  mobile: ['PUBG Mobile', 'Call of Duty Mobile', 'Clash Royale', 'Genshin Impact', 'Mobile Legends', 'Free Fire'],
}

export default function Profile() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [saved, setSaved] = useState(false)
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [selectedGames, setSelectedGames] = useState([])
  const [activePlatform, setActivePlatform] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setUsername(data.username || '')
        setSelectedPlatforms(data.platforms || [])
        setSelectedGames(data.hobbies || [])
      }
    }
    load()
  }, [])

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
    setActivePlatform(id)
  }

  const toggleGame = (game) => {
    setSelectedGames(prev =>
      prev.includes(game) ? prev.filter(g => g !== game) : [...prev, game]
    )
  }

  const saveProfile = async () => {
    if (!user) return alert('Not logged in')
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      username,
      platforms: selectedPlatforms,
      hobbies: selectedGames,
      updated_at: new Date()
    })
    if (error) alert(error.message)
    else navigate('/game-levels')
  }

  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const name = username || user?.email?.split('@')[0] || 'U'
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length]
  const availableGames = activePlatform ? GAMES_BY_PLATFORM[activePlatform] : []

  return (
    <div style={{ padding: '2rem', maxWidth: '650px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '2rem' }}>Your Profile</h2>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.5rem', flexShrink: 0 }}>
          {name[0]?.toUpperCase()}
        </div>
        <div>
          <p style={{ fontWeight: '600', fontSize: '1.1rem' }}>{name}</p>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>{user?.email}</p>
        </div>
      </div>

      {/* Username */}
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
      <input
        type="text"
        placeholder="e.g. xXGamer42Xx"
        value={username}
        onChange={e => setUsername(e.target.value)}
        style={{ padding: '0.85rem 1rem', width: '100%', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem', fontSize: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', outline: 'none' }}
      />

      {/* Platforms */}
      <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Platforms</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2rem' }}>
        {PLATFORMS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => togglePlatform(id)}
            style={{
              padding: '0.6rem 1.25rem',
              background: selectedPlatforms.includes(id) ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : activePlatform === id ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.05)',
              color: selectedPlatforms.includes(id) ? 'white' : '#888',
              border: selectedPlatforms.includes(id) ? 'none' : activePlatform === id ? '1px solid rgba(108,99,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '100px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              fontFamily: 'Inter, sans-serif',
              boxShadow: selectedPlatforms.includes(id) ? '0 0 20px rgba(108, 99, 255, 0.3)' : 'none'
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Game picker */}
      {activePlatform && (
        <>
          <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Games on {PLATFORMS.find(p => p.id === activePlatform)?.label}
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2rem' }}>
            {availableGames.map(game => (
              <button
                key={game}
                onClick={() => toggleGame(game)}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: selectedGames.includes(game) ? 'rgba(108,99,255,0.2)' : 'rgba(255,255,255,0.05)',
                  color: selectedGames.includes(game) ? '#a78bfa' : '#888',
                  border: selectedGames.includes(game) ? '1px solid rgba(108,99,255,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '100px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  fontFamily: 'Inter, sans-serif'
                }}
              >
                {selectedGames.includes(game) ? '✓ ' : ''}{game}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Selected games summary */}
      {selectedGames.length > 0 && (
        <div style={{ marginBottom: '2rem', padding: '1rem 1.5rem', background: 'rgba(108,99,255,0.08)', borderRadius: '12px', border: '1px solid rgba(108,99,255,0.2)' }}>
          <p style={{ color: '#a78bfa', fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Games ({selectedGames.length})</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {selectedGames.map(game => (
              <span
                key={game}
                onClick={() => toggleGame(game)}
                style={{ background: 'rgba(108,99,255,0.2)', color: '#a78bfa', padding: '3px 10px', borderRadius: '100px', fontSize: '0.8rem', border: '1px solid rgba(108,99,255,0.3)', cursor: 'pointer' }}
              >
                {game} ✕
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={saveProfile}
        style={{ padding: '0.85rem 2.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 0 30px rgba(108, 99, 255, 0.3)' }}
      >
        Save & Set Game Levels →
      </button>
      {saved && <span style={{ marginLeft: '1rem', color: '#4caf50', fontWeight: '500' }}>✓ Saved!</span>}
    </div>
  )
}