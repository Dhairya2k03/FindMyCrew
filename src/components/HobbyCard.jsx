import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']

export default function HobbyCard({ profile, currentUserId }) {
  const [status, setStatus] = useState(null)

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

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px',
      padding: '1.5rem',
      width: '220px',
      transition: 'all 0.2s',
      cursor: 'default'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          background: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '700',
          fontSize: '1.1rem',
          flexShrink: 0
        }}>
          {initial}
        </div>
        <h3 style={{ fontSize: '0.95rem', fontWeight: '600', color: '#fff' }}>{name}</h3>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '1rem' }}>
        {(profile.hobbies || []).map(h => (
          <span key={h} style={{
            background: 'rgba(108, 99, 255, 0.2)',
            color: '#a78bfa',
            padding: '3px 10px',
            borderRadius: '100px',
            fontSize: '0.75rem',
            fontWeight: '500',
            border: '1px solid rgba(108, 99, 255, 0.3)'
          }}>
            {h}
          </span>
        ))}
      </div>

      <button
        onClick={sendRequest}
        disabled={status === 'pending'}
        style={{
          width: '100%',
          padding: '0.6rem',
          background: status === 'pending' ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #6c63ff, #a78bfa)',
          color: status === 'pending' ? '#888' : 'white',
          border: status === 'pending' ? '1px solid rgba(255,255,255,0.1)' : 'none',
          borderRadius: '8px',
          cursor: status === 'pending' ? 'default' : 'pointer',
          fontSize: '0.85rem',
          fontWeight: '600',
          fontFamily: 'Inter, sans-serif'
        }}
      >
        {status === 'pending' ? '✓ Request Sent' : '+ Connect'}
      </button>
    </div>
  )
}