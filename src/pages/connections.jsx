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

  if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>

  const pendingReceived = received.filter(c => c.status === 'pending')
  const acceptedReceived = received.filter(c => c.status === 'accepted')

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Connections</h2>

      <h3 style={{ marginBottom: '1rem', color: '#1a1a2e' }}>Incoming Requests ({pendingReceived.length})</h3>
      {pendingReceived.length === 0 ? (
        <p style={{ color: '#555', marginBottom: '2rem' }}>No pending requests.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          {pendingReceived.map(c => (
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

      <h3 style={{ marginBottom: '1rem', color: '#1a1a2e' }}>Connected ({acceptedReceived.length + sent.filter(c => c.status === 'accepted').length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
        {acceptedReceived.map(c => (
          <div key={c.id} style={{ border: '1px solid #ddd', borderRadius: '12px', padding: '1rem', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 'bold' }}>{c.sender?.username || c.sender?.email?.split('@')[0]}</p>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                {(c.sender?.hobbies || []).map(h => (
                  <span key={h} style={{ background: '#6c63ff', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{h}</span>
                ))}
              </div>
            </div>
            <button onClick={() => navigate(`/chat/${c.sender_id}`)} style={{ padding: '0.4rem 1rem', background: '#6c63ff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Message</button>
          </div>
        ))}
        {sent.filter(c => c.status === 'accepted').map(c => (
          <div key={c.id} style={{ border: '1px solid #ddd', borderRadius: '12px', padding: '1rem', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontWeight: 'bold' }}>{c.receiver?.username || c.receiver?.email?.split('@')[0]}</p>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                {(c.receiver?.hobbies || []).map(h => (
                  <span key={h} style={{ background: '#6c63ff', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{h}</span>
                ))}
              </div>
            </div>
            <button onClick={() => navigate(`/chat/${c.receiver_id}`)} style={{ padding: '0.4rem 1rem', background: '#6c63ff', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Message</button>
          </div>
        ))}
      </div>

      <h3 style={{ marginBottom: '1rem', color: '#1a1a2e' }}>Pending Sent ({sent.filter(c => c.status === 'pending').length})</h3>
      {sent.filter(c => c.status === 'pending').length === 0 ? (
        <p style={{ color: '#555' }}>No pending sent requests.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sent.filter(c => c.status === 'pending').map(c => (
            <div key={c.id} style={{ border: '1px solid #ddd', borderRadius: '12px', padding: '1rem', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 'bold' }}>{c.receiver?.username || c.receiver?.email?.split('@')[0]}</p>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
                  {(c.receiver?.hobbies || []).map(h => (
                    <span key={h} style={{ background: '#6c63ff', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem' }}>{h}</span>
                  ))}
                </div>
              </div>
              <span style={{ fontSize: '0.85rem', color: '#888', fontWeight: 'bold' }}>⏳ Pending</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}