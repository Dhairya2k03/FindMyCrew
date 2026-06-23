import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']

export default function HobbyCard({ profile, currentUserId, connectionStatus }) {
  const [status, setStatus] = useState(connectionStatus)

  const sendRequest = async () => {
    const { error } = await supabase.from('connections').insert({
      sender_id: currentUserId,
      receiver_id: profile.id
    })
    if (error) alert(error.message)
    else setStatus('pending')
  }

  const name = profile.username || profile.email?.split('@')[0] || 'Player'
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length]
  const initial = name[0]?.toUpperCase()

  const getButtonLabel = () => {
    if (status === 'accepted') return '✓ Connected'
    if (status === 'pending') return '⏳ Pending'
    return '+ Connect'
  }

  const getButtonStyle = () => ({
    width: '100%',
    padding: '0.6rem',
    background: status === 'accepted' ? 'rgba(16, 185, 129, 0.15)' : status === 'pending' ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #6c63ff, #a78bfa)',
    color: status === 'accepted' ? '#10b981' : status === 'pending' ? '#888' : 'white',
    border: status ? '1px solid rgba(255,255,255,0.1)' : 'none',
    borderRadius: '8px',
    cursor: status ? 'default' : 'pointer',
    fontSize: '0.85rem',
    fontWeight: '600',
    fontFamily: 'Inter, sans-serif'
  })

  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt={name} style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.1rem', flexShrink: 0 }}>
            {initial}
          </div>
        )}
        <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff', wordBreak: 'break-word' }}>{name}</h3>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '1rem' }}>
        {(profile.hobbies || []).map(h => (
          <span key={h} style={{ background: 'rgba(108, 99, 255, 0.2)', color: '#a78bfa', padding: '3px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: '500', border: '1px solid rgba(108, 99, 255, 0.3)' }}>
            {h}
          </span>
        ))}
      </div>

      <button onClick={status ? null : sendRequest} style={getButtonStyle()}>
        {getButtonLabel()}
      </button>
    </div>
  )
}