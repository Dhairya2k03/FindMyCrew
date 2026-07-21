import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const RANK_STYLE = {
  1: { icon: '🥇', color: '#f5c842' },
  2: { icon: '🥈', color: '#c0c5ce' },
  3: { icon: '🥉', color: '#cd7f32' },
}

export default function Leaderboard({ theme }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [achievementCounts, setAchievementCounts] = useState({})
  const navigate = useNavigate()

  const isLight = theme === 'light'
  const bg          = isLight ? '#f0f0f7'          : '#0f0f1a'
  const border      = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const textColor   = isLight ? '#111'             : 'white'
  const mutedColor  = isLight ? '#555'              : '#888'
  const cardBg      = isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.03)'

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, email, avatar_url, points')
        .order('points', { ascending: false })
        .limit(50)
      setRows(profiles || [])

      const ids = (profiles || []).map(p => p.id)
      if (ids.length > 0) {
        const { data: ach } = await supabase.from('achievements').select('user_id').in('user_id', ids)
        const counts = {}
        ach?.forEach(a => { counts[a.user_id] = (counts[a.user_id] || 0) + 1 })
        setAchievementCounts(counts)
      }

      setLoading(false)
    }
    load()
  }, [])

  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const getColor = (name) => avatarColors[(name || '?').charCodeAt(0) % avatarColors.length]

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: bg, padding: '2rem' }}>
      <div style={{ maxWidth: '650px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.4rem', color: textColor }}>🏆 Leaderboard</h2>
        <p style={{ color: mutedColor, marginBottom: '2rem' }}>Top players by activity points</p>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1,2,3,4,5].map(i => <div key={i} style={{ height: '64px', background: cardBg, border: `1px solid ${border}`, borderRadius: '14px', animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : rows.length === 0 ? (
          <p style={{ color: mutedColor }}>No players yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {rows.map((p, idx) => {
              const rank = idx + 1
              const name = p.username || p.email?.split('@')[0] || 'Player'
              const isMe = p.id === currentUser?.id
              const rankStyle = RANK_STYLE[rank]
              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/user/${p.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.25rem',
                    background: isMe ? 'rgba(108,99,255,0.08)' : cardBg,
                    border: isMe ? '1px solid rgba(108,99,255,0.3)' : `1px solid ${border}`,
                    borderRadius: '14px', cursor: 'pointer'
                  }}
                >
                  <div style={{ width: '32px', textAlign: 'center', flexShrink: 0 }}>
                    {rankStyle ? (
                      <span style={{ fontSize: '1.3rem' }}>{rankStyle.icon}</span>
                    ) : (
                      <span style={{ color: mutedColor, fontWeight: '700', fontSize: '0.95rem' }}>#{rank}</span>
                    )}
                  </div>
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt={name} style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: getColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', flexShrink: 0 }}>{name[0]?.toUpperCase()}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: '600', color: textColor, margin: 0 }}>{name}{isMe ? ' (you)' : ''}</p>
                    <p style={{ color: mutedColor, fontSize: '0.78rem', margin: 0 }}>🏅 {achievementCounts[p.id] || 0} achievement{achievementCounts[p.id] === 1 ? '' : 's'}</p>
                  </div>
                  <p style={{ fontWeight: '800', fontSize: '1.1rem', color: rankStyle?.color || '#a78bfa', margin: 0, flexShrink: 0 }}>{p.points || 0}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  )
}