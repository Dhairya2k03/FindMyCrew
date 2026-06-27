import { useState, useEffect, useRef } from 'react'

export default function VoiceChat({ roomName, onClose }) {
  const [status, setStatus] = useState('connecting') // connecting | connected | error
  const [participants, setParticipants] = useState([])
  const [muted, setMuted] = useState(false)
  const callRef = useRef(null)

  useEffect(() => {
    const start = async () => {
      try {
        const DailyIframe = (await import('@daily-co/daily-js')).default

        // Create room via Daily API
        const res = await fetch('https://api.daily.co/v1/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_DAILY_API_KEY}`
          },
          body: JSON.stringify({
            name: roomName,
            properties: {
              exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
              enable_chat: false,
              enable_screenshare: false,
            }
          })
        })

        const room = await res.json()
        const url = room.url || `https://${import.meta.env.VITE_DAILY_DOMAIN}.daily.co/${roomName}`

        const call = DailyIframe.createCallObject({
          audioSource: true,
          videoSource: false,
        })

        callRef.current = call

        call.on('joined-meeting', () => setStatus('connected'))
        call.on('participant-joined', () => setParticipants(Object.values(call.participants())))
        call.on('participant-left', () => setParticipants(Object.values(call.participants())))
        call.on('error', () => setStatus('error'))

        await call.join({ url })
        setParticipants(Object.values(call.participants()))
      } catch (err) {
        console.error('Voice chat error:', err)
        setStatus('error')
      }
    }

    start()

    return () => {
      if (callRef.current) {
        callRef.current.leave()
        callRef.current.destroy()
      }
    }
  }, [roomName])

  const toggleMute = async () => {
    if (!callRef.current) return
    await callRef.current.setLocalAudio(muted)
    setMuted(!muted)
  }

  const leave = async () => {
    if (callRef.current) {
      await callRef.current.leave()
      callRef.current.destroy()
    }
    onClose()
  }

  return (
    <div style={{ position: 'fixed', bottom: '100px', right: '2rem', background: '#1a1a2e', border: '1px solid rgba(108,99,255,0.3)', borderRadius: '16px', padding: '1.25rem', width: '260px', zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: status === 'connected' ? '#10b981' : status === 'error' ? '#ef4444' : '#f59e0b', animation: status === 'connecting' ? 'pulse 1s infinite' : 'none' }} />
          <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>
            {status === 'connecting' ? 'Connecting...' : status === 'error' ? 'Error' : 'Voice Chat'}
          </p>
        </div>
        <button onClick={leave} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
      </div>

      {status === 'error' && (
        <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>Failed to connect. Check your API key.</p>
      )}

      {status === 'connected' && (
        <div style={{ marginBottom: '1rem' }}>
          <p style={{ color: '#888', fontSize: '0.75rem', marginBottom: '0.5rem' }}>In call ({participants.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {participants.map(p => (
              <div key={p.session_id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.audio ? '#10b981' : '#555' }} />
                <p style={{ fontSize: '0.8rem', color: '#ccc' }}>{p.local ? 'You' : (p.user_name || 'Player')}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={toggleMute}
          disabled={status !== 'connected'}
          style={{ flex: 1, padding: '0.6rem', background: muted ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: muted ? '#ef4444' : '#10b981', border: muted ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem' }}
        >
          {muted ? '🔇 Muted' : '🎙️ Live'}
        </button>
        <button
          onClick={leave}
          style={{ flex: 1, padding: '0.6rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem' }}
        >
          📵 Leave
        </button>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  )
}