import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const LEVEL_ICONS = { beginner: '🌱', intermediate: '⚡', pro: '🔥' }
const PLATFORM_ICONS = { steam: '🖥️', epic: '🎮', playstation: '🎮', xbox: '🟢', nintendo: '🔴', mobile: '📱' }

export default function UserProfile() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mutualGames, setMutualGames] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(profileData)

      const { data: me } = await supabase.from('profiles').select('hobbies').eq('id', user.id).single()
      const mutual = (profileData?.hobbies || []).filter(h => (me?.hobbies || []).includes(h))
      setMutualGames(mutual)

      const { data: sent } = await supabase.from('connections').select('*').eq('sender_id', user.id).eq('receiver_id', userId).single()
      const { data: received } = await supabase.from('connections').select('*').eq('receiver_id', user.id).eq('sender_id', userId).single()
      if (sent) setConnectionStatus(sent.status)
      else if (received) setConnectionStatus(received.status)

      setLoading(false)
    }
    load()
  }, [userId])

  const sendRequest = async () => {
    const { error } = await supabase.from('connections').insert({
      sender_id: currentUser.id,
      receiver_id: userId
    })
    if (error) alert(error.message)
    else setConnectionStatus('pending')
  }

  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const name = profile?.username || profile?.email?.split('@')[0] || 'Player'
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length]

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
      <p style={{ color: '#888' }}>Loading profile...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '2rem' }}>
      <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', padding: 0, marginBottom: '1.5rem' }}>
        ← Back
      </button>

      {/* Header */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem' }} />
        ) : (
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '2rem', margin: '0 auto 1rem' }}>
            {name[0]?.toUpperCase()}
          </div>
        )}
        <h2 style={{ fontWeight: '700', fontSize: '1.5rem', marginBottom: '0.25rem' }}>{name}</h2>
        {mutualGames.length > 0 && (
          <p style={{ color: '#a78bfa', fontSize: '0.85rem', marginBottom: '1rem' }}>🎮 {mutualGames.length} game{mutualGames.length > 1 ? 's' : ''} in common</p>
        )}

        {/* Platforms */}
        {profile?.platforms?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {profile.platforms.map(p => (
              <span key={p} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '100px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', color: '#ccc' }}>
                {PLATFORM_ICONS[p] || '🎮'} {p.charAt(0).toUpperCase() + p.slice(1)}
              </span>
            ))}
          </div>
        )}

        {/* Connect button */}
        {currentUser?.id !== userId && (
          connectionStatus === 'accepted' ? (
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={() => navigate(`/chat/${userId}`)} style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>
                💬 Message
              </button>
              <span style={{ padding: '0.75rem 1.5rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', fontWeight: '600', fontSize: '0.9rem' }}>
                ✓ Connected
              </span>
            </div>
          ) : connectionStatus === 'pending' ? (
            <span style={{ padding: '0.75rem 1.5rem', background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontWeight: '600', fontSize: '0.9rem' }}>
              ⏳ Request Pending
            </span>
          ) : (
            <button onClick={sendRequest} style={{ padding: '0.75rem 2rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.95rem', boxShadow: '0 0 20px rgba(108,99,255,0.3)' }}>
              + Connect
            </button>
          )
        )}
      </div>

      {/* Games & Levels */}
      {profile?.hobbies?.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: '700', marginBottom: '1rem', fontSize: '1rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Games</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {profile.hobbies.map(game => {
              const level = profile.game_levels?.[game]
              const isMutual = mutualGames.includes(game)
              return (
                <div key={game} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: isMutual ? 'rgba(108,99,255,0.08)' : 'rgba(255,255,255,0.02)', borderRadius: '10px', border: isMutual ? '1px solid rgba(108,99,255,0.2)' : '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isMutual && <span style={{ fontSize: '0.7rem', color: '#a78bfa' }}>●</span>}
                    <p style={{ fontWeight: '500', fontSize: '0.95rem' }}>{game}</p>
                  </div>
                  {level && (
                    <span style={{ fontSize: '0.85rem', color: '#888' }}>
                      {LEVEL_ICONS[level]} {level.charAt(0).toUpperCase() + level.slice(1)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          {mutualGames.length > 0 && (
            <p style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.75rem' }}>● Games you both play</p>
          )}
        </div>
      )}
    </div>
  )
}
