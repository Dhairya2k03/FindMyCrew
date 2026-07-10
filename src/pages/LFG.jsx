import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const DURATION_OPTIONS = [
  { label: '1 hour', ms: 60 * 60 * 1000 },
  { label: '3 hours', ms: 3 * 60 * 60 * 1000 },
  { label: '6 hours', ms: 6 * 60 * 60 * 1000 },
  { label: '12 hours', ms: 12 * 60 * 60 * 1000 },
  { label: '24 hours', ms: 24 * 60 * 60 * 1000 },
]

export default function LFG({ theme }) {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [posts, setPosts] = useState([])
  const [joins, setJoins] = useState({})
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [newPost, setNewPost] = useState({ game: '', message: '', playersNeeded: 1, platform: '', durationMs: DURATION_OPTIONS[1].ms })

  const isLight = theme === 'light'
  const bg          = isLight ? '#f0f0f7'              : '#0f0f1a'
  const cardBg      = isLight ? 'rgba(0,0,0,0.03)'     : 'rgba(255,255,255,0.03)'
  const cardBorder  = isLight ? 'rgba(0,0,0,0.08)'     : 'rgba(255,255,255,0.08)'
  const textPrimary = isLight ? '#111'                  : 'white'
  const textMuted   = isLight ? '#555'                  : '#888'
  const inputBg     = isLight ? 'rgba(0,0,0,0.04)'     : 'rgba(255,255,255,0.05)'
  const inputBorder = isLight ? 'rgba(0,0,0,0.1)'      : 'rgba(255,255,255,0.1)'

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data: postsData } = await supabase
        .from('lfg_posts')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      setPosts(postsData || [])

      if (postsData && postsData.length > 0) {
        const postIds = postsData.map(p => p.id)
        const { data: joinsData } = await supabase.from('lfg_joins').select('*').in('post_id', postIds)
        const grouped = {}
        joinsData?.forEach(j => {
          if (!grouped[j.post_id]) grouped[j.post_id] = []
          grouped[j.post_id].push(j)
        })
        setJoins(grouped)

        const userIds = [...new Set([...postsData.map(p => p.user_id), ...(joinsData || []).map(j => j.user_id)])]
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds)
          const map = {}
          profilesData?.forEach(p => { map[p.id] = p })
          setProfiles(map)
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    const channel = supabase.channel('lfg-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lfg_posts' }, async payload => {
        setPosts(prev => [payload.new, ...prev])
        if (!profiles[payload.new.user_id]) {
          const { data } = await supabase.from('profiles').select('*').eq('id', payload.new.user_id).single()
          if (data) setProfiles(prev => ({ ...prev, [data.id]: data }))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lfg_posts' }, payload => {
        setPosts(prev => prev.filter(p => p.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lfg_joins' }, async payload => {
        const j = payload.new
        setJoins(prev => {
          const existing = prev[j.post_id] || []
          if (existing.some(e => e.id === j.id)) return prev
          return { ...prev, [j.post_id]: [...existing, j] }
        })
        if (!profiles[j.user_id]) {
          const { data } = await supabase.from('profiles').select('*').eq('id', j.user_id).single()
          if (data) setProfiles(prev => ({ ...prev, [data.id]: data }))
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lfg_joins' }, payload => {
        const j = payload.old
        setJoins(prev => ({ ...prev, [j.post_id]: (prev[j.post_id] || []).filter(e => e.id !== j.id) }))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
    // profiles intentionally excluded — this only needs to run once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(interval)
  }, [])

  const activePosts = posts.filter(p => new Date(p.expires_at).getTime() > now)

  const getName = (uid) => {
    const p = profiles[uid]
    return p?.username || p?.email?.split('@')[0] || 'Player'
  }
  const getAvatar = (uid) => profiles[uid]?.avatar_url || null
  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const getColor = (uid) => { const n = getName(uid); return avatarColors[n.charCodeAt(0) % avatarColors.length] }

  const Avatar = ({ userId, size = 32 }) => {
    const url = getAvatar(userId)
    const n = getName(userId)
    if (url) return <img src={url} alt={n} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    return <div style={{ width: size, height: size, borderRadius: '50%', background: getColor(userId), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: '700', flexShrink: 0, color: 'white' }}>{n[0]?.toUpperCase()}</div>
  }

  const formatTimeLeft = (expiresAt) => {
    const diff = new Date(expiresAt).getTime() - now
    if (diff <= 0) return 'Expired'
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    if (hours > 0) return `${hours}h ${mins}m left`
    return `${mins}m left`
  }

  const createPost = async () => {
    if (!newPost.game.trim()) return alert('Please enter a game')
    if (newPost.playersNeeded < 1) return alert('Players needed must be at least 1')
    const expiresAt = new Date(Date.now() + newPost.durationMs).toISOString()
    const { error } = await supabase.from('lfg_posts').insert({
      user_id: currentUser.id,
      game: newPost.game.trim(),
      message: newPost.message.trim(),
      players_needed: newPost.playersNeeded,
      platform: newPost.platform.trim(),
      expires_at: expiresAt,
    })
    if (error) return alert(error.message)
    setNewPost({ game: '', message: '', playersNeeded: 1, platform: '', durationMs: DURATION_OPTIONS[1].ms })
    setShowForm(false)
  }

  const deletePost = async (postId) => {
    if (!window.confirm('Delete this LFG post?')) return
    await supabase.from('lfg_posts').delete().eq('id', postId)
  }

  const joinPost = async (postId) => {
    const { error } = await supabase.from('lfg_joins').insert({ post_id: postId, user_id: currentUser.id })
    if (error) alert(error.message)
  }

  const leavePost = async (postId) => {
    await supabase.from('lfg_joins').delete().eq('post_id', postId).eq('user_id', currentUser.id)
  }

  const messagePoster = (posterId) => navigate(`/chat/${posterId}`)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', background: bg }}>
      <p style={{ color: textMuted }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: bg, padding: '2rem' }}>
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🎯</span>
              <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: textPrimary, margin: 0 }}>Looking For Group</h1>
            </div>
            <p style={{ color: textMuted, margin: 0 }}>Find people to play with, right now</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ padding: '0.7rem 1.25rem', background: showForm ? 'transparent' : 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: showForm ? textMuted : 'white', border: showForm ? `1px solid ${inputBorder}` : 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.9rem', whiteSpace: 'nowrap' }}
          >
            {showForm ? '✕ Cancel' : '+ Post LFG'}
          </button>
        </div>

        {showForm && (
          <div style={{ background: cardBg, border: '1px solid rgba(108,99,255,0.25)', borderRadius: '16px', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Game (e.g. Valorant, Fortnite...)"
              value={newPost.game}
              onChange={e => setNewPost(p => ({ ...p, game: e.target.value }))}
              style={{ padding: '0.7rem 1rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }}
            />
            <textarea
              placeholder="What are you looking for? (e.g. Need 2 more for ranked, chill vibes only)"
              value={newPost.message}
              onChange={e => setNewPost(p => ({ ...p, message: e.target.value }))}
              rows={2}
              style={{ padding: '0.7rem 1rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none', resize: 'none' }}
            />
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ fontSize: '0.75rem', color: textMuted, display: 'block', marginBottom: '0.3rem' }}>Players needed</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={newPost.playersNeeded}
                  onChange={e => setNewPost(p => ({ ...p, playersNeeded: parseInt(e.target.value) || 1 }))}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: '0.75rem', color: textMuted, display: 'block', marginBottom: '0.3rem' }}>Platform (optional)</label>
                <input
                  type="text"
                  placeholder="PC, PS5, Xbox..."
                  value={newPost.platform}
                  onChange={e => setNewPost(p => ({ ...p, platform: e.target.value }))}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }}
                />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ fontSize: '0.75rem', color: textMuted, display: 'block', marginBottom: '0.3rem' }}>Expires in</label>
                <select
                  value={newPost.durationMs}
                  onChange={e => setNewPost(p => ({ ...p, durationMs: parseInt(e.target.value) }))}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }}
                >
                  {DURATION_OPTIONS.map(opt => (
                    <option key={opt.ms} value={opt.ms}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={createPost}
              style={{ padding: '0.75rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.9rem', marginTop: '0.25rem' }}
            >
              Post LFG
            </button>
          </div>
        )}

        {activePosts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: textMuted }}>
            <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎮</p>
            <p style={{ fontWeight: '600', fontSize: '1rem' }}>No one's looking for a group right now</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Be the first to post!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activePosts.map(post => {
              const postJoins = joins[post.id] || []
              const isMine = post.user_id === currentUser?.id
              const hasJoined = postJoins.some(j => j.user_id === currentUser?.id)
              const isFull = postJoins.length >= post.players_needed
              return (
                <div key={post.id} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '16px', padding: '1.25rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <Avatar userId={post.user_id} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <p style={{ fontWeight: '600', fontSize: '0.9rem', color: textPrimary, margin: 0 }}>{getName(post.user_id)}</p>
                        <span style={{ fontSize: '0.7rem', color: textMuted }}>· {formatTimeLeft(post.expires_at)}</span>
                      </div>
                      <p style={{ color: '#a78bfa', fontWeight: '700', fontSize: '1.05rem', margin: '0.2rem 0 0' }}>{post.game}</p>
                    </div>
                    {isMine && (
                      <button onClick={() => deletePost(post.id)} style={{ background: 'none', border: 'none', color: textMuted, cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
                    )}
                  </div>

                  {post.message && <p style={{ color: textPrimary, fontSize: '0.9rem', lineHeight: 1.4, marginBottom: '0.75rem' }}>{post.message}</p>}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.78rem', color: textMuted, background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: '100px', padding: '0.25rem 0.7rem' }}>
                      👥 {postJoins.length}/{post.players_needed} joined
                    </span>
                    {post.platform && (
                      <span style={{ fontSize: '0.78rem', color: textMuted, background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: '100px', padding: '0.25rem 0.7rem' }}>
                        🖥️ {post.platform}
                      </span>
                    )}
                    {postJoins.length > 0 && (
                      <div style={{ display: 'flex', marginLeft: '0.25rem' }}>
                        {postJoins.slice(0, 5).map((j, i) => (
                          <div key={j.id} style={{ marginLeft: i === 0 ? 0 : '-8px', border: `2px solid ${bg}`, borderRadius: '50%' }}>
                            <Avatar userId={j.user_id} size={24} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {!isMine && (
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <button
                        onClick={() => hasJoined ? leavePost(post.id) : joinPost(post.id)}
                        disabled={!hasJoined && isFull}
                        style={{
                          flex: 1,
                          padding: '0.6rem',
                          background: hasJoined ? 'rgba(239,68,68,0.1)' : (!hasJoined && isFull) ? inputBg : 'rgba(16,185,129,0.15)',
                          color: hasJoined ? '#ef4444' : (!hasJoined && isFull) ? textMuted : '#10b981',
                          border: hasJoined ? '1px solid rgba(239,68,68,0.25)' : (!hasJoined && isFull) ? `1px solid ${inputBorder}` : '1px solid rgba(16,185,129,0.3)',
                          borderRadius: '8px',
                          cursor: (!hasJoined && isFull) ? 'default' : 'pointer',
                          fontFamily: 'Inter, sans-serif',
                          fontWeight: '600',
                          fontSize: '0.85rem',
                        }}
                      >
                        {hasJoined ? 'Leave' : isFull ? 'Full' : "I'm in"}
                      </button>
                      <button
                        onClick={() => messagePoster(post.user_id)}
                        style={{ flex: 1, padding: '0.6rem', background: 'rgba(108,99,255,0.15)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem' }}
                      >
                        💬 Message
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}