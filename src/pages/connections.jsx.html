import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Connections() {
  const [received, setReceived] = useState([])
  const [sent, setSent] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data: receivedData } = await supabase
        .from('connections')
        .select('*, sender:sender_id(id, username, email, hobbies)')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')

      const { data: sentData } = await supabase
        .from('connections')
        .select('*, receiver:receiver_id(id, username, email, hobbies)')
        .eq('sender_id', user.id)

      setReceived(receivedData || [])
      setSent(sentData || [])
      setLoading(false)
    }
    load()
  }, [])

  const respond = async (connectionId, status) => {
    const { error } = await supabase
      .from('connections')
      .update({ status })
      .eq('id', connectionId)
    if (error) alert(error.message)
    else setReceived(prev => prev.filter(c => c.id !== connectionId))
  }

  if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Connections</h2>

      <h3 style={{ marginBottom: '1rem', color: '#1a1a2e' }}>Incoming Requests ({received.length})</h3>
      {received.length === 0 ? (
        <p style={{ color: '#555', marginBottom: '2rem' }}>No pending requests.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {received.map(c => (
            <div key={c.id} style={{ border: '1px solid #ddd', borderRadius: '12px', padding: '1rem', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 'bold' }}>{c.sender?.username || c.sender?.email?.split('@')[0]}</p>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                  {(c.sender?.hobbies || []).map(h => (
                    <span key={h} style={{ background: '#6c63ff', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{h}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => respond(c.id, 'accepted')} style={{ padding: '0.4rem 1rem', background: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Accept</button>
                <button onClick={() => respond(c.id, 'declined')} style={{ padding: '0.4rem 1rem', background: '#f44336', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ marginBottom: '1rem', color: '#1a1a2e' }}>Sent Requests ({sent.length})</h3>
      {sent.length === 0 ? (
        <p style={{ color: '#555' }}>No sent requests yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sent.map(c => (
            <div key={c.id} style={{ border: '1px solid #ddd', borderRadius: '12px', padding: '1rem', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 'bold' }}>{c.receiver?.username || c.receiver?.email?.split('@')[0]}</p>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                  {(c.receiver?.hobbies || []).map(h => (
                    <span key={h} style={{ background: '#6c63ff', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{h}</span>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: '0.85rem', color: c.status === 'accepted' ? 'green' : c.status === 'declined' ? 'red' : '#888', fontWeight: 'bold' }}>
                {c.status === 'accepted' ? '✓ Connected' : c.status === 'declined' ? '✗ Declined' : '⏳ Pending'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}