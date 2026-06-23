import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const PLATFORMS = [
  { id: 'steam', label: 'Steam', icon: '🖥️', rawgId: 1 },
  { id: 'epic', label: 'Epic Games', icon: '🎮', rawgId: 1 },
  { id: 'playstation', label: 'PlayStation', icon: '🎮', rawgId: 187 },
  { id: 'xbox', label: 'Xbox', icon: '🟢', rawgId: 186 },
  { id: 'nintendo', label: 'Nintendo', icon: '🔴', rawgId: 7 },
  { id: 'mobile', label: 'Mobile', icon: '📱', rawgId: 21 },
]

const RAWG_KEY = import.meta.env.VITE_RAWG_API_KEY

export default function Profile() {
  const [user, setUser] = useState(null)
  const [username, setUsername] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [selectedGames, setSelectedGames] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const navigate = useNavigate()
  const searchTimeout = useRef(null)
  const avatarInputRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setUsername(data.username || '')
        setSelectedPlatforms(data.platforms || [])
        setSelectedGames(data.hobbies || [])
        setAvatarUrl(data.avatar_url || null)
      }
    }
    load()
  }, [])

  const uploadAvatar = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return alert('Please select an image file')
    if (file.size > 2 * 1024 * 1024) return alert('Image must be under 2MB')

    setUploadingAvatar(true)
    const fileName = `${user.id}/avatar-${Date.now()}.${file.name.split('.').pop()}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      alert('Failed to upload: ' + uploadError.message)
      setUploadingAvatar(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)

    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setAvatarUrl(publicUrl)
    setUploadingAvatar(false)
  }

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
    setSearchResults([])
    setSearchQuery('')
  }

  const toggleGame = (game) => {
    setSelectedGames(prev =>
      prev.includes(game) ? prev.filter(g => g !== game) : [...prev, game]
    )
  }

  const searchGames = async (query) => {
    if (!query.trim() || selectedPlatforms.length === 0) {
      setSearchResults([])
      return
    }
    setSearching(true)
    const platformIds = selectedPlatforms
      .map(p => PLATFORMS.find(pl => pl.id === p)?.rawgId)
      .filter(Boolean)
      .join(',')
    const url = `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(query)}&platforms=${platformIds}&page_size=8`
    try {
      const res = await fetch(url)
      const data = await res.json()
      setSearchResults(data.results || [])
    } catch (e) {
      console.error('RAWG error:', e)
    }
    setSearching(false)
  }

  const handleSearchChange = (e) => {
    const query = e.target.value
    setSearchQuery(query)
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => searchGames(query), 500)
  }

  const saveProfile = async () => {
    if (!user) return alert('Not logged in')
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      username,
      platforms: selectedPlatforms,
      hobbies: selectedGames,
      updated_at: new Date()
    })
    if (error) alert(error.message)
    else navigate('/game-levels')
  }

  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const name = username || user?.email?.split('@')[0] || 'U'
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length]

  return (
    <div style={{ padding: '2rem', maxWidth: '650px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '2rem' }}>Your Profile</h2>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.5rem' }}>
              {name[0]?.toUpperCase()}
            </div>
          )}
          <button
            onClick={() => avatarInputRef.current.click()}
            disabled={uploadingAvatar}
            style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '24px', height: '24px', borderRadius: '50%', background: '#6c63ff', border: '2px solid #0f0f1a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}
          >
            {uploadingAvatar ? '⏳' : '✏️'}
          </button>
          <input type="file" accept="image/*" ref={avatarInputRef} onChange={uploadAvatar} style={{ display: 'none' }} />
        </div>
        <div>
          <p style={{ fontWeight: '600', fontSize: '1.1rem' }}>{name}</p>
          <p style={{ color: '#888', fontSize: '0.85rem' }}>{user?.email}</p>
          <p style={{ color: '#a78bfa', fontSize: '0.8rem', marginTop: '0.25rem', cursor: 'pointer' }} onClick={() => avatarInputRef.current.click()}>
            {uploadingAvatar ? 'Uploading...' : 'Change photo'}
          </p>
        </div>
      </div>

      {/* Username */}
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username</label>
      <input
        type="text"
        placeholder="e.g. xXGamer42Xx"
        value={username}
        onChange={e => setUsername(e.target.value)}
        style={{ padding: '0.85rem 1rem', width: '100%', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem', fontSize: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', outline: 'none' }}
      />

      {/* Platforms */}
      <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Platforms</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2rem' }}>
        {PLATFORMS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => togglePlatform(id)}
            style={{
              padding: '0.6rem 1.25rem',
              background: selectedPlatforms.includes(id) ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : 'rgba(255,255,255,0.05)',
              color: selectedPlatforms.includes(id) ? 'white' : '#888',
              border: selectedPlatforms.includes(id) ? 'none' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '100px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              fontFamily: 'Inter, sans-serif',
              boxShadow: selectedPlatforms.includes(id) ? '0 0 20px rgba(108, 99, 255, 0.3)' : 'none'
            }}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Game Search */}
      {selectedPlatforms.length > 0 && (
        <>
          <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Search Games
          </label>
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder={`Search games on ${selectedPlatforms.map(p => PLATFORMS.find(pl => pl.id === p)?.label).join(', ')}...`}
              value={searchQuery}
              onChange={handleSearchChange}
              style={{ padding: '0.85rem 1rem', width: '100%', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', outline: 'none' }}
            />
            {searching && <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem' }}>Searching...</p>}
            {searchResults.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {searchResults.map(game => {
                  const isSelected = selectedGames.includes(game.name)
                  return (
                    <div
                      key={game.id}
                      onClick={() => toggleGame(game.name)}
                      style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: isSelected ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.03)', border: isSelected ? '1px solid rgba(108,99,255,0.4)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}
                    >
                      {game.background_image && (
                        <img src={game.background_image} alt={game.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.2rem' }}>{game.name}</p>
                        <p style={{ color: '#888', fontSize: '0.8rem' }}>{game.platforms?.slice(0, 3).map(p => p.platform.name).join(', ')}</p>
                      </div>
                      <span style={{ color: isSelected ? '#a78bfa' : '#555', fontWeight: '600', fontSize: '0.85rem' }}>
                        {isSelected ? '✓ Added' : '+ Add'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Selected Games */}
      {selectedGames.length > 0 && (
        <div style={{ marginBottom: '2rem', padding: '1rem 1.5rem', background: 'rgba(108,99,255,0.08)', borderRadius: '12px', border: '1px solid rgba(108,99,255,0.2)' }}>
          <p style={{ color: '#a78bfa', fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Selected Games ({selectedGames.length})
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {selectedGames.map(game => (
              <span key={game} onClick={() => toggleGame(game)} style={{ background: 'rgba(108,99,255,0.2)', color: '#a78bfa', padding: '3px 10px', borderRadius: '100px', fontSize: '0.8rem', border: '1px solid rgba(108,99,255,0.3)', cursor: 'pointer' }}>
                {game} ✕
              </span>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={saveProfile}
        style={{ padding: '0.85rem 2.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 0 30px rgba(108, 99, 255, 0.3)' }}
      >
        Save & Set Game Levels →
      </button>
    </div>
  )
}