import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login({ theme }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgot, setIsForgot] = useState(false)
  const [message, setMessage] = useState('')

  const isLight = theme === 'light'
  const pageBg      = isLight ? 'radial-gradient(ellipse at center, rgba(108, 99, 255, 0.06) 0%, transparent 70%)' : 'radial-gradient(ellipse at center, rgba(108, 99, 255, 0.1) 0%, transparent 70%)'
  const cardBg       = isLight ? '#ffffff'                : 'rgba(255,255,255,0.03)'
  const cardBorder   = isLight ? 'rgba(0,0,0,0.08)'        : 'rgba(255,255,255,0.08)'
  const textPrimary  = isLight ? '#111'                    : 'white'
  const textMuted    = isLight ? '#666'                    : '#888'
  const fieldBg      = isLight ? 'rgba(0,0,0,0.03)'        : 'rgba(255,255,255,0.05)'
  const fieldBorder  = isLight ? 'rgba(0,0,0,0.12)'        : 'rgba(255,255,255,0.1)'
  const backBtnBorder = isLight ? 'rgba(0,0,0,0.12)'       : 'rgba(255,255,255,0.1)'

  const handleSubmit = async () => {
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) alert(error.message)
      else {
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email: data.user.email,
            username: email.split('@')[0],
            hobbies: [],
            platforms: [],
            updated_at: new Date()
          })
        }
        setMessage('Account created! You can now log in.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert(error.message)
      else window.location.href = '/profile'
    }
  }

  const handleForgotPassword = async () => {
    if (!email) return alert('Please enter your email address first')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) alert(error.message)
    else setMessage('Password reset link sent! Check your email.')
  }

  const inputStyle = {
    padding: '0.85rem 1rem',
    borderRadius: '10px',
    border: `1px solid ${fieldBorder}`,
    fontSize: '1rem',
    background: fieldBg,
    color: textPrimary,
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    width: '100%'
  }

  if (isForgot) {
    return (
      <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: pageBg }}>
        <div style={{ width: '100%', maxWidth: '420px', background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '20px', padding: '2.5rem' }}>
          <h2 style={{ marginBottom: '0.5rem', fontSize: '1.75rem', fontWeight: '700', color: textPrimary }}>Reset Password</h2>
          <p style={{ color: textMuted, marginBottom: '2rem' }}>Enter your email and we'll send you a reset link</p>
          {message && <p style={{ color: '#4caf50', marginBottom: '1rem', fontSize: '0.9rem' }}>{message}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
            <button onClick={handleForgotPassword} style={{ padding: '0.85rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Send Reset Link
            </button>
            <button onClick={() => { setIsForgot(false); setMessage('') }} style={{ padding: '0.85rem', background: 'transparent', color: textMuted, border: `1px solid ${backBtnBorder}`, borderRadius: '10px', fontSize: '1rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: pageBg }}>
      <div style={{ width: '100%', maxWidth: '420px', background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '20px', padding: '2.5rem' }}>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.75rem', fontWeight: '700', color: textPrimary }}>
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p style={{ color: textMuted, marginBottom: '2rem' }}>
          {isSignUp ? 'Join FindMyCrew today' : 'Sign in to your account'}
        </p>

        {message && <p style={{ color: '#4caf50', marginBottom: '1rem', fontSize: '0.9rem' }}>{message}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} style={inputStyle} />

          {!isSignUp && (
            <button onClick={() => { setIsForgot(true); setMessage('') }} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', textAlign: 'right', padding: 0 }}>
              Forgot password?
            </button>
          )}

          <button onClick={handleSubmit} style={{ padding: '0.85rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginTop: '0.5rem' }}>
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: textMuted, fontSize: '0.9rem' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button onClick={() => { setIsSignUp(!isSignUp); setMessage('') }} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', marginLeft: '0.5rem', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: '600' }}>
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}
