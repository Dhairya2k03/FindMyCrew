import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const features = [
  { icon: '🎮', title: 'Gaming', desc: 'Find players for FPS, RPG, Battle Royale and more' },
  { icon: '🤝', title: 'Connect', desc: 'Send connection requests to people who share your interests' },
  { icon: '💬', title: 'Chat', desc: 'Message your crew directly in the app' },
]

export default function Home({ theme }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [suggestions, setSuggestions] = useState([])
  const [connectionsSent, setConnectionsSent] = useState({})
  const navigate = useNavigate()

  const isLight = theme === 'light'
  const bg = isLight ? '#f0f0f7' : '#0f0f1a'
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const textColor = isLight ? '#111' : 'white'
  const mutedColor = isLight ? '#555' : '#888'
  const cardBg = isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.03)'

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
      if (user) loadSuggestions(user)
    }
    load()
  }, [])

  const loadSuggestions = async (user) => {
    const { data: myProfile } = await supabase.from('profiles').select('hobbies').eq('id', user.id).single()
    const myGames = myProfile?.hobbies || []

    const { data: conns } = await supabase.from('connections').select('sender_id, receiver_id').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    const connectedIds = new Set(conns?.map(c => c.sender_id === user.id ? c.receiver_id : c.sender_id) || [])
    connectedIds.add(user.id)

    const { data: allProfiles } = await supabase.from('profiles').select('id, username, avatar_url, hobbies').neq('id', user.id).limit(50)
    if (!allProfiles) return

    const scored = allProfiles
      .filter(p => !connectedIds.has(p.id))
      .map(p => {
        const mutual = (p.hobbies || []).filter(g => myGames.includes(g))
        return { ...p, mutualCount: mutual.length, mutualGames: mutual }
      })
      .filter(p => p.mutualCount > 0)
      .sort((a, b) => b.mutualCount - a.mutualCount)
      .slice(0, 6)

    setSuggestions(scored)
  }

  const sendRequest = async (targetId) => {
    setConnectionsSent(prev => ({ ...prev, [targetId]: 'pending' }))
    const { error } = await supabase.from('connections').insert({ sender_id: user.id, receiver_id: targetId })
    if (error) {
      setConnectionsSent(prev => ({ ...prev, [targetId]: null }))
      alert(error.message)
    }
  }

  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const getColor = (name) => avatarColors[(name || '?').charCodeAt(0) % avatarColors.length]

  if (loading) return null

  return (
    <div style={{ background: bg, minHeight: 'calc(100vh - 64px)' }}>
      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '4rem 2rem 3rem', background: 'radial-gradient(ellipse at top, rgba(108,99,255,0.15) 0%, transparent 70%)' }}>
        <div style={{ display: 'inline-block', padding: '0.4rem 1rem', background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)', borderRadius: '100px', fontSize: '0.85rem', color: '#a78bfa', marginBottom: '1.5rem' }}>
          🚀 Now in beta
        </div>
        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: '800', lineHeight: 1.1, marginBottom: '1.5rem', background: 'linear-gradient(135deg, #fff 0%, #a78bfa 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Find Your<br />Perfect Crew
        </h1>
        <p style={{ fontSize: '1.2rem', color: mutedColor, maxWidth: '500px', marginBottom: '2.5rem', lineHeight: 1.6 }}>
          Connect with gamers who share your playstyle, schedule, and favorite games. No more solo queues.
        </p>
        {user ? (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => navigate('/browse')} style={{ padding: '0.9rem 2rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 0 30px rgba(108,99,255,0.4)' }}>
              Find Players →
            </button>
            <button onClick={() => navigate('/profile')} style={{ padding: '0.9rem 2rem', background: 'transparent', color: textColor, border: `1px solid ${border}`, borderRadius: '12px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              🎮 Set Up Gaming Profile
            </button>
            <button onClick={() => navigate('/groups')} style={{ padding: '0.9rem 2rem', background: 'transparent', color: textColor, border: `1px solid ${border}`, borderRadius: '12px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              👥 Browse Groups
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link to="/login" style={{ padding: '0.9rem 2rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', borderRadius: '12px', fontSize: '1rem', fontWeight: '700', textDecoration: 'none', boxShadow: '0 0 30px rgba(108,99,255,0.4)' }}>
              Get Started →
            </Link>
            <Link to="/login" style={{ padding: '0.9rem 2rem', background: 'transparent', color: textColor, border: `1px solid ${border}`, borderRadius: '12px', fontSize: '1rem', fontWeight: '600', textDecoration: 'none' }}>
              Sign In
            </Link>
          </div>
        )}
      </div>

      {/* Friend Suggestions */}
      {user && suggestions.length > 0 && (
        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1.5rem 3rem' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: textColor, margin: 0 }}>Players You Might Know</h2>
            <p style={{ color: mutedColor, fontSize: '0.9rem', margin: '0.25rem 0 0' }}>Based on games you both play</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {suggestions.map(p => {
              const name = p.username || 'Player'
              const sent = connectionsSent[p.id]
              return (
                <div key={p.id} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={name} onClick={() => navigate(`/user/${p.id}`)} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', flexShrink: 0 }} />
                    ) : (
                      <div onClick={() => navigate(`/user/${p.id}`)} style={{ width: '48px', height: '48px', borderRadius: '50%', background: getColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.2rem', color: 'white', cursor: 'pointer', flexShrink: 0 }}>
                        {name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: '600', fontSize: '0.95rem', color: textColor, margin: 0, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => navigate(`/user/${p.id}`)}>
                        {name}
                      </p>
                      <p style={{ color: '#a78bfa', fontSize: '0.78rem', margin: 0 }}>
                        🎮 {p.mutualCount} game{p.mutualCount !== 1 ? 's' : ''} in common
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {p.mutualGames.slice(0, 3).map(g => (
                      <span key={g} style={{ background: 'rgba(108,99,255,0.1)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '100px', padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: '500' }}>
                        {g}
                      </span>
                    ))}
                    {p.mutualGames.length > 3 && (
                      <span style={{ color: mutedColor, fontSize: '0.72rem', padding: '0.15rem 0.3rem' }}>+{p.mutualGames.length - 3} more</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => navigate(`/user/${p.id}`)} style={{ flex: 1, padding: '0.5rem', background: 'transparent', color: mutedColor, border: `1px solid ${border}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem' }}>
                      View Profile
                    </button>
                    <button onClick={() => sendRequest(p.id)} disabled={!!sent} style={{ flex: 1, padding: '0.5rem', background: sent ? 'rgba(16,185,129,0.12)' : 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: sent ? '#10b981' : 'white', border: sent ? '1px solid rgba(16,185,129,0.3)' : 'none', borderRadius: '8px', cursor: sent ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: '600' }}>
                      {sent ? '✓ Sent' : '+ Connect'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* No suggestions — prompt to set up profile */}
      {user && suggestions.length === 0 && !loading && (
        <div style={{ maxWidth: '500px', margin: '0 auto', padding: '0 1.5rem 3rem', textAlign: 'center' }}>
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '16px', padding: '2rem' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎮</p>
            <p style={{ fontWeight: '700', fontSize: '1rem', color: textColor, marginBottom: '0.5rem' }}>Set up your gaming profile</p>
            <p style={{ color: mutedColor, fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Add your games and skill levels to get matched with players you might know.
            </p>
            <button onClick={() => navigate('/profile')} style={{ padding: '0.75rem 2rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.95rem' }}>
              🎮 Set Up Gaming Profile
            </button>
          </div>
        </div>
      )}

      {/* Features */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1.5rem 4rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {features.map((f, i) => (
            <div key={i} style={{ padding: '1.5rem', background: cardBg, border: `1px solid ${border}`, borderRadius: '16px', textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.icon}</p>
              <p style={{ fontWeight: '700', fontSize: '1rem', color: textColor, marginBottom: '0.5rem' }}>{f.title}</p>
              <p style={{ color: mutedColor, fontSize: '0.85rem', lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
