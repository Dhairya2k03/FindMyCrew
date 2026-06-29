import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const ADMIN_USER_ID = '87d930f5-4ea4-44f5-9f3e-3f1fbf254c38'

const LEVEL_ICONS = { beginner: '🌱', intermediate: '⚡', pro: '🔥' }
const PLATFORM_ICONS = { steam: '🖥️', epic: '🎮', playstation: '🎮', xbox: '🟢', nintendo: '🔴', mobile: '📱' }

const ACHIEVEMENT_CONFIG = {
  first_connection: { label: 'First Connection', icon: '🤝', desc: 'Made your first connection' },
  five_connections: { label: 'Social Butterfly', icon: '🦋', desc: 'Connected with 5 players' },
  first_group: { label: 'Team Player', icon: '👥', desc: 'Joined your first group' },
  group_leader: { label: 'Leader', icon: '👑', desc: 'Created a group' },
  profile_complete: { label: 'All Set', icon: '✅', desc: 'Completed your profile' },
}

export default function UserProfile({ theme }) {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mutualGames, setMutualGames] = useState([])
  const [isBlocked, setIsBlocked] = useState(false)
  const [achievements, setAchievements] = useState([])
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')

  const isLight = theme === 'light'
  const cardBg    = isLight ? 'rgba(0,0,0,0.03)'       : 'rgba(255,255,255,0.03)'
  const cardBorder= isLight ? 'rgba(0,0,0,0.08)'        : 'rgba(255,255,255,0.08)'
  const textColor = isLight ? '#111'                     : 'white'
  const mutedColor= isLight ? '#555'                     : '#aaa'
  const tagBg     = isLight ? 'rgba(0,0,0,0.04)'        : 'rgba(255,255,255,0.05)'
  const tagBorder = isLight ? 'rgba(0,0,0,0.1)'         : 'rgba(255,255,255,0.1)'
  const tagColor  = isLight ? '#444'                     : '#ccc'
  const gameBg    = isLight ? 'rgba(0,0,0,0.02)'        : 'rgba(255,255,255,0.02)'
  const gameBorder= isLight ? 'rgba(0,0,0,0.06)'        : 'rgba(255,255,255,0.05)'
  const inputBg   = isLight ? 'rgba(0,0,0,0.04)'        : 'rgba(255,255,255,0.05)'
  const inputBorder=isLight ? 'rgba(0,0,0,0.1)'         : 'rgba(255,255,255,0.1)'

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
      try {
        const { data: blocked } = await supabase.from('blocked_users').select('id').eq('blocker_id', user.id).eq('blocked_id', userId).single()
        setIsBlocked(!!blocked)
      } catch {}
      const { data: ach } = await supabase.from('achievements').select('*').eq('user_id', userId)
      setAchievements(ach || [])
      setLoading(false)
    }
    load()
  }, [userId])

  const sendRequest = async () => {
    const { error } = await supabase.from('connections').insert({ sender_id: currentUser.id, receiver_id: userId })
    if (error) alert(error.message)
    else setConnectionStatus('pending')
  }

  const toggleBlock = async () => {
    if (isBlocked) {
      await supabase.from('blocked_users').delete().eq('blocker_id', currentUser.id).eq('blocked_id', userId)
      setIsBlocked(false)
    } else {
      await supabase.from('blocked_users').insert({ blocker_id: currentUser.id, blocked_id: userId })
      setIsBlocked(true)
    }
  }

  const submitReport = async () => {
    if (!reportReason.trim()) return alert('Please enter a reason')
    const reporterProfile = await supabase.from('profiles').select('username').eq('id', currentUser.id).single()
    const reporterName = reporterProfile.data?.username || 'Someone'
    await supabase.from('reports').insert({
      reporter_id: currentUser.id,
      reported_user_id: userId,
      context_type: 'profile',
      context_id: userId,
      reason: reportReason.trim()
    })
    await supabase.from('notifications').insert({
      user_id: ADMIN_USER_ID,
      type: 'report',
      content: `🚨 ${reporterName} reported user "${profile?.username || userId}": "${reportReason.trim()}"`,
      read: false
    })
    setShowReportModal(false)
    setReportReason('')
    alert('Report submitted. Our team has been notified.')
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', padding: 0 }}>← Back</button>
        {currentUser?.id !== userId && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setShowReportModal(true)} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '8px', padding: '0.4rem 0.85rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>
              🚨 Report
            </button>
            <button onClick={toggleBlock} style={{ background: isBlocked ? 'rgba(239,68,68,0.1)' : 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '8px', padding: '0.4rem 0.85rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>
              {isBlocked ? '🚫 Unblock' : '🚫 Block'}
            </button>
          </div>
        )}
      </div>

      {/* Report modal */}
      {showReportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: isLight ? '#f0f0f7' : '#1a1a2e', border: `1px solid ${cardBorder}`, borderRadius: '16px', padding: '1.5rem', width: '90%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 style={{ fontWeight: '700', fontSize: '1rem', color: '#ef4444', margin: 0 }}>🚨 Report User</h3>
            <p style={{ color: mutedColor, fontSize: '0.85rem', margin: 0 }}>Reporting <strong style={{ color: textColor }}>{name}</strong>. Describe what happened:</p>
            <textarea
              placeholder="Describe the reason for reporting..."
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              rows={3}
              style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)', background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none', resize: 'none' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={submitReport} style={{ flex: 1, padding: '0.75rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>Submit Report</button>
              <button onClick={() => { setShowReportModal(false); setReportReason('') }} style={{ padding: '0.75rem 1rem', background: 'transparent', color: mutedColor, border: `1px solid ${cardBorder}`, borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '20px', padding: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem' }} />
        ) : (
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '2rem', margin: '0 auto 1rem', color: 'white' }}>
            {name[0]?.toUpperCase()}
          </div>
        )}
        <h2 style={{ fontWeight: '700', fontSize: '1.5rem', marginBottom: '0.25rem', color: textColor }}>{name}</h2>

        {profile?.bio && <p style={{ color: mutedColor, fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5, maxWidth: '400px', margin: '0 auto 1rem' }}>{profile.bio}</p>}

        {mutualGames.length > 0 && <p style={{ color: '#a78bfa', fontSize: '0.85rem', marginBottom: '1rem' }}>🎮 {mutualGames.length} game{mutualGames.length > 1 ? 's' : ''} in common</p>}

        {profile?.discord_username && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(88,101,242,0.15)', border: '1px solid rgba(88,101,242,0.3)', borderRadius: '100px', padding: '0.3rem 0.9rem', marginBottom: '1rem' }}>
            <span>💬</span>
            <span style={{ color: '#a5b4fc', fontSize: '0.85rem', fontWeight: '600' }}>{profile.discord_username}</span>
          </div>
        )}

        {profile?.platforms?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {profile.platforms.map(p => (
              <span key={p} style={{ background: tagBg, border: `1px solid ${tagBorder}`, borderRadius: '100px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', color: tagColor }}>
                {PLATFORM_ICONS[p] || '🎮'} {p.charAt(0).toUpperCase() + p.slice(1)}
              </span>
            ))}
          </div>
        )}

        {currentUser?.id !== userId && !isBlocked && (
          connectionStatus === 'accepted' ? (
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={() => navigate(`/chat/${userId}`)} style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>💬 Message</button>
              <span style={{ padding: '0.75rem 1.5rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', fontWeight: '600', fontSize: '0.9rem' }}>✓ Connected</span>
            </div>
          ) : connectionStatus === 'pending' ? (
            <span style={{ padding: '0.75rem 1.5rem', background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', color: mutedColor, border: `1px solid ${cardBorder}`, borderRadius: '10px', fontWeight: '600', fontSize: '0.9rem' }}>⏳ Request Pending</span>
          ) : (
            <button onClick={sendRequest} style={{ padding: '0.75rem 2rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.95rem', boxShadow: '0 0 20px rgba(108,99,255,0.3)' }}>+ Connect</button>
          )
        )}
        {isBlocked && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>You have blocked this user.</p>}
      </div>

      {achievements.length > 0 && (
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: '700', marginBottom: '1rem', fontSize: '1rem', color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Achievements</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {achievements.map(a => {
              const cfg = ACHIEVEMENT_CONFIG[a.type]
              if (!cfg) return null
              return (
                <div key={a.id} title={cfg.desc} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '100px', padding: '0.3rem 0.85rem' }}>
                  <span>{cfg.icon}</span>
                  <span style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: '600' }}>{cfg.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {profile?.hobbies?.length > 0 && (
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '20px', padding: '1.5rem' }}>
          <h3 style={{ fontWeight: '700', marginBottom: '1rem', fontSize: '1rem', color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Games</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {profile.hobbies.map(game => {
              const level = profile.game_levels?.[game]
              const isMutual = mutualGames.includes(game)
              return (
                <div key={game} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: isMutual ? 'rgba(108,99,255,0.08)' : gameBg, borderRadius: '10px', border: isMutual ? '1px solid rgba(108,99,255,0.2)' : `1px solid ${gameBorder}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isMutual && <span style={{ fontSize: '0.7rem', color: '#a78bfa' }}>●</span>}
                    <p style={{ fontWeight: '500', fontSize: '0.95rem', color: textColor }}>{game}</p>
                  </div>
                  {level && <span style={{ fontSize: '0.85rem', color: mutedColor }}>{LEVEL_ICONS[level]} {level.charAt(0).toUpperCase() + level.slice(1)}</span>}
                </div>
              )
            })}
          </div>
          {mutualGames.length > 0 && <p style={{ color: mutedColor, fontSize: '0.75rem', marginTop: '0.75rem' }}>● Games you both play</p>}
        </div>
      )}
    </div>
  )
}