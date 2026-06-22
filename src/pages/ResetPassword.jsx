import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const handleReset = async () => {
    if (!password) return alert('Please enter a new password')
    if (password !== confirm) return alert('Passwords do not match')
    if (password.length < 6) return alert('Password must be at least 6 characters')

    const { error } = await supabase.auth.updateUser({ password })
    if (error) alert(error.message)
    else {
      setMessage('Password updated! Redirecting...')
      setTimeout(() => navigate('/'), 2000)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'radial-gradient(ellipse at center, rgba(108, 99, 255, 0.1) 0%, transparent 70%)' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '2.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.75rem', fontWeight: '700' }}>New Password</h2>
        <p style={{ color: '#888', marginBottom: '2rem' }}>Enter your new password below</p>

        {message && <p style={{ color: '#4caf50', marginBottom: '1rem' }}>{message}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', outline: 'none', width: '100%' }}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleReset()}
            style={{ padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', outline: 'none', width: '100%' }}
          />
          <button
            onClick={handleReset}
            style={{ padding: '0.85rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            Update Password
          </button>
        </div>
      </div>
    </div>
  )
}