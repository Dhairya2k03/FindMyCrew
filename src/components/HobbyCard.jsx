import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']

const isActivelyPlaying = (profile) => {
  if (!profile?.currently_playing || !profile?.currently_playing_at) return false
  return (new Date() - new Date(profile.currently_playing_at)) < 4 * 60 * 60 * 1000 // 4hr window
}

export default function HobbyCard({ profile, currentUserId, connectionStatus, theme }) {
  const [status, setStatus] = useState(connectionStatus)
  const navigate = useNavigate()

  const isLight = theme === 'light'

  const cardBg      = isLight ? 'rgba(0,0,0,0.03)'        : 'rgba(255,255,255,0.03)'
  const cardBorder  = isLight ? 'rgba(0,0,0,0.09)'         : 'rgba(255,255,255,0.08)'
  const cardHover   = isLight ? 'rgba(108,99,255,0.25)'    : 'rgba(108,99,255,0.3)'
  const textPrimary = isLight ? '#111'                      : '#fff'
  const tagBg       = isLight ? 'rgba(108,99,255,0.12)'    : 'rgba(108,99,255,0.2)'
  const tagColor    = isLight ? '#5b52d6'                   : '#a78bfa'
  const tagBorder   = isLight ? 'rgba(108,99,255,0.25)'    : 'rgba(108,99,255,0.3)'

  const sendRequest = async (e) => {
    e.stopPropagation()
    const { error } = await supabase.from('connections').insert({
      sender_id: currentUserId,
      receiver_id: profile.id,
    })
    if (error) alert(error.message)
    else setStatus('pending')
  }

  const name    = profile.username || profile.email?.split('@')[0] || 'Player'
  const color   = avatarColors[name.charCodeAt(0) % avatarColors.length]
  const initial = name[0]?.toUpperCase()
  const playing = isActivelyPlaying(profile)

  const getButtonLabel = () => {
    if (status === 'accepted') return '✓ Connected'
    if (status === 'pending')  return '⏳ Pending'
    return '+ Connect'
  }

  const getButtonStyle = () => ({
    width: '100%',
    padding: '0.6rem',
    background:
      status === 'accepted' ? 'rgba(16,185,129,0.15)' :
      status === 'pending'  ? (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)') :
      'linear-gradient(135deg, #6c63ff, #a78bfa)',
    color:
      status === 'accepted' ? '#10b981' :
      status === 'pending'  ? '#888' :
      'white',
    border:
      status === 'accepted' ? '1px solid rgba(16,185,129,0.3)' :
      status === 'pending'  ? `1px solid ${isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}` :
      'none',
    borderRadius: '8px',
    cursor: status ? 'default' : 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
    fontFamily: 'Inter, sans-serif',
  })

  return (
    <div
      onClick={() => navigate(`/user/${profile.id}`)}
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: '16px',
        padding: '1.25rem',
        width: '100%',
        boxSizing: 'border-box',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = cardHover}
      onMouseLeave={e => e.currentTarget.style.borderColor = cardBorder}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={name}
            style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: '42px', height: '42px', borderRadius: '50%',
            background: color, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontWeight: '700', fontSize: '1.1rem',
            flexShrink: 0, color: 'white',
          }}>
            {initial}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: textPrimary, wordBreak: 'break-word', margin: 0 }}>
            {name}
          </h3>
          {playing && (
            <p style={{ fontSize: '0.72rem', color: '#10b981', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
              Playing {profile.currently_playing}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '1rem' }}>
        {(profile.hobbies || []).map(h => (
          <span key={h} style={{
            background: tagBg,
            color: tagColor,
            padding: '3px 10px',
            borderRadius: '100px',
            fontSize: '0.75rem',
            fontWeight: '500',
            border: `1px solid ${tagBorder}`,
          }}>
            {h}
          </span>
        ))}
      </div>

      <button
        onClick={status ? e => e.stopPropagation() : sendRequest}
        style={getButtonStyle()}
      >
        {getButtonLabel()}
      </button>
    </div>
  )
}