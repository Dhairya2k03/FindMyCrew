import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import HobbyCard from '../components/HobbyCard'
import { SkeletonCard } from '../components/Skeleton'

const PLATFORMS = ['steam', 'epic', 'playstation', 'xbox', 'nintendo', 'mobile']
const PLATFORM_ICONS = { steam: '🖥️', epic: '🎮', playstation: '🎮', xbox: '🟢', nintendo: '🔴', mobile: '📱' }
const LEVELS = ['beginner', 'intermediate', 'pro']
const LEVEL_ICONS = { beginner: '🌱', intermediate: '⚡', pro: '🔥' }

export default function Browse({ theme }) {
  const isLight = theme === 'light'

  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [search, setSearch] = useState('')
  const [connectionMap, setConnectionMap] = useState({})
  const [filterPlatform, setFilterPlatform] = useState(null)
  const [filterLevel, setFilterLevel] = useState(null)
  const [filterGame, setFilterGame] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [allGames, setAllGames] = useState([])

  const textPrimary  = isLight ? '#111'                        : 'white'
  const textMuted    = isLight ? '#555'                        : '#888'
  const textFaint    = isLight ? '#777'                        : '#666'
  const inputBg      = isLight ? 'rgba(0,0,0,0.04)'           : 'rgba(255,255,255,0.05)'
  const inputBorder  = isLight ? 'rgba(0,0,0,0.1)'            : 'rgba(255,255,255,0.1)'
  const inputColor   = isLight ? '#111'                        : 'white'
  const filterBg     = isLight ? 'rgba(0,0,0,0.02)'           : 'rgba(255,255,255,0.02)'
  const filterBorder = isLight ? 'rgba(0,0,0,0.08)'           : 'rgba(255,255,255,0.08)'
  const chipBg       = isLight ? 'rgba(0,0,0,0.04)'           : 'rgba(255,255,255,0.04)'
  const chipBorder   = isLight ? 'rgba(0,0,0,0.08)'           : 'rgba(255,255,255,0.08)'
  const selectBg     = isLight ? '#f0f0f7'                     : '#1a1a2e'
  const selectColor  = isLight ? '#111'                        : 'white'

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setError('Not logged in'); setLoading(false); return }
        setCurrentUserId(user.id)

        const { data: me } = await supabase.from('profiles').select('hobbies').eq('id', user.id).single()
        const { data: others, error: fetchError } = await supabase.from('profiles').select('*').neq('id', user.id)
        if (fetchError) { setError(fetchError.message); setLoading(false); return }

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

        const games = new Set()
        others?.forEach(p => p.hobbies?.forEach(h => games.add(h)))
        setAllGames([...games].sort())
      } catch (e) { setError(e.message) }
      setLoading(false)
    }
    load()
  }, [])

  const activeFilterCount = [filterPlatform, filterLevel, filterGame].filter(Boolean).length

  const filtered = profiles.filter(p => {
    if (search && !(p.username || p.email || '').toLowerCase().includes(search.toLowerCase())) return false
    if (filterPlatform && !(p.platforms || []).includes(filterPlatform)) return false
    if (filterGame && !(p.hobbies || []).includes(filterGame)) return false
    if (filterLevel && filterGame) {
      if (p.game_levels?.[filterGame] !== filterLevel) return false
    } else if (filterLevel) {
      if (!Object.values(p.game_levels || {}).includes(filterLevel)) return false
    }
    return true
  })

  const clearFilters = () => {
    setFilterPlatform(null)
    setFilterLevel(null)
    setFilterGame('')
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem', color: textPrimary }}>Find Players 🎮</h2>
        <p style={{ color: textMuted }}>Players sorted by shared games</p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by username..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: inputColor, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', flex: 1, minWidth: '200px', outline: 'none' }}
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{ padding: '0.75rem 1.25rem', background: showFilters ? 'rgba(108,99,255,0.2)' : inputBg, color: showFilters ? '#a78bfa' : textMuted, border: showFilters ? '1px solid rgba(108,99,255,0.4)' : `1px solid ${inputBorder}`, borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap' }}
        >
          🔽 Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} style={{ padding: '0.75rem 1rem', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>
            Clear
          </button>
        )}
      </div>

      {showFilters && (
        <div style={{ background: filterBg, border: `1px solid ${filterBorder}`, borderRadius: '16px', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <p style={{ color: textMuted, fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Platform</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {PLATFORMS.map(p => (
              <button key={p} onClick={() => setFilterPlatform(filterPlatform === p ? null : p)} style={{ padding: '0.4rem 0.9rem', background: filterPlatform === p ? 'rgba(108,99,255,0.2)' : chipBg, color: filterPlatform === p ? '#a78bfa' : textMuted, border: filterPlatform === p ? '1px solid rgba(108,99,255,0.4)' : `1px solid ${chipBorder}`, borderRadius: '100px', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}>
                {PLATFORM_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          <p style={{ color: textMuted, fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Skill Level</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {LEVELS.map(l => (
              <button key={l} onClick={() => setFilterLevel(filterLevel === l ? null : l)} style={{ padding: '0.4rem 0.9rem', background: filterLevel === l ? 'rgba(108,99,255,0.2)' : chipBg, color: filterLevel === l ? '#a78bfa' : textMuted, border: filterLevel === l ? '1px solid rgba(108,99,255,0.4)' : `1px solid ${chipBorder}`, borderRadius: '100px', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}>
                {LEVEL_ICONS[l]} {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>

          <p style={{ color: textMuted, fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Game</p>
          <select value={filterGame} onChange={e => setFilterGame(e.target.value)} style={{ padding: '0.6rem 1rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: selectBg, color: filterGame ? selectColor : textMuted, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none', width: '100%', maxWidth: '300px' }}>
            <option value="">All games</option>
            {allGames.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      )}

      {error && <p style={{ color: '#f44336' }}>Error: {error}</p>}

      {!loading && (
        <p style={{ color: textFaint, fontSize: '0.85rem', marginBottom: '1rem' }}>
          {filtered.length} player{filtered.length !== 1 ? 's' : ''} found
        </p>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: textMuted }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</p>
          <p>No players match your filters.</p>
          <button onClick={clearFilters} style={{ marginTop: '1rem', padding: '0.6rem 1.5rem', background: 'rgba(108,99,255,0.15)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {filtered.map(p => (
            <HobbyCard
              key={p.id}
              profile={p}
              currentUserId={currentUserId}
              connectionStatus={connectionMap[p.id] || null}
              theme={theme}
            />
          ))}
        </div>
      )}
    </div>
  )
}