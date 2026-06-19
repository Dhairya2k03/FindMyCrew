import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Connections() {
  const [received, setReceived] = useState([])
  const [sent, setSent] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: receivedData } = await supabase
        .from('connections')
        .select('*')
        .eq('receiver_id', user.id)

      const { data: sentData } = await supabase
        .from('connections')
        .select('*')
        .eq('sender_id', user.id)

      const ids = [
        ...(receivedData || []).map(c => c.sender_id),
        ...(sentData || []).map(c => c.receiver_id)
      ]

      let profileMap = {}
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', ids)
        profiles?.forEach(p => { profileMap[p.id] = p })
      }

      setReceived((receivedData || []).map(c => ({ ...c, sender: profileMap[c.sender_id] })))
      setSent((sentData || []).map(c => ({ ...c, receiver: profileMap[c.receiver_id] })))
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
    else setReceived(prev => prev.map(c => c.id === connectionId ? { ...c, status } : c))
  }

  if (loading) return <p style={{ padding: '2rem', color: '#888' }}>Loading...</p>

  const pendingReceived = received.filter(c => c.status === 'pending')
  const acceptedReceived = received.filter(c => c.status === 'accepted')
  const acceptedSent = sent.filter(c => c.status === 'accepted')
  const pendingSent = sent.filter(c => c.status === 'pending')

  const cardStyle = {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '12px',
    padding: '1rem 1.5rem',
    background: 'rgba(255,255,255,0.03)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  }

  const tagStyle = {
    background: 'rgba(108, 99, 255, 0.2)',
    color: '#a78bfa',
    padding: '2px 8px',
    borderRadius: '100px',
    fontSize: '0.75rem',
    border: '1px solid rgba(108, 99, 255, 0.3)'
  }

  const btnStyle = {
    padding: '0.5rem 1.25rem',
    background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    fontWeight: '600',
    fontSize: '0.9rem'
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '650px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '2rem' }}>Connections</h2>

      {/* Incoming Requests */}
      <h3 style={{ marginBottom: '1rem', color: '#a78bfa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Incoming Requests ({pendingReceived.length})
      </h3>
      {pendingReceived.length === 0 ? (
        <p style={{ color: '#555', marginBottom: '2rem' }}>No pending requests.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {pendingReceived.map(c => (
            <div key={c.id} style={cardStyle}>
              <div>
                <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                  {c.sender?.username || c.sender?.email?.split('@')[0] || 'Unknown'}
                </p>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {(c.sender?.hobbies || []).map(h => (
                    <span key={h} style={tagStyle}>{h}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => respond(c.id, 'accepted')} style={{ ...btnStyle, background: 'linear-gradient(135deg, #10b981, #34d399)' }}>Accept</button>
                <button onClick={() => respond(c.id, 'declined')} style={{ ...btnStyle, background: 'rgba(255,255,255,0.05)', color: '#888', border: '1px solid rgba(255,255,255,0.1)' }}>Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Connected */}
      <h3 style={{ marginBottom: '1rem', color: '#a78bfa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Connected ({acceptedReceived.length + acceptedSent.length})
      </h3>
      {acceptedReceived.length === 0 && acceptedSent.length === 0 ? (
        <p style={{ color: '#555', marginBottom: '2rem' }}>No connections yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {acceptedReceived.map(c => (
            <div key={c.id} style={cardStyle}>
              <div>
                <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                  {c.sender?.username || c.sender?.email?.split('@')[0] || 'Unknown'}
                </p>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {(c.sender?.hobbies || []).map(h => (
                    <span key={h} style={tagStyle}>{h}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => navigate(`/chat/${c.sender_id}`)} style={btnStyle}>Message</button>
            </div>
          ))}
          {acceptedSent.map(c => (
            <div key={c.id} style={cardStyle}>
              <div>
                <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                  {c.receiver?.username || c.receiver?.email?.split('@')[0] || 'Unknown'}
                </p>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {(c.receiver?.hobbies || []).map(h => (
                    <span key={h} style={tagStyle}>{h}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => navigate(`/chat/${c.receiver_id}`)} style={btnStyle}>Message</button>
            </div>
          ))}
        </div>
      )}

      {/* Pending Sent */}
      <h3 style={{ marginBottom: '1rem', color: '#a78bfa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Pending Sent ({pendingSent.length})
      </h3>
      {pendingSent.length === 0 ? (
        <p style={{ color: '#555' }}>No pending sent requests.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {pendingSent.map(c => (
            <div key={c.id} style={cardStyle}>
              <div>
                <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                  {c.receiver?.username || c.receiver?.email?.split('@')[0] || 'Unknown'}
                </p>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {(c.receiver?.hobbies || []).map(h => (
                    <span key={h} style={tagStyle}>{h}</span>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: '0.85rem', color: '#888', fontWeight: '500' }}>⏳ Pending</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}