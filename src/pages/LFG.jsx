import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const REGIONS = ['NA East', 'NA West', 'EU West', 'EU East', 'Asia', 'OCE', 'SA', 'ME', 'Any']
const MODES = ['Ranked', 'Casual', 'Competitive', 'Co-op', 'Story', 'Any']
const AGE_RANGES = ['13-17', '18-24', '25-30', '30+', 'Any']
const STATUS_COLORS = { open: '#10b981', full: '#f59e0b', closed: '#ef4444' }
const STATUS_LABELS = { open: '🟢 Open', full: '🟡 Full', closed: '🔴 Closed' }
const RAWG_KEY = import.meta.env.VITE_RAWG_API_KEY

const GameSearch = ({ value, onChange, inputStyle, textColor, border, inputBg, inputBorder, mutedColor }) => {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const timeout = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const search = async (q) => {
    if (!q.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(q)}&page_size=8`)
      const data = await res.json()
      setResults(data.results || [])
    } catch {}
    setSearching(false)
  }

  const handleChange = (e) => {
    const q = e.target.value
    setQuery(q)
    setShowDropdown(true)
    clearTimeout(timeout.current)
    timeout.current = setTimeout(() => search(q), 400)
  }

  const select = (game) => {
    setQuery(game.name)
    onChange(game.name)
    setShowDropdown(false)
    setResults([])
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="Search any game..."
          value={query}
          onChange={handleChange}
          onFocus={() => query && setShowDropdown(true)}
          style={{ ...inputStyle, paddingRight: query ? '2rem' : '1rem' }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); onChange(''); setResults([]) }}
            style={{
              position: 'absolute',
              right: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: mutedColor,
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            ✕
          </button>
        )}
      </div>
      {showDropdown && query && (
        <div
          style={{
            position: 'absolute',
            top: '110%',
            left: 0,
            right: 0,
            background: inputBg === 'rgba(0,0,0,0.04)' ? '#f0f0f7' : '#1a1a2e',
            border: `1px solid ${border}`,
            borderRadius: '10px',
            zIndex: 100,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}
        >
          {searching ? (
            <p style={{ padding: '0.75rem 1rem', color: mutedColor, fontSize: '0.85rem' }}>Searching...</p>
          ) : results.length === 0 ? (
            <p style={{ padding: '0.75rem 1rem', color: mutedColor, fontSize: '0.85rem' }}>No games found</p>
          ) : (
            results.map(game => (
              <div
                key={game.id}
                onClick={() => select(game)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 1rem',
                  cursor: 'pointer',
                  borderBottom: `1px solid ${border}`
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(108,99,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {game.background_image && (
                  <img
                    src={game.background_image}
                    alt=""
                    style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }}
                  />
                )}
                <div>
                  <p style={{ fontSize: '0.88rem', color: textColor, fontWeight: '500', margin: 0 }}>{game.name}</p>
                  {game.released && (
                    <p style={{ fontSize: '0.72rem', color: mutedColor, margin: 0 }}>
                      {new Date(game.released).getFullYear()}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function LFG({ theme }) {
  const [posts, setPosts] = useState([])
  const [profiles, setProfiles] = useState({})
  const [requests, setRequests] = useState({})
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedPost, setExpandedPost] = useState(null)
  const [myRequestMessage, setMyRequestMessage] = useState('')
  const [filters, setFilters] = useState({ game: '', region: '', mode: '', status: 'open' })
  const [newPost, setNewPost] = useState({
    game: '',
    mode: 'Any',
    rank: '',
    region: 'Any',
    mic_required: false,
    age_range: 'Any',
    slots: 1,
    description: ''
  })
  const [respondingId, setRespondingId] = useState(null)
  const [sendingRequest, setSendingRequest] = useState(false)
  const [chatOpenPost, setChatOpenPost] = useState(null)
  const [messages, setMessages] = useState({})
  const [chatDraft, setChatDraft] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const messagesEndRef = useRef(null)
  const navigate = useNavigate()

  const isLight = theme === 'light'
  const bg = isLight ? '#f0f0f7' : '#0f0f1a'
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const textColor = isLight ? '#111' : 'white'
  const mutedColor = isLight ? '#555' : '#888'
  const cardBg = isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.03)'
  const inputBg = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'
  const inputBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
  const inputStyle = {
    padding: '0.65rem 1rem',
    borderRadius: '8px',
    border: `1px solid ${inputBorder}`,
    background: inputBg,
    color: textColor,
    fontFamily: 'Inter, sans-serif',
    fontSize: '0.9rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  }
  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      await loadPosts()
      setLoading(false)
    }
    load()

    const channel = supabase
      .channel('lfg-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lfg_posts' }, payload => {
        setPosts(prev => {
          if (prev.some(p => p.id === payload.new.id)) return prev
          return [payload.new, ...prev]
        })
        loadProfileForUser(payload.new.user_id)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lfg_posts' }, payload => {
        setPosts(prev => prev.map(p => p.id === payload.new.id ? payload.new : p))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'lfg_posts' }, payload => {
        setPosts(prev => prev.filter(p => p.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lfg_requests' }, payload => {
        const r = payload.new
        setRequests(prev => ({
          ...prev,
          [r.lfg_post_id]: [...(prev[r.lfg_post_id] || []).filter(x => x.id !== r.id), r]
        }))
        loadProfileForUser(r.user_id)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lfg_requests' }, payload => {
        const r = payload.new
        setRequests(prev => ({
          ...prev,
          [r.lfg_post_id]: (prev[r.lfg_post_id] || []).map(x => x.id === r.id ? r : x)
        }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lfg_messages' }, payload => {
        const m = payload.new
        setMessages(prev => {
          const existing = prev[m.lfg_post_id] || []
          if (existing.some(x => x.id === m.id)) return prev
          return { ...prev, [m.lfg_post_id]: [...existing, m] }
        })
        loadProfileForUser(m.user_id)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const loadProfileForUser = async (userId) => {
    setProfiles(prev => {
      if (prev[userId]) return prev
      supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => {
        if (data) setProfiles(p => ({ ...p, [data.id]: data }))
      })
      return prev
    })
  }

  const loadPosts = async () => {
    const { data: postsData } = await supabase.from('lfg_posts').select('*').order('created_at', { ascending: false })
    if (!postsData) return
    setPosts(postsData)

    const userIds = [...new Set(postsData.map(p => p.user_id))]
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds)
      const map = {}
      profilesData?.forEach(p => { map[p.id] = p })
      setProfiles(map)
    }

    const postIds = postsData.map(p => p.id)
    if (postIds.length > 0) {
      const { data: reqData } = await supabase.from('lfg_requests').select('*').in('lfg_post_id', postIds)
      const reqMap = {}
      reqData?.forEach(r => {
        if (!reqMap[r.lfg_post_id]) reqMap[r.lfg_post_id] = []
        if (!reqMap[r.lfg_post_id].some(x => x.id === r.id)) reqMap[r.lfg_post_id].push(r)
      })
      setRequests(reqMap)

      const requesterIds = [...new Set(reqData?.map(r => r.user_id) || [])]
      if (requesterIds.length > 0) {
        const { data: reqProfiles } = await supabase.from('profiles').select('*').in('id', requesterIds)
        const map = {}
        reqProfiles?.forEach(p => { map[p.id] = p })
        setProfiles(prev => ({ ...prev, ...map }))
      }
    }
  }

  const createPost = async () => {
    if (!newPost.game) return alert('Please select a game')
    if (!newPost.description.trim()) return alert('Please add a description')

    const { error } = await supabase.from('lfg_posts').insert({
      user_id: currentUser.id,
      game: newPost.game,
      mode: newPost.mode,
      rank: newPost.rank.trim() || null,
      region: newPost.region,
      mic_required: newPost.mic_required,
      age_range: newPost.age_range,
      slots: newPost.slots,
      description: newPost.description.trim(),
      status: 'open'
    })
    if (error) return alert(error.message)

    setNewPost({
      game: '',
      mode: 'Any',
      rank: '',
      region: 'Any',
      mic_required: false,
      age_range: 'Any',
      slots: 1,
      description: ''
    })
    setShowCreate(false)
  }

  // Guarded: prevents a double-click / slow-network double-tap from
  // inserting two lfg_requests rows for the same user on the same post
  // (which was the root cause of one account showing up twice).
  const sendRequest = async (postId) => {
    if (sendingRequest) return
    const post = posts.find(p => p.id === postId)
    if (post?.user_id === currentUser.id) return // can't request to join your own post
    const alreadyRequested = (requests[postId] || []).some(r => r.user_id === currentUser.id)
    if (alreadyRequested) {
      setExpandedPost(null)
      return
    }
    setSendingRequest(true)
    try {
      const { error } = await supabase.from('lfg_requests').insert({
        lfg_post_id: postId,
        user_id: currentUser.id,
        message: myRequestMessage.trim() || null
      })
      // 23505 = unique_violation, thrown if the DB unique constraint catches
      // a race the client-side check missed. Treat it as a harmless no-op.
      if (error && error.code !== '23505') return alert(error.message)
      setMyRequestMessage('')
      setExpandedPost(null)
    } finally {
      setSendingRequest(false)
    }
  }

  // Guarded wrapper: prevents double-clicks / double-submission from firing
  // this whole flow twice.
  const respondToRequest = async (requestId, postId, status) => {
    if (respondingId) return
    setRespondingId(requestId)
    try {
      await respondToRequestInner(requestId, postId, status)
    } finally {
      setRespondingId(null)
    }
  }

  // Accepting a request no longer creates any separate "group" record.
  // Who's "in the squad" is simply: the post owner + everyone with an
  // accepted lfg_requests row. That means there's nothing to duplicate,
  // nothing to race-condition-create-twice, and nothing left behind when
  // the post is deleted (lfg_messages cascades with it).
  const respondToRequestInner = async (requestId, postId, status) => {
    const { data: updatedReq, error: updateErr } = await supabase
      .from('lfg_requests')
      .update({ status })
      .eq('id', requestId)
      .select()
      .single()

    if (updateErr || !updatedReq) {
      console.error('Failed to update request:', updateErr)
      return
    }

    if (status !== 'accepted') return

    const { data: freshPost, error: postErr } = await supabase
      .from('lfg_posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (postErr || !freshPost) {
      console.error('Failed to load post:', postErr)
      return
    }

    await supabase.from('notifications').insert({
      user_id: updatedReq.user_id,
      type: 'lfg_accepted',
      content: `✅ Your LFG request for "${freshPost.game}" was accepted! You're in the squad chat now.`,
      read: false
    })

    // Purely cosmetic: mark the post "full" once enough people are in,
    // so new players stop seeing it as open.
    const { data: acceptedRows } = await supabase
      .from('lfg_requests')
      .select('user_id')
      .eq('lfg_post_id', postId)
      .eq('status', 'accepted')

    const uniqueAcceptedCount = new Set((acceptedRows || []).map(r => r.user_id)).size
    if (uniqueAcceptedCount >= freshPost.slots) {
      await supabase.from('lfg_posts').update({ status: 'full' }).eq('id', postId)
    }

    // Auto-open the chat panel for the owner so they immediately see the
    // new teammate land in it.
    setChatOpenPost(postId)
    loadMessages(postId)
  }

  const loadMessages = async (postId) => {
    const { data, error } = await supabase
      .from('lfg_messages')
      .select('*')
      .eq('lfg_post_id', postId)
      .order('created_at', { ascending: true })
    if (error) {
      console.error('Failed to load messages:', error)
      return
    }
    setMessages(prev => ({ ...prev, [postId]: data || [] }))
    const senderIds = [...new Set((data || []).map(m => m.user_id))]
    senderIds.forEach(loadProfileForUser)
  }

  const toggleChat = (postId) => {
    if (chatOpenPost === postId) {
      setChatOpenPost(null)
      return
    }
    setChatOpenPost(postId)
    if (!messages[postId]) loadMessages(postId)
  }

  const sendChatMessage = async (postId) => {
    const content = chatDraft.trim()
    if (!content || sendingMessage) return
    setSendingMessage(true)
    try {
      const { error } = await supabase.from('lfg_messages').insert({
        lfg_post_id: postId,
        user_id: currentUser.id,
        content
      })
      if (error) return alert(error.message)
      setChatDraft('')
    } finally {
      setSendingMessage(false)
    }
  }

  useEffect(() => {
    if (chatOpenPost && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, chatOpenPost])

  const closePost = async (postId) => {
    await supabase.from('lfg_posts').update({ status: 'closed' }).eq('id', postId)
  }

  const reopenPost = async (postId) => {
    await supabase.from('lfg_posts').update({ status: 'open' }).eq('id', postId)
  }

  const deletePost = async (postId) => {
    if (!window.confirm('Delete this LFG post?')) return
    await supabase.from('lfg_posts').delete().eq('id', postId)
  }

  const getName = (uid) => {
    const p = profiles[uid]
    return p?.username || p?.email?.split('@')[0] || 'Player'
  }
  const getAvatar = (uid) => profiles[uid]?.avatar_url
  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const getColor = (uid) => {
    const n = getName(uid)
    return avatarColors[n.charCodeAt(0) % avatarColors.length]
  }

  const Avatar = ({ userId, size = 36 }) => {
    const url = getAvatar(userId)
    const n = getName(userId)
    if (url) {
      return (
        <img
          src={url}
          alt={n}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }}
          onClick={() => navigate(`/user/${userId}`)}
        />
      )
    }
    return (
      <div
        onClick={() => navigate(`/user/${userId}`)}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: getColor(userId),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.38,
          fontWeight: '700',
          flexShrink: 0,
          color: 'white',
          cursor: 'pointer'
        }}
      >
        {n[0]?.toUpperCase()}
      </div>
    )
  }

  const formatTime = (date) => {
    const d = new Date(date)
    const diff = new Date() - d
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  const filtered = posts.filter(p => {
    const isMine = p.user_id === currentUser?.id
    const myReq = (requests[p.id] || []).find(r => r.user_id === currentUser?.id)
    const amInSquad = isMine || myReq?.status === 'accepted'

    if (filters.game && !p.game?.toLowerCase().includes(filters.game.toLowerCase())) return false
    if (filters.region && filters.region !== 'Any' && p.region !== filters.region) return false
    if (filters.mode && filters.mode !== 'Any' && p.mode !== filters.mode) return false
    // Status filter never hides a post you own or are already in — only
    // affects posts you're browsing to potentially join.
    if (filters.status && p.status !== filters.status && !amInSquad) return false
    return true
  })

  const gameSearchProps = { inputStyle, textColor, border, inputBg, inputBorder, mutedColor }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: bg, padding: '1.5rem' }}>
      <div style={{ maxWidth: '750px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', margin: 0, color: textColor }}>Looking for Group</h2>
            <p style={{ color: mutedColor, margin: 0, fontSize: '0.9rem' }}>
              Find players · A group chat is created the moment someone is accepted
            </p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontWeight: '600',
              fontSize: '0.95rem'
            }}
          >
            + Post LFG
          </button>
        </div>

        {showCreate && (
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontWeight: '600', marginBottom: '1.25rem', color: textColor, fontSize: '1rem' }}>Create LFG Post</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: mutedColor, display: 'block', marginBottom: '0.3rem' }}>
                  Game * (search any game)
                </label>
                <GameSearch value={newPost.game} onChange={g => setNewPost(p => ({ ...p, game: g }))} {...gameSearchProps} />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: mutedColor, display: 'block', marginBottom: '0.3rem' }}>Mode</label>
                <select value={newPost.mode} onChange={e => setNewPost(p => ({ ...p, mode: e.target.value }))} style={selectStyle}>
                  {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: mutedColor, display: 'block', marginBottom: '0.3rem' }}>Rank</label>
                <input
                  type="text"
                  placeholder="e.g. Gold 2, Plat+"
                  value={newPost.rank}
                  onChange={e => setNewPost(p => ({ ...p, rank: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: mutedColor, display: 'block', marginBottom: '0.3rem' }}>Region</label>
                <select value={newPost.region} onChange={e => setNewPost(p => ({ ...p, region: e.target.value }))} style={selectStyle}>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: mutedColor, display: 'block', marginBottom: '0.3rem' }}>Slots needed</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={newPost.slots}
                  onChange={e => setNewPost(p => ({ ...p, slots: parseInt(e.target.value) || 1 }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: mutedColor, display: 'block', marginBottom: '0.3rem' }}>Age range</label>
                <select value={newPost.age_range} onChange={e => setNewPost(p => ({ ...p, age_range: e.target.value }))} style={selectStyle}>
                  {AGE_RANGES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ fontSize: '0.8rem', color: mutedColor, display: 'block', marginBottom: '0.3rem' }}>Description *</label>
              <textarea
                placeholder="What are you looking for? Playstyle, schedule, requirements..."
                value={newPost.description}
                onChange={e => setNewPost(p => ({ ...p, description: e.target.value }))}
                rows={3}
                style={{ ...inputStyle, resize: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                id="mic"
                checked={newPost.mic_required}
                onChange={e => setNewPost(p => ({ ...p, mic_required: e.target.checked }))}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="mic" style={{ color: textColor, fontSize: '0.9rem', cursor: 'pointer' }}>🎙️ Mic required</label>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowCreate(false)}
                style={{
                  padding: '0.6rem 1rem',
                  background: 'transparent',
                  color: mutedColor,
                  border: `1px solid ${inputBorder}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.9rem'
                }}
              >
                Cancel
              </button>
              <button
                onClick={createPost}
                style={{
                  padding: '0.6rem 1.5rem',
                  background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: '600',
                  fontSize: '0.9rem'
                }}
              >
                Post
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            style={{ ...selectStyle, width: 'auto', minWidth: '120px' }}
          >
            <option value="">All status</option>
            <option value="open">🟢 Open</option>
            <option value="full">🟡 Full</option>
            <option value="closed">🔴 Closed</option>
          </select>
          <input
            type="text"
            placeholder="Filter by game..."
            value={filters.game}
            onChange={e => setFilters(f => ({ ...f, game: e.target.value }))}
            style={{ ...inputStyle, width: '160px' }}
          />
          <select
            value={filters.region}
            onChange={e => setFilters(f => ({ ...f, region: e.target.value }))}
            style={{ ...selectStyle, width: 'auto', minWidth: '120px' }}
          >
            <option value="">All regions</option>
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={filters.mode}
            onChange={e => setFilters(f => ({ ...f, mode: e.target.value }))}
            style={{ ...selectStyle, width: 'auto', minWidth: '110px' }}
          >
            <option value="">All modes</option>
            {MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {(filters.game || filters.region || filters.mode || filters.status) && (
            <button
              onClick={() => setFilters({ game: '', region: '', mode: '', status: 'open' })}
              style={{
                padding: '0.6rem 1rem',
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.85rem'
              }}
            >
              Clear
            </button>
          )}
        </div>

        <p style={{ color: mutedColor, fontSize: '0.85rem', marginBottom: '1rem' }}>
          {filtered.length} post{filtered.length !== 1 ? 's' : ''} found
        </p>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '16px', height: '140px', animation: 'pulse 1.5s infinite' }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: mutedColor }}>
            <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎮</p>
            <p style={{ fontSize: '1rem', color: textColor, fontWeight: '600', marginBottom: '0.5rem' }}>No LFG posts found</p>
            <p>Be the first to post!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filtered.map(post => {
              const isOwn = post.user_id === currentUser?.id
              const postRequests = requests[post.id] || []
              const myRequest = postRequests.find(r => r.user_id === currentUser?.id)

              // Dedupe accepted requests by user_id so a stray duplicate row
              // (old data, or a race that slipped past the DB constraint)
              // can never render the same person twice.
              const acceptedRequests = Array.from(
                new Map(
                  postRequests.filter(r => r.status === 'accepted').map(r => [r.user_id, r])
                ).values()
              )
              const acceptedCount = acceptedRequests.length
              const pendingCount = postRequests.filter(r => r.status === 'pending').length
              const isExpanded = expandedPost === post.id
              const statusColor = STATUS_COLORS[post.status] || '#888'
              const isFull = post.status === 'full'

              const imAccepted = myRequest?.status === 'accepted' || isOwn
              // "Squad" membership is computed, not stored: owner + anyone
              // with an accepted request. Chat becomes available the moment
              // there's at least one accepted person.
              const hasSquad = acceptedCount > 0
              const isChatOpen = chatOpenPost === post.id
              const postMessages = messages[post.id] || []

              return (
                <div
                  key={post.id}
                  style={{
                    background: cardBg,
                    border: isFull ? '1px solid rgba(245,158,11,0.3)' : `1px solid ${border}`,
                    borderRadius: '16px',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                      <Avatar userId={post.user_id} size={42} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                          <p
                            style={{ fontWeight: '700', fontSize: '1rem', color: textColor, cursor: 'pointer', margin: 0 }}
                            onClick={() => navigate(`/user/${post.user_id}`)}
                          >
                            {getName(post.user_id)}
                          </p>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color: statusColor,
                              background: `${statusColor}18`,
                              border: `1px solid ${statusColor}40`,
                              borderRadius: '100px',
                              padding: '1px 8px',
                              fontWeight: '600'
                            }}
                          >
                            {STATUS_LABELS[post.status]}
                          </span>
                        </div>
                        <p style={{ color: mutedColor, fontSize: '0.75rem', margin: 0 }}>{formatTime(post.created_at)}</p>
                      </div>
                      {isOwn && (
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          {post.status !== 'closed' ? (
                            <button
                              onClick={() => closePost(post.id)}
                              style={{
                                padding: '0.3rem 0.6rem',
                                background: 'rgba(239,68,68,0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '0.75rem'
                              }}
                            >
                              Close
                            </button>
                          ) : (
                            <button
                              onClick={() => reopenPost(post.id)}
                              style={{
                                padding: '0.3rem 0.6rem',
                                background: 'rgba(16,185,129,0.1)',
                                color: '#10b981',
                                border: '1px solid rgba(16,185,129,0.2)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '0.75rem'
                              }}
                            >
                              Reopen
                            </button>
                          )}
                          <button
                            onClick={() => deletePost(post.id)}
                            style={{ padding: '0.3rem 0.5rem', background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '0.85rem' }}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
                      <span style={{ background: 'rgba(108,99,255,0.12)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.25)', borderRadius: '100px', padding: '0.25rem 0.75rem', fontSize: '0.82rem', fontWeight: '600' }}>
                        🎮 {post.game}
                      </span>
                      {post.mode && post.mode !== 'Any' && (
                        <span style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)', color: mutedColor, border: `1px solid ${border}`, borderRadius: '100px', padding: '0.25rem 0.75rem', fontSize: '0.82rem' }}>
                          {post.mode}
                        </span>
                      )}
                      {post.rank && (
                        <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '100px', padding: '0.25rem 0.75rem', fontSize: '0.82rem' }}>
                          🏆 {post.rank}
                        </span>
                      )}
                      {post.region && post.region !== 'Any' && (
                        <span style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)', color: mutedColor, border: `1px solid ${border}`, borderRadius: '100px', padding: '0.25rem 0.75rem', fontSize: '0.82rem' }}>
                          🌍 {post.region}
                        </span>
                      )}
                      {post.mic_required && (
                        <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '100px', padding: '0.25rem 0.75rem', fontSize: '0.82rem' }}>
                          🎙️ Mic
                        </span>
                      )}
                      {post.age_range && post.age_range !== 'Any' && (
                        <span style={{ background: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)', color: mutedColor, border: `1px solid ${border}`, borderRadius: '100px', padding: '0.25rem 0.75rem', fontSize: '0.82rem' }}>
                          👤 {post.age_range}
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '0.95rem', color: textColor, lineHeight: 1.6, marginBottom: '1rem' }}>{post.description}</p>

                    {/* Slots bar */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.8rem', color: mutedColor }}>Slots filled</span>
                        <span style={{ fontSize: '0.8rem', color: textColor, fontWeight: '600' }}>{acceptedCount}/{post.slots}</span>
                      </div>
                      <div style={{ height: '6px', background: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min((acceptedCount / post.slots) * 100, 100)}%`,
                            background: isFull ? '#f59e0b' : 'linear-gradient(135deg, #6c63ff, #a78bfa)',
                            borderRadius: '3px',
                            transition: 'width 0.3s'
                          }}
                        />
                      </div>
                    </div>

                    {/* Squad panel — membership is computed live from accepted
                        requests, nothing stored separately. Deleting the post
                        removes this chat for everyone automatically. */}
                    {hasSquad && imAccepted && (
                      <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
                        <div
                          onClick={() => toggleChat(post.id)}
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        >
                          <p style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: '600', margin: 0 }}>
                            {isFull ? '🎉 Squad is full · ' : '🎮 Squad so far · '}
                            {acceptedCount + 1} player{acceptedCount + 1 !== 1 ? 's' : ''}
                          </p>
                          <span style={{ color: '#f59e0b', fontSize: '0.8rem' }}>{isChatOpen ? '▲ Hide chat' : '▼ Open chat'}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                          <div title={getName(post.user_id)} style={{ position: 'relative' }}>
                            <Avatar userId={post.user_id} size={30} />
                            <span style={{ position: 'absolute', bottom: -2, right: -2, fontSize: '0.7rem' }}>👑</span>
                          </div>
                          {acceptedRequests.map(req => (
                            <div key={req.id} title={getName(req.user_id)}>
                              <Avatar userId={req.user_id} size={30} />
                            </div>
                          ))}
                        </div>

                        {isChatOpen && (
                          <div style={{ marginTop: '0.9rem' }}>
                            <div
                              style={{
                                maxHeight: '260px',
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.6rem',
                                padding: '0.75rem',
                                background: isLight ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.2)',
                                borderRadius: '10px',
                                marginBottom: '0.6rem'
                              }}
                            >
                              {postMessages.length === 0 ? (
                                <p style={{ fontSize: '0.82rem', color: mutedColor, textAlign: 'center', margin: '0.5rem 0' }}>
                                  No messages yet. Say hey to your squad!
                                </p>
                              ) : (
                                postMessages.map(m => {
                                  const mine = m.user_id === currentUser?.id
                                  return (
                                    <div key={m.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', flexDirection: mine ? 'row-reverse' : 'row' }}>
                                      <Avatar userId={m.user_id} size={26} />
                                      <div style={{ maxWidth: '75%' }}>
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: mutedColor, textAlign: mine ? 'right' : 'left' }}>
                                          {getName(m.user_id)} · {formatTime(m.created_at)}
                                        </p>
                                        <p
                                          style={{
                                            margin: '0.15rem 0 0',
                                            fontSize: '0.87rem',
                                            color: textColor,
                                            background: mine ? 'rgba(108,99,255,0.18)' : (isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)'),
                                            padding: '0.5rem 0.7rem',
                                            borderRadius: '10px',
                                            wordBreak: 'break-word'
                                          }}
                                        >
                                          {m.content}
                                        </p>
                                      </div>
                                    </div>
                                  )
                                })
                              )}
                              <div ref={messagesEndRef} />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <input
                                type="text"
                                placeholder="Message your squad..."
                                value={chatDraft}
                                onChange={e => setChatDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(post.id) } }}
                                style={{ ...inputStyle, flex: 1 }}
                              />
                              <button
                                onClick={() => sendChatMessage(post.id)}
                                disabled={sendingMessage || !chatDraft.trim()}
                                style={{
                                  padding: '0 1.1rem',
                                  background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: sendingMessage || !chatDraft.trim() ? 'default' : 'pointer',
                                  opacity: sendingMessage || !chatDraft.trim() ? 0.5 : 1,
                                  fontFamily: 'Inter, sans-serif',
                                  fontWeight: '600',
                                  fontSize: '0.85rem'
                                }}
                              >
                                Send
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      {!isOwn && post.status === 'open' && (
                        myRequest ? (
                          <span
                            style={{
                              fontSize: '0.85rem',
                              color: myRequest.status === 'accepted' ? '#10b981' : myRequest.status === 'declined' ? '#ef4444' : mutedColor,
                              fontWeight: '600'
                            }}
                          >
                            {myRequest.status === 'accepted' ? '✅ Accepted!' : myRequest.status === 'declined' ? '❌ Declined' : '⏳ Request sent'}
                          </span>
                        ) : (
                          <button
                            onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                            style={{
                              padding: '0.6rem 1.25rem',
                              background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: '600',
                              fontSize: '0.9rem'
                            }}
                          >
                            Request to Join
                          </button>
                        )
                      )}
                      {isOwn && pendingCount > 0 && (
                        <button
                          onClick={() => setExpandedPost(isExpanded ? null : post.id)}
                          style={{
                            padding: '0.6rem 1.25rem',
                            background: 'rgba(245,158,11,0.15)',
                            color: '#f59e0b',
                            border: '1px solid rgba(245,158,11,0.3)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: '600',
                            fontSize: '0.9rem'
                          }}
                        >
                          {pendingCount} Request{pendingCount !== 1 ? 's' : ''} →
                        </button>
                      )}
                    </div>

                    {/* Request form */}
                    {isExpanded && !isOwn && !myRequest && (
                      <div style={{ marginTop: '1rem', padding: '1rem', background: isLight ? 'rgba(108,99,255,0.05)' : 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '12px' }}>
                        <p style={{ fontSize: '0.85rem', color: '#a78bfa', fontWeight: '600', marginBottom: '0.75rem' }}>Send a request</p>
                        <textarea
                          placeholder="Introduce yourself — your rank, playstyle, availability..."
                          value={myRequestMessage}
                          onChange={e => setMyRequestMessage(e.target.value)}
                          rows={2}
                          style={{ ...inputStyle, resize: 'none', marginBottom: '0.75rem' }}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setExpandedPost(null)}
                            style={{
                              padding: '0.5rem 0.85rem',
                              background: 'transparent',
                              color: mutedColor,
                              border: `1px solid ${inputBorder}`,
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontFamily: 'Inter, sans-serif',
                              fontSize: '0.85rem'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => sendRequest(post.id)}
                            disabled={sendingRequest}
                            style={{
                              padding: '0.5rem 1rem',
                              background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: sendingRequest ? 'default' : 'pointer',
                              opacity: sendingRequest ? 0.6 : 1,
                              fontFamily: 'Inter, sans-serif',
                              fontWeight: '600',
                              fontSize: '0.85rem'
                            }}
                          >
                            {sendingRequest ? 'Sending...' : 'Send'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Requests list for owner */}
                    {isExpanded && isOwn && postRequests.length > 0 && (
                      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <p style={{ fontSize: '0.85rem', color: mutedColor, fontWeight: '600', margin: 0 }}>Requests ({postRequests.length})</p>
                        {postRequests.map(req => (
                          <div
                            key={req.id}
                            style={{
                              padding: '0.85rem 1rem',
                              background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${border}`,
                              borderRadius: '10px',
                              display: 'flex',
                              gap: '0.75rem',
                              alignItems: 'flex-start'
                            }}
                          >
                            <Avatar userId={req.user_id} size={32} />
                            <div style={{ flex: 1 }}>
                              <p
                                style={{ fontWeight: '600', fontSize: '0.9rem', color: textColor, cursor: 'pointer', margin: 0, marginBottom: '0.2rem' }}
                                onClick={() => navigate(`/user/${req.user_id}`)}
                              >
                                {getName(req.user_id)}
                              </p>
                              {req.message && <p style={{ fontSize: '0.85rem', color: mutedColor, lineHeight: 1.4 }}>{req.message}</p>}
                            </div>
                            {req.status === 'pending' ? (
                              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                                <button
                                  onClick={() => respondToRequest(req.id, post.id, 'accepted')}
                                  disabled={respondingId === req.id}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    background: 'rgba(16,185,129,0.2)',
                                    color: '#10b981',
                                    border: '1px solid rgba(16,185,129,0.3)',
                                    borderRadius: '6px',
                                    cursor: respondingId === req.id ? 'default' : 'pointer',
                                    opacity: respondingId === req.id ? 0.5 : 1,
                                    fontFamily: 'Inter, sans-serif',
                                    fontSize: '0.82rem',
                                    fontWeight: '600'
                                  }}
                                >
                                  {respondingId === req.id ? '...' : 'Accept'}
                                </button>
                                <button
                                  onClick={() => respondToRequest(req.id, post.id, 'declined')}
                                  disabled={respondingId === req.id}
                                  style={{
                                    padding: '0.35rem 0.75rem',
                                    background: 'rgba(239,68,68,0.1)',
                                    color: '#ef4444',
                                    border: '1px solid rgba(239,68,68,0.2)',
                                    borderRadius: '6px',
                                    cursor: respondingId === req.id ? 'default' : 'pointer',
                                    opacity: respondingId === req.id ? 0.5 : 1,
                                    fontFamily: 'Inter, sans-serif',
                                    fontSize: '0.82rem',
                                    fontWeight: '600'
                                  }}
                                >
                                  Decline
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: req.status === 'accepted' ? '#10b981' : '#ef4444', fontWeight: '600', flexShrink: 0 }}>
                                {req.status === 'accepted' ? '✅ Accepted' : '❌ Declined'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  )
}