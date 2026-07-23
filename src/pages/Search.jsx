import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Search() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const navigate = useNavigate()

  const search = async (q) => {
    if (!q.trim()) { setResults([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${q}%`)
      .neq('id', user.id)
      .limit(20)

    setResults(data || [])
    setLoading(false)
  }

  const handleChange = (e) => {
    const q = e.target.value
    setQuery(q)
    clearTimeout(window._searchTimeout)
    window._searchTimeout = setTimeout(() => search(q), 400)
  }

  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const getColor = (name) => avatarColors[name?.charCodeAt(0) % avatarColors.length]

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>Search Players</h2>
      <p style={{ color: '#888', marginBottom: '1.5rem' }}>Find anyone by username</p>

      <input
        type="text"
        placeholder="Search by username..."
        value={query}
        onChange={handleChange}
        autoFocus
        style={{ padding: '0.85rem 1rem', width: '100%', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: '1rem', outline: 'none', boxSizing: 'border-box', marginBottom: '1.5rem' }}
      />

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: '72px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</p>
          <p>No players found for "{query}"</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {results.map(profile => {
            const name = profile.username || profile.email?.split('@')[0] || 'Player'
            const color = getColor(name)
            return (
              <div
                key={profile.id}
                onClick={() => navigate(`/user/${profile.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(108,99,255,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
              >
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={name} style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.2rem', flexShrink: 0 }}>
                    {name[0]?.toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.25rem' }}>{name}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                    {(profile.hobbies || []).slice(0, 3).map(h => (
                      <span key={h} style={{ background: 'rgba(108,99,255,0.2)', color: '#a78bfa', padding: '2px 8px', borderRadius: '100px', fontSize: '0.72rem', border: '1px solid rgba(108,99,255,0.3)' }}>
                        {h}
                      </span>
                    ))}
                    {(profile.hobbies || []).length > 3 && (
                      <span style={{ color: '#666', fontSize: '0.72rem' }}>+{profile.hobbies.length - 3} more</span>
                    )}
                  </div>
                </div>
                <span style={{ color: '#555', fontSize: '1rem' }}>→</span>
              </div>
            )
          })}
        </div>
      )}

      {!searched && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#888' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎮</p>
          <p>Type a username to search</p>
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  )
}