import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const LEVELS = [
  { id: 'beginner', label: 'Beginner', icon: '🌱', desc: 'Just starting out' },
  { id: 'intermediate', label: 'Intermediate', icon: '⚡', desc: 'Know the basics' },
  { id: 'pro', label: 'Pro', icon: '🔥', desc: 'Highly skilled' },
]

export default function GameLevels() {
  const [games, setGames] = useState([])
  const [levels, setLevels] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data } = await supabase.from('profiles').select('hobbies, game_levels').eq('id', user.id).single()
      if (data) {
        setGames(data.hobbies || [])
        setLevels(data.game_levels || {})
      }
    }
    load()
  }, [])

  const selectLevel = (level) => {
    setLevels(prev => ({ ...prev, [games[currentIndex]]: level }))
  }

  const next = async () => {
    if (currentIndex < games.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      setSaving(true)
      await supabase.from('profiles').update({ game_levels: levels }).eq('id', user.id)
      setSaving(false)
      navigate('/')
    }
  }

  const skip = () => {
    if (currentIndex < games.length - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      navigate('/')
    }
  }

  if (games.length === 0) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
      <p style={{ color: '#888' }}>No games selected. Go to Profile first.</p>
    </div>
  )

  const currentGame = games[currentIndex]
  const currentLevel = levels[currentGame]
  const progress = ((currentIndex + 1) / games.length) * 100

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'radial-gradient(ellipse at top, rgba(108, 99, 255, 0.1) 0%, transparent 70%)'
    }}>
      <div style={{ width: '100%', maxWidth: '500px' }}>

        {/* Progress bar */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ color: '#888', fontSize: '0.85rem' }}>Game {currentIndex + 1} of {games.length}</span>
            <span style={{ color: '#a78bfa', fontSize: '0.85rem' }}>{Math.round(progress)}%</span>
          </div>
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', borderRadius: '2px', transition: 'width 0.3s' }} />
          </div>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ color: '#888', marginBottom: '0.5rem', fontSize: '0.9rem' }}>What's your level in</p>
          <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', background: 'linear-gradient(135deg, #fff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {currentGame}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {LEVELS.map(({ id, label, icon, desc }) => (
              <button
                key={id}
                onClick={() => selectLevel(id)}
                style={{
                  padding: '1rem 1.5rem',
                  background: currentLevel === id ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : 'rgba(255,255,255,0.05)',
                  border: currentLevel === id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  textAlign: 'left',
                  boxShadow: currentLevel === id ? '0 0 20px rgba(108,99,255,0.3)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{icon}</span>
                <div>
                  <p style={{ fontWeight: '600', color: 'white', marginBottom: '0.2rem' }}>{label}</p>
                  <p style={{ color: currentLevel === id ? 'rgba(255,255,255,0.7)' : '#888', fontSize: '0.85rem' }}>{desc}</p>
                </div>
                {currentLevel === id && <span style={{ marginLeft: 'auto', color: 'white' }}>✓</span>}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={skip}
              style={{ flex: 1, padding: '0.85rem', background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem' }}
            >
              Skip
            </button>
            <button
              onClick={next}
              disabled={!currentLevel || saving}
              style={{ flex: 2, padding: '0.85rem', background: currentLevel ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : 'rgba(255,255,255,0.05)', color: currentLevel ? 'white' : '#555', border: 'none', borderRadius: '10px', cursor: currentLevel ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', fontWeight: '600' }}
            >
              {saving ? 'Saving...' : currentIndex < games.length - 1 ? 'Next →' : 'Done ✓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}