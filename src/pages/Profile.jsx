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
  const [bio, setBio] = useState('')
  const [discordUsername, setDiscordUsername] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState([])
  const [selectedGames, setSelectedGames] = useState([])
  const [currentlyPlaying, setCurrentlyPlaying] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [stats, setStats] = useState({ posts: 0, likesReceived: 0, connections: 0, groups: 0 })
  const [statsLoading, setStatsLoading] = useState(true)
  const [memberSince, setMemberSince] = useState(null)
  const [blockedCount, setBlockedCount] = useState(0)
  const navigate = useNavigate()
  const searchTimeout = useRef(null)
  const avatarInputRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setMemberSince(user?.created_at || null)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setUsername(data.username || '')
        setBio(data.bio || '')
        setDiscordUsername(data.discord_username || '')
        setSelectedPlatforms(data.platforms || [])
        setSelectedGames(data.hobbies || [])
        setAvatarUrl(data.avatar_url || null)
        setCurrentlyPlaying(data.currently_playing || '')
        if (data.created_at) setMemberSince(data.created_at)
      }
      await loadStats(user.id)
      const { count: blockedCountResult } = await supabase
        .from('blocked_users')
        .select('id', { count: 'exact', head: true })
        .eq('blocker_id', user.id)
      setBlockedCount(blockedCountResult || 0)
    }
    load()
  }, [])

  const loadStats = async (userId) => {
    setStatsLoading(true)
    try {
      const { count: postsCount } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      const { data: userPosts } = await supabase.from('posts').select('id').eq('user_id', userId)
      const postIds = userPosts?.map(p => p.id) || []
      let likesReceived = 0
      if (postIds.length > 0) {
        const { count } = await supabase
          .from('post_likes')
          .select('id', { count: 'exact', head: true })
          .in('post_id', postIds)
        likesReceived = count || 0
      }

      const { count: connectionsCount } = await supabase
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
        .eq('status', 'accepted')

      const { count: groupsCount } = await supabase
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)

      setStats({
        posts: postsCount || 0,
        likesReceived,
        connections: connectionsCount || 0,
        groups: groupsCount || 0,
      })
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
    setStatsLoading(false)
  }

  const uploadAvatar = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return alert('Image must be under 10MB')
    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const contentType = file.type || 'image/jpeg'
      const fileName = `${user.id}/avatar-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true, contentType })
      if (uploadError) { alert('Failed to upload: ' + uploadError.message); setUploadingAvatar(false); return }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName)
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
      setAvatarUrl(publicUrl)
    } catch (err) {
      alert('Failed to upload: ' + err.message)
    }
    setUploadingAvatar(false)
  }

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
    setSearchResults([])
    setSearchQuery('')
  }

  const toggleGame = (game) => {
    setSelectedGames(prev => {
      const next = prev.includes(game) ? prev.filter(g => g !== game) : [...prev, game]
      // If the game currently marked "currently playing" got removed, clear it
      if (currentlyPlaying === game && !next.includes(game)) setCurrentlyPlaying('')
      return next
    })
  }

  const searchGames = async (query) => {
    if (!query.trim() || selectedPlatforms.length === 0) { setSearchResults([]); return }
    setSearching(true)
    const platformIds = selectedPlatforms.map(p => PLATFORMS.find(pl => pl.id === p)?.rawgId).filter(Boolean).join(',')
    const url = `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(query)}&platforms=${platformIds}&page_size=8`
    try {
      const res = await fetch(url)
      const data = await res.json()
      setSearchResults(data.results || [])
    } catch (e) { console.error('RAWG error:', e) }
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
      bio,
      discord_username: discordUsername,
      platforms: selectedPlatforms,
      hobbies: selectedGames,
      currently_playing: currentlyPlaying || null,
      currently_playing_at: currentlyPlaying ? new Date().toISOString() : null,
      updated_at: new Date()
    })
    if (error) alert(error.message)
    else navigate('/game-levels')
  }

  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const name = username || user?.email?.split('@')[0] || 'U'
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length]

  const inputStyle = { padding: '0.85rem 1rem', width: '100%', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem', fontSize: '1rem', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }
  const labelStyle = { display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#aaa', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }

  const formatMemberSince = (date) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  }

  const STAT_CARDS = [
    { key: 'posts', label: 'Posts', icon: '📝' },
    { key: 'likesReceived', label: 'Likes Received', icon: '❤️' },
    { key: 'connections', label: 'Connections', icon: '🤝' },
    { key: 'groups', label: 'Groups', icon: '👥' },
  ]

  return (
    <div style={{ padding: '2rem', maxWidth: '650px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '2rem' }}>Your Profile</h2>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.5rem' }}>
              {name[0]?.toUpperCase()}
            </div>
          )}
          <button onClick={() => avatarInputRef.current.click()} disabled={uploadingAvatar} style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '24px', height: '24px', borderRadius: '50%', background: '#6c63ff', border: '2px solid #0f0f1a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
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

      {/* Stats & Activity */}
      <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <p style={{ fontWeight: '600', fontSize: '0.95rem', margin: 0 }}>Stats & Activity</p>
          <p style={{ color: '#666', fontSize: '0.78rem', margin: 0 }}>Member since {formatMemberSince(memberSince)}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {STAT_CARDS.map(card => (
            <div key={card.key} style={{ textAlign: 'center', padding: '0.85rem 0.5rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' }}>
              <p style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>{card.icon}</p>
              <p style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, color: '#a78bfa' }}>
                {statsLoading ? '–' : stats[card.key]}
              </p>
              <p style={{ fontSize: '0.72rem', color: '#888', margin: '0.15rem 0 0' }}>{card.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy & Safety */}
      <div
        onClick={() => navigate('/blocked')}
        style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', padding: '1.25rem 1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'border-color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(108,99,255,0.3)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
      >
        <span style={{ fontSize: '1.4rem' }}>🚫</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: '600', fontSize: '0.95rem', margin: 0 }}>Blocked Users</p>
          <p style={{ color: '#888', fontSize: '0.8rem', margin: '0.15rem 0 0' }}>
            {blockedCount > 0 ? `${blockedCount} user${blockedCount !== 1 ? 's' : ''} blocked` : 'Manage who you\'ve blocked'}
          </p>
        </div>
        <span style={{ color: '#555', fontSize: '1rem' }}>→</span>
      </div>

      {/* Username */}
      <label style={labelStyle}>Username</label>
      <input type="text" placeholder="e.g. xXGamer42Xx" value={username} onChange={e => setUsername(e.target.value)} style={inputStyle} />

      {/* Bio */}
      <label style={labelStyle}>Bio</label>
      <textarea
        placeholder="Tell others about yourself... e.g. Competitive FPS player, love co-op games"
        value={bio}
        onChange={e => setBio(e.target.value)}
        maxLength={150}
        rows={3}
        style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
      />
      <p style={{ color: '#555', fontSize: '0.75rem', marginTop: '-1.5rem', marginBottom: '2rem', textAlign: 'right' }}>{bio.length}/150</p>

      {/* Discord */}
      <label style={labelStyle}>Discord Username</label>
      <div style={{ position: 'relative', marginBottom: '2rem' }}>
        <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#5865F2', fontSize: '1rem' }}>💬</span>
        <input
          type="text"
          placeholder="e.g. gamer#1234 or just gamer"
          value={discordUsername}
          onChange={e => setDiscordUsername(e.target.value)}
          style={{ ...inputStyle, paddingLeft: '2.5rem', marginBottom: 0 }}
        />
      </div>

      {/* Platforms */}
      <label style={labelStyle}>Your Platforms</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2rem' }}>
        {PLATFORMS.map(({ id, label, icon }) => (
          <button key={id} onClick={() => togglePlatform(id)} style={{ padding: '0.6rem 1.25rem', background: selectedPlatforms.includes(id) ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : 'rgba(255,255,255,0.05)', color: selectedPlatforms.includes(id) ? 'white' : '#888', border: selectedPlatforms.includes(id) ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius: '100px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '500', fontFamily: 'Inter, sans-serif', boxShadow: selectedPlatforms.includes(id) ? '0 0 20px rgba(108, 99, 255, 0.3)' : 'none' }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Game Search */}
      {selectedPlatforms.length > 0 && (
        <>
          <label style={labelStyle}>Search Games</label>
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <input type="text" placeholder={`Search games on ${selectedPlatforms.map(p => PLATFORMS.find(pl => pl.id === p)?.label).join(', ')}...`} value={searchQuery} onChange={handleSearchChange} style={{ ...inputStyle, marginBottom: 0 }} />
            {searching && <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem' }}>Searching...</p>}
            {searchResults.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {searchResults.map(game => {
                  const isSelected = selectedGames.includes(game.name)
                  return (
                    <div key={game.id} onClick={() => toggleGame(game.name)} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem 1rem', background: isSelected ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.03)', border: isSelected ? '1px solid rgba(108,99,255,0.4)' : '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s' }}>
                      {game.background_image && <img src={game.background_image} alt={game.name} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />}
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: '600', fontSize: '0.95rem', marginBottom: '0.2rem' }}>{game.name}</p>
                        <p style={{ color: '#888', fontSize: '0.8rem' }}>{game.platforms?.slice(0, 3).map(p => p.platform.name).join(', ')}</p>
                      </div>
                      <span style={{ color: isSelected ? '#a78bfa' : '#555', fontWeight: '600', fontSize: '0.85rem' }}>{isSelected ? '✓ Added' : '+ Add'}</span>
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
          <p style={{ color: '#a78bfa', fontWeight: '600', marginBottom: '0.75rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selected Games ({selectedGames.length})</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {selectedGames.map(game => (
              <span key={game} onClick={() => toggleGame(game)} style={{ background: 'rgba(108,99,255,0.2)', color: '#a78bfa', padding: '3px 10px', borderRadius: '100px', fontSize: '0.8rem', border: '1px solid rgba(108,99,255,0.3)', cursor: 'pointer' }}>
                {game} ✕
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Currently Playing */}
      {selectedGames.length > 0 && (
        <>
          <label style={labelStyle}>Currently Playing</label>
          <select
            value={currentlyPlaying}
            onChange={e => setCurrentlyPlaying(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            <option value="">Not set</option>
            {selectedGames.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </>
      )}

      <button onClick={() => navigate('/blocked')} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', marginBottom: '1.5rem', display: 'block', padding: 0 }}>
        🚫 Manage Blocked Users
      </button>

      <button onClick={saveProfile} style={{ padding: '0.85rem 2.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', fontFamily: 'Inter, sans-serif', boxShadow: '0 0 30px rgba(108, 99, 255, 0.3)' }}>
        Save & Set Game Levels →
      </button>
    </div>
  )
}