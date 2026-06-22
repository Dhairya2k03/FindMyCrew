import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [message, setMessage] = useState('')

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

  const inputStyle = {
    padding: '0.85rem 1rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.1)',
    fontSize: '1rem',
    background: 'rgba(255,255,255,0.05)',
    color: 'white',
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    width: '100%'
  }

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: 'radial-gradient(ellipse at center, rgba(108, 99, 255, 0.1) 0%, transparent 70%)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px',
        padding: '2.5rem'
      }}>
        <h2 style={{ marginBottom: '0.5rem', fontSize: '1.75rem', fontWeight: '700' }}>
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>
        <p style={{ color: '#888', marginBottom: '2rem' }}>
          {isSignUp ? 'Join FindMyCrew today' : 'Sign in to your account'}
        </p>

        {message && <p style={{ color: '#4caf50', marginBottom: '1rem', fontSize: '0.9rem' }}>{message}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={inputStyle}
          />
          <button
            onClick={handleSubmit}
            style={{
              padding: '0.85rem',
              background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              marginTop: '0.5rem'
            }}
          >
            {isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', color: '#888', fontSize: '0.9rem' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setMessage('') }}
            style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', marginLeft: '0.5rem', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: '600' }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}