import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import HobbyCard from '../components/HobbyCard'

export default function Browse() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [search, setSearch] = useState('')
  const [connectionMap, setConnectionMap] = useState({})

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Not logged in'); setLoading(false); return }
        setCurrentUserId(user.id)

        const { data: me } = await supabase.from('profiles').select('hobbies').eq('id', user.id).single()
        const { data: others, error: fetchError } = await supabase.from('profiles').select('*').neq('id', user.id)
        if (fetchError) { setError(fetchError.message); setLoading(false); return }

        // Load all connections involving this user
        const { data: sentConns } = await supabase.from('connections').select('*').eq('sender_id', user.id)
        const { data: receivedConns } = await supabase.from('connections').select('*').eq('receiver_id', user.id)

        const map = {}
        sentConns?.forEach(c => { map[c.receiver_id] = c.status })
        receivedConns?.forEach(c => { map[c.sender_id] = c.status })
        setConnectionMap(map)

        const sorted = (others || []).sort((a, b) => {
          const overlapA = (a.hobbies || []).filter(h => (me?.hobbies || []).includes(h)).length
          const overlapB = (b.hobbies || []).filter(h => (me?.hobbies || []).includes(h)).length
          return overlapB - overlapA
        })
        setProfiles(sorted)
      } catch (e) { setError(e.message) }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = profiles.filter(p =>
    (p.username || p.email || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
      <p style={{ color: '#888' }}>Finding players...</p>
    </div>
  )

  return (
    <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>Find Players 🎮</h2>
        <p style={{ color: '#888' }}>Players are sorted by how many hobbies you share</p>
      </div>

      <input
        type="text"
        placeholder="Search by username..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.05)',
          color: 'white',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.95rem',
          width: '100%',
          maxWidth: '400px',
          marginBottom: '2rem',
          outline: 'none'
        }}
      />

      {error && <p style={{ color: '#f44336' }}>Error: {error}</p>}

      {filtered.length === 0 ? (
        <p style={{ color: '#888' }}>No players found.</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {filtered.map(p => (
            <HobbyCard
              key={p.id}
              profile={p}
              currentUserId={currentUserId}
              connectionStatus={connectionMap[p.id] || null}
            />
          ))}
        </div>
      )}
    </div>
  )
}