import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div style={{ padding: '3rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.5rem', color: '#1a1a2e' }}>Find Your Player 2 🎮</h1>
      <p style={{ marginTop: '1rem', color: '#555', fontSize: '1.1rem' }}>
        Connect with people who play the same games as you.
      </p>
      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <Link to="/login">
          <button style={{ padding: '0.75rem 2rem', background: '#6c63ff', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}>
            Get Started
          </button>
        </Link>
        <Link to="/browse">
          <button style={{ padding: '0.75rem 2rem', background: 'white', color: '#6c63ff', border: '2px solid #6c63ff', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}>
            Browse Players
          </button>
        </Link>
      </div>
    </div>
  )
}