import { Link } from 'react-router-dom'

const features = [
  { icon: '🎮', title: 'Gaming', desc: 'Find players for FPS, RPG, Battle Royale and more' },
  { icon: '🤝', title: 'Connect', desc: 'Send connection requests to people who share your interests' },
  { icon: '💬', title: 'Chat', desc: 'Message your crew directly in the app' },
]

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <div style={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '2rem',
        background: 'radial-gradient(ellipse at top, rgba(108, 99, 255, 0.15) 0%, transparent 70%)'
      }}>
        <div style={{
          display: 'inline-block',
          padding: '0.4rem 1rem',
          background: 'rgba(108, 99, 255, 0.15)',
          border: '1px solid rgba(108, 99, 255, 0.3)',
          borderRadius: '100px',
          fontSize: '0.85rem',
          color: '#a78bfa',
          marginBottom: '1.5rem'
        }}>
          🚀 Now in beta
        </div>

        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
          fontWeight: '800',
          lineHeight: 1.1,
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, #fff 0%, #a78bfa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Find Your<br />Perfect Crew
        </h1>

        <p style={{ fontSize: '1.2rem', color: '#888', maxWidth: '500px', marginBottom: '2.5rem', lineHeight: 1.6 }}>
          Connect with gamers who share your playstyle, schedule, and favorite games. No more solo queues.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/login">
            <button style={{
              padding: '0.85rem 2.5rem',
              background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 0 30px rgba(108, 99, 255, 0.4)'
            }}>
              Get Started →
            </button>
          </Link>
          <Link to="/browse">
            <button style={{
              padding: '0.85rem 2.5rem',
              background: 'rgba(255,255,255,0.05)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif'
            }}>
              Browse Players
            </button>
          </Link>
        </div>

        {/* Features */}
        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {features.map(f => (
            <div key={f.title} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '1.5rem',
              width: '220px',
              textAlign: 'left'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{f.icon}</div>
              <h3 style={{ marginBottom: '0.5rem', fontWeight: '600' }}>{f.title}</h3>
              <p style={{ color: '#888', fontSize: '0.9rem', lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}