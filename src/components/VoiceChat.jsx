import { useEffect, useRef, useState } from 'react'
import DailyIframe from '@daily-co/daily-js'
import { supabase } from '../lib/supabaseClient'

export default function VoiceChat({ roomName, onClose }) {
  const containerRef = useRef(null)
  const callRef = useRef(null)
  const [status, setStatus] = useState('connecting') // connecting | joined | error

  useEffect(() => {
    let call

    const start = async () => {
      try {
        // Get or create the Daily room via Supabase Edge Function
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-daily-room`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ roomName }),
          }
        )
        const { url } = await res.json()

        call = DailyIframe.createFrame(containerRef.current, {
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '12px',
          },
          showLeaveButton: false,
          showFullscreenButton: false,
        })

        callRef.current = call

        call.on('joined-meeting', () => setStatus('joined'))
        call.on('error', () => setStatus('error'))
        call.on('left-meeting', () => onClose())

        await call.join({ url, startVideoOff: true, startAudioOff: false })
      } catch (err) {
        console.error('VoiceChat error:', err)
        setStatus('error')
      }
    }

    start()

    return () => {
      callRef.current?.destroy()
    }
  }, [roomName])

  const handleLeave = async () => {
    await callRef.current?.leave()
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', bottom: '90px', right: '1.5rem',
      width: '320px', height: '180px',
      background: '#0f0f1a',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '14px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 100,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
        <span style={{ fontSize: '0.85rem', color: status === 'joined' ? '#10b981' : '#a78bfa', fontWeight: '600' }}>
          {status === 'connecting' ? '⏳ Connecting...' : status === 'joined' ? '🎙️ Voice Active' : '❌ Error'}
        </span>
        <button onClick={handleLeave} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '6px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>
          Leave
        </button>
      </div>
      <div ref={containerRef} style={{ flex: 1 }} />
    </div>
  )
}