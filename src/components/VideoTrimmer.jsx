import { useState, useRef, useEffect } from 'react'
import { trimVideo, supportsTrimming } from '../lib/videoUtils'

export default function VideoTrimmer({ file, onClose, onTrimmed }) {
  const videoRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [previewUrl] = useState(() => URL.createObjectURL(file))

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl])

  const handleLoadedMetadata = () => {
    const d = videoRef.current.duration
    setDuration(d)
    setEnd(Math.min(d, 30)) // default trim window: first 30s
  }

  const applyTrim = async () => {
    if (end <= start) return alert('End must be after start')
    setProcessing(true)
    try {
      const blob = await trimVideo(file, start, end)
      const trimmedFile = new File([blob], file.name.replace(/\.\w+$/, '') + '-trimmed.webm', { type: 'video/webm' })
      onTrimmed(trimmedFile)
    } catch (err) {
      alert('Trim failed: ' + err.message)
    }
    setProcessing(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '480px' }}>
        <h3 style={{ color: 'white', fontWeight: '700', marginBottom: '1rem' }}>✂️ Trim Clip</h3>
        <video ref={videoRef} src={previewUrl} controls onLoadedMetadata={handleLoadedMetadata} style={{ width: '100%', borderRadius: '10px', marginBottom: '1rem', maxHeight: '260px' }} />

        {duration > 0 && (
          <>
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Start: {start.toFixed(1)}s</p>
              <input type="range" min={0} max={duration} step={0.1} value={start} onChange={e => setStart(Math.min(Number(e.target.value), end - 0.1))} style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.3rem' }}>End: {end.toFixed(1)}s</p>
              <input type="range" min={0} max={duration} step={0.1} value={end} onChange={e => setEnd(Math.max(Number(e.target.value), start + 0.1))} style={{ width: '100%' }} />
            </div>
            <p style={{ color: '#a78bfa', fontSize: '0.8rem', marginBottom: '1rem' }}>Trimmed length: {(end - start).toFixed(1)}s</p>
          </>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={applyTrim} disabled={processing || duration === 0} style={{ flex: 1, padding: '0.7rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '8px', cursor: processing ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', opacity: processing ? 0.7 : 1 }}>
            {processing ? 'Processing...' : 'Use Trim'}
          </button>
          <button onClick={onClose} style={{ padding: '0.7rem 1.25rem', background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
        </div>
        {!supportsTrimming() && <p style={{ color: '#f59e0b', fontSize: '0.78rem', marginTop: '0.75rem' }}>⚠️ Trimming isn't fully supported in this browser — try Chrome or Edge.</p>}
      </div>
    </div>
  )
}