import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '12px', padding: '1.25rem', width: '220px', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ marginBottom: '0.75rem', color: '#1a1a2e' }}>
        {profile.username || profile.email?.split('@')[0]}
      </h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.75rem' }}>
        {(profile.hobbies || []).map(h => (
          <span key={h} style={{ background: '#6c63ff', color: 'white', padding: '3px 10px', borderRadius: '12px', fontSize: '0.75rem' }}>
            {h}
          </span>
        ))}
      </div>
      <button
        onClick={sendRequest}
        disabled={status === 'pending'}
        style={{
          width: '100%',
          padding: '0.5rem',
          background: status === 'pending' ? '#ccc' : '#6c63ff',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: status === 'pending' ? 'default' : 'pointer',
          fontSize: '0.9rem'
        }}
      >
        {status === 'pending' ? 'Request Sent ✓' : 'Connect'}
      </button>
    </div>
  )
}