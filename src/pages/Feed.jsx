import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const POST_TYPES = [
  { id: 'general', label: '💬 General', desc: 'Share anything gaming' },
  { id: 'lf_partner', label: '🎮 LF Partner', desc: 'Looking for a duo/partner' },
  { id: 'lf_team', label: '👥 LF Team', desc: 'Looking for a full team' },
  { id: 'clip', label: '🎬 Clip', desc: 'Share a video or highlight' },
]

const TYPE_COLORS = {
  general: '#6c63ff',
  lf_partner: '#10b981',
  lf_team: '#f59e0b',
  clip: '#ef4444',
}

export default function Feed({ theme }) {
  const [posts, setPosts] = useState([])
  const [profiles, setProfiles] = useState({})
  const [likes, setLikes] = useState({})
  const [comments, setComments] = useState({})
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newPost, setNewPost] = useState({ content: '', post_type: 'general', game: '', rank: '' })
  const [mediaFile, setMediaFile] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [feedTab, setFeedTab] = useState('all')
  const [followingIds, setFollowingIds] = useState([])
  const [openComments, setOpenComments] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [followingMap, setFollowingMap] = useState({})
  const [showcasedPostIds, setShowcasedPostIds] = useState([])
  const mediaInputRef = useRef(null)
  const currentUserRef = useRef(null)
  const navigate = useNavigate()

  const isLight = theme === 'light'
  const bg = isLight ? '#f0f0f7' : '#0f0f1a'
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const textColor = isLight ? '#111' : 'white'
  const mutedColor = isLight ? '#555' : '#888'
  const cardBg = isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.03)'
  const inputBg = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'
  const inputBorder = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      currentUserRef.current = user

      const { data: followsData } = await supabase.from('follows').select('following_id').eq('follower_id', user.id)
      const ids = followsData?.map(f => f.following_id) || []
      setFollowingIds(ids)
      const fMap = {}
      ids.forEach(id => { fMap[id] = true })
      setFollowingMap(fMap)

      // Load showcased posts
      const { data: profileData } = await supabase.from('profiles').select('showcase_posts').eq('id', user.id).single()
      setShowcasedPostIds(profileData?.showcase_posts || [])

      await loadPosts()
      setLoading(false)
    }
    load()
  }, [])

  // Separate realtime subscription that doesn't cause duplicates
  useEffect(() => {
    if (!currentUser) return
    const channel = supabase.channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
        const newPost = payload.new
        setPosts(prev => {
          if (prev.some(p => p.id === newPost.id)) return prev
          return [newPost, ...prev]
        })
        // Load profile for new post author if needed
        setProfiles(prev => {
          if (prev[newPost.user_id]) return prev
          supabase.from('profiles').select('*').eq('id', newPost.user_id).single().then(({ data }) => {
            if (data) setProfiles(p => ({ ...p, [data.id]: data }))
          })
          return prev
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, payload => {
        setPosts(prev => prev.filter(p => p.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_likes' }, payload => {
        const l = payload.new
        setLikes(prev => {
          const existing = prev[l.post_id] || []
          if (existing.some(x => x.id === l.id)) return prev
          return { ...prev, [l.post_id]: [...existing, l] }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_likes' }, payload => {
        const l = payload.old
        setLikes(prev => ({ ...prev, [l.post_id]: (prev[l.post_id] || []).filter(x => x.id !== l.id) }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_comments' }, payload => {
        const c = payload.new
        setComments(prev => {
          const existing = prev[c.post_id] || []
          if (existing.some(x => x.id === c.id)) return prev
          return { ...prev, [c.post_id]: [...existing, c] }
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [currentUser])

  const loadPosts = async () => {
    const { data: postsData } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(100)
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

    const { data: likesData } = await supabase.from('post_likes').select('*').in('post_id', postIds)
    const likesMap = {}
    likesData?.forEach(l => {
      if (!likesMap[l.post_id]) likesMap[l.post_id] = []
      // Deduplicate by id
      if (!likesMap[l.post_id].some(x => x.id === l.id)) likesMap[l.post_id].push(l)
    })
    setLikes(likesMap)

    const { data: commentsData } = await supabase.from('post_comments').select('*').in('post_id', postIds).order('created_at', { ascending: true })
    const commentsMap = {}
    commentsData?.forEach(c => {
      if (!commentsMap[c.post_id]) commentsMap[c.post_id] = []
      if (!commentsMap[c.post_id].some(x => x.id === c.id)) commentsMap[c.post_id].push(c)
    })
    setComments(commentsMap)
  }

  const toggleFollowUser = async (targetUserId) => {
    const isCurrentlyFollowing = followingMap[targetUserId]
    if (isCurrentlyFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', targetUserId)
      setFollowingMap(prev => { const n = { ...prev }; delete n[targetUserId]; return n })
      setFollowingIds(prev => prev.filter(id => id !== targetUserId))
    } else {
      await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: targetUserId })
      setFollowingMap(prev => ({ ...prev, [targetUserId]: true }))
      setFollowingIds(prev => [...prev, targetUserId])
    }
  }

  const toggleShowcase = async (postId) => {
    let newShowcase
    if (showcasedPostIds.includes(postId)) {
      newShowcase = showcasedPostIds.filter(id => id !== postId)
    } else {
      if (showcasedPostIds.length >= 3) return alert('You can only showcase up to 3 posts. Remove one first.')
      newShowcase = [...showcasedPostIds, postId]
    }
    setShowcasedPostIds(newShowcase)
    await supabase.from('profiles').update({ showcase_posts: newShowcase }).eq('id', currentUser.id)
  }

  const handleMediaChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) return alert('File must be under 50MB')
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }

  const createPost = async () => {
    if (!newPost.content.trim() && !mediaFile) return alert('Please add some content')
    setUploading(true)
    let mediaUrl = null
    let mediaType = null
    if (mediaFile) {
      const ext = mediaFile.name.split('.').pop()
      const fileName = `${currentUser.id}-${Date.now()}.${ext}`
      const bucket = mediaFile.type.startsWith('video/') ? 'post-videos' : 'post-images'
      mediaType = mediaFile.type.startsWith('video/') ? 'video' : 'image'
      const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, mediaFile)
      if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploading(false); return }
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName)
      mediaUrl = publicUrl
    }
    const { error } = await supabase.from('posts').insert({
      user_id: currentUser.id,
      content: newPost.content.trim(),
      media_url: mediaUrl,
      media_type: mediaType,
      post_type: newPost.post_type,
      game: newPost.game.trim() || null,
      rank: newPost.rank.trim() || null,
    })
    if (error) { alert(error.message); setUploading(false); return }
    setNewPost({ content: '', post_type: 'general', game: '', rank: '' })
    setMediaFile(null)
    setMediaPreview(null)
    setShowCreate(false)
    setUploading(false)
  }

  const toggleLike = async (postId) => {
    const user = currentUserRef.current
    const existing = (likes[postId] || []).find(l => l.user_id === user.id)
    if (existing) {
      // Optimistic remove
      setLikes(prev => ({ ...prev, [postId]: prev[postId].filter(l => l.id !== existing.id) }))
      await supabase.from('post_likes').delete().eq('id', existing.id)
    } else {
      // Optimistic add with temp id
      const tempId = `temp-${Date.now()}`
      setLikes(prev => ({ ...prev, [postId]: [...(prev[postId] || []), { id: tempId, post_id: postId, user_id: user.id }] }))
      const { data } = await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id }).select().single()
      if (data) {
        setLikes(prev => ({ ...prev, [postId]: prev[postId].map(l => l.id === tempId ? data : l) }))
      }
    }
  }

  const submitComment = async (postId) => {
    if (!newComment.trim()) return
    const content = newComment.trim()
    setNewComment('')
    const tempId = `temp-${Date.now()}`
    const tempComment = { id: tempId, post_id: postId, user_id: currentUser.id, content, created_at: new Date() }
    setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), tempComment] }))
    const { data } = await supabase.from('post_comments').insert({ post_id: postId, user_id: currentUser.id, content }).select().single()
    if (data) setComments(prev => ({ ...prev, [postId]: prev[postId].map(c => c.id === tempId ? data : c) }))
  }

  const deletePost = async (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId))
    await supabase.from('posts').delete().eq('id', postId)
  }

  const getName = (uid) => { const p = profiles[uid]; return p?.username || p?.email?.split('@')[0] || 'Player' }
  const getAvatar = (uid) => profiles[uid]?.avatar_url
  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const getColor = (uid) => { const n = getName(uid); return avatarColors[n.charCodeAt(0) % avatarColors.length] }

  const Avatar = ({ userId, size = 36 }) => {
    const url = getAvatar(userId)
    const n = getName(userId)
    if (url) return <img src={url} alt={n} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }} onClick={() => navigate(`/user/${userId}`)} />
    return <div onClick={() => navigate(`/user/${userId}`)} style={{ width: size, height: size, borderRadius: '50%', background: getColor(userId), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: '700', flexShrink: 0, color: 'white', cursor: 'pointer' }}>{n[0]?.toUpperCase()}</div>
  }

  const formatTime = (date) => {
    const d = new Date(date)
    const diff = new Date() - d
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    return d.toLocaleDateString()
  }

  const visiblePosts = posts
    .filter(p => feedTab === 'following' ? followingIds.includes(p.user_id) || p.user_id === currentUser?.id : true)
    .filter(p => filterType === 'all' ? true : p.post_type === filterType)

  const showcasedPosts = posts.filter(p => showcasedPostIds.includes(p.id))

  const PostCard = ({ post }) => {
    const postLikes = likes[post.id] || []
    const postComments = comments[post.id] || []
    const isLiked = postLikes.some(l => l.user_id === currentUser?.id)
    const isOwn = post.user_id === currentUser?.id
    const typeColor = TYPE_COLORS[post.post_type] || '#6c63ff'
    const typeLabel = POST_TYPES.find(t => t.id === post.post_type)?.label || '💬 General'
    const isCommentsOpen = openComments === post.id
    const isUserFollowed = followingMap[post.user_id]
    const isShowcased = showcasedPostIds.includes(post.id)

    return (
      <div style={{ background: cardBg, border: isShowcased ? '1px solid rgba(245,158,11,0.4)' : `1px solid ${border}`, borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.25rem 0' }}>
          {isShowcased && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '100px', padding: '1px 8px', fontWeight: '600' }}>📌 Showcased</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <Avatar userId={post.user_id} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <p style={{ fontWeight: '600', fontSize: '0.95rem', color: textColor, cursor: 'pointer', margin: 0 }} onClick={() => navigate(`/user/${post.user_id}`)}>{getName(post.user_id)}</p>
                <span style={{ fontSize: '0.72rem', color: typeColor, background: `${typeColor}18`, border: `1px solid ${typeColor}40`, borderRadius: '100px', padding: '1px 8px', fontWeight: '600' }}>{typeLabel}</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: mutedColor, margin: 0 }}>{formatTime(post.created_at)}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
              {!isOwn && (
                <button onClick={() => toggleFollowUser(post.user_id)} style={{ padding: '0.3rem 0.7rem', background: isUserFollowed ? 'rgba(108,99,255,0.1)' : 'transparent', color: isUserFollowed ? '#a78bfa' : mutedColor, border: `1px solid ${isUserFollowed ? 'rgba(108,99,255,0.3)' : border}`, borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                  {isUserFollowed ? '✓ Following' : '+ Follow'}
                </button>
              )}
              {isOwn && (
                <button onClick={() => toggleShowcase(post.id)} title={isShowcased ? 'Remove from showcase' : 'Add to showcase (max 3)'} style={{ padding: '0.3rem 0.5rem', background: isShowcased ? 'rgba(245,158,11,0.15)' : 'transparent', color: isShowcased ? '#f59e0b' : mutedColor, border: `1px solid ${isShowcased ? 'rgba(245,158,11,0.3)' : border}`, borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  {isShowcased ? '⭐' : '☆'}
                </button>
              )}
              {isOwn && (
                <button onClick={() => deletePost(post.id)} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '0.85rem', padding: '0.25rem' }}>🗑️</button>
              )}
            </div>
          </div>

          {(post.game || post.rank) && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {post.game && <span style={{ background: 'rgba(108,99,255,0.12)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.25)', borderRadius: '100px', padding: '0.2rem 0.7rem', fontSize: '0.78rem', fontWeight: '500' }}>🎮 {post.game}</span>}
              {post.rank && <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '100px', padding: '0.2rem 0.7rem', fontSize: '0.78rem', fontWeight: '500' }}>🏆 {post.rank}</span>}
            </div>
          )}

          {post.content && <p style={{ fontSize: '0.95rem', lineHeight: 1.6, color: textColor, marginBottom: '0.75rem', whiteSpace: 'pre-wrap' }}>{post.content}</p>}
        </div>

        {post.media_url && (
          <div style={{ marginBottom: '0.5rem' }}>
            {post.media_type === 'video' ? (
              <video src={post.media_url} controls style={{ width: '100%', maxHeight: '400px', background: '#000' }} />
            ) : (
              <img src={post.media_url} alt="post" style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', cursor: 'pointer' }} onClick={() => window.open(post.media_url, '_blank')} />
            )}
          </div>
        )}

        <div style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', borderTop: `1px solid ${border}` }}>
          <button onClick={() => toggleLike(post.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: isLiked ? '#ef4444' : mutedColor, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: isLiked ? '600' : '400', padding: 0 }}>
            {isLiked ? '❤️' : '🤍'} {postLikes.length}
          </button>
          <button onClick={() => setOpenComments(isCommentsOpen ? null : post.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: isCommentsOpen ? '#a78bfa' : mutedColor, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', padding: 0 }}>
            💬 {postComments.length}
          </button>
          {(post.post_type === 'lf_partner' || post.post_type === 'lf_team') && !isOwn && (
            <button onClick={() => navigate(`/user/${post.user_id}`)} style={{ marginLeft: 'auto', padding: '0.4rem 1rem', background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}40`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: '600' }}>
              Connect →
            </button>
          )}
        </div>

        {isCommentsOpen && (
          <div style={{ padding: '0.75rem 1.25rem 1.25rem', borderTop: `1px solid ${border}` }}>
            {postComments.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                {postComments.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <Avatar userId={c.user_id} size={28} />
                    <div style={{ background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '0.5rem 0.85rem', flex: 1 }}>
                      <p style={{ fontSize: '0.78rem', color: mutedColor, marginBottom: '0.2rem' }}>{getName(c.user_id)}</p>
                      <p style={{ fontSize: '0.9rem', color: textColor, lineHeight: 1.4 }}>{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Avatar userId={currentUser?.id} size={28} />
              <input type="text" placeholder="Write a comment..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitComment(post.id)} style={{ flex: 1, padding: '0.55rem 0.9rem', borderRadius: '20px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.88rem', outline: 'none' }} />
              <button onClick={() => submitComment(post.id)} style={{ padding: '0.55rem 0.9rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem' }}>Post</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: bg, padding: '1.5rem' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', margin: 0, color: textColor }}>Feed</h2>
            <p style={{ color: mutedColor, margin: 0, fontSize: '0.9rem' }}>Gaming posts, clips & partner requests</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.95rem' }}>
            + Post
          </button>
        </div>

        {/* Showcase strip — only show your own showcased posts */}
        {showcasedPosts.length > 0 && (
          <div style={{ background: cardBg, border: '1px solid rgba(245,158,11,0.2)', borderRadius: '14px', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>⭐ Your Showcase</p>
            <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {showcasedPosts.map(post => (
                <div key={post.id} style={{ background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)', border: `1px solid ${border}`, borderRadius: '10px', padding: '0.75rem', minWidth: '180px', maxWidth: '180px', flexShrink: 0 }}>
                  {post.media_url && post.media_type === 'image' && (
                    <img src={post.media_url} alt="" style={{ width: '100%', height: '80px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.5rem' }} />
                  )}
                  {post.media_url && post.media_type === 'video' && (
                    <div style={{ width: '100%', height: '80px', background: '#000', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎬</div>
                  )}
                  <p style={{ fontSize: '0.82rem', color: textColor, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '0.4rem' }}>
                    {post.content || (post.media_type === 'video' ? '🎬 Video clip' : '🖼️ Image post')}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: mutedColor }}>❤️ {(likes[post.id] || []).length}</span>
                    <button onClick={() => toggleShowcase(post.id)} style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', fontSize: '0.75rem', padding: 0, fontFamily: 'Inter, sans-serif' }}>Remove</button>
                  </div>
                </div>
              ))}
              {showcasedPostIds.length < 3 && (
                <div style={{ background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', border: `1px dashed ${border}`, borderRadius: '10px', padding: '0.75rem', minWidth: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.4rem', color: mutedColor, fontSize: '0.8rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>☆</span>
                  <span>Pin a post</span>
                  <span style={{ fontSize: '0.7rem' }}>{3 - showcasedPostIds.length} left</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feed tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '0.35rem' }}>
          {[{ id: 'all', label: '🌐 For You' }, { id: 'following', label: `👥 Following (${followingIds.length})` }].map(tab => (
            <button key={tab.id} onClick={() => setFeedTab(tab.id)} style={{ flex: 1, padding: '0.6rem', background: feedTab === tab.id ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : 'transparent', color: feedTab === tab.id ? 'white' : mutedColor, border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: feedTab === tab.id ? '600' : '400', fontSize: '0.9rem', transition: 'all 0.2s' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Create post */}
        {showCreate && (
          <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontWeight: '600', marginBottom: '1rem', color: textColor, fontSize: '1rem' }}>Create Post</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {POST_TYPES.map(t => (
                <button key={t.id} onClick={() => setNewPost(p => ({ ...p, post_type: t.id }))} style={{ padding: '0.4rem 0.9rem', background: newPost.post_type === t.id ? `${TYPE_COLORS[t.id]}20` : inputBg, color: newPost.post_type === t.id ? TYPE_COLORS[t.id] : mutedColor, border: newPost.post_type === t.id ? `1px solid ${TYPE_COLORS[t.id]}60` : `1px solid ${inputBorder}`, borderRadius: '100px', cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'Inter, sans-serif', fontWeight: '500' }}>
                  {t.label}
                </button>
              ))}
            </div>
            <textarea placeholder={newPost.post_type === 'lf_partner' ? "What game? What rank? What are you looking for?" : newPost.post_type === 'lf_team' ? "What game? What roles do you need?" : newPost.post_type === 'clip' ? "Describe your clip..." : "What's on your mind?"} value={newPost.content} onChange={e => setNewPost(p => ({ ...p, content: e.target.value }))} rows={3} style={{ width: '100%', padding: '0.85rem 1rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: '0.75rem' }} />
            {(newPost.post_type === 'lf_partner' || newPost.post_type === 'lf_team') && (
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <input type="text" placeholder="Game (e.g. Valorant)" value={newPost.game} onChange={e => setNewPost(p => ({ ...p, game: e.target.value }))} style={{ flex: 1, padding: '0.65rem 1rem', borderRadius: '8px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }} />
                <input type="text" placeholder="Rank (e.g. Gold 2)" value={newPost.rank} onChange={e => setNewPost(p => ({ ...p, rank: e.target.value }))} style={{ flex: 1, padding: '0.65rem 1rem', borderRadius: '8px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }} />
              </div>
            )}
            {mediaPreview && (
              <div style={{ position: 'relative', marginBottom: '0.75rem', borderRadius: '12px', overflow: 'hidden' }}>
                {mediaFile?.type.startsWith('video/') ? (
                  <video src={mediaPreview} controls style={{ width: '100%', borderRadius: '12px', maxHeight: '300px' }} />
                ) : (
                  <img src={mediaPreview} alt="preview" style={{ width: '100%', borderRadius: '12px', maxHeight: '300px', objectFit: 'cover' }} />
                )}
                <button onClick={() => { setMediaFile(null); setMediaPreview(null) }} style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '0.9rem' }}>✕</button>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <input type="file" accept="image/*,video/*" ref={mediaInputRef} onChange={handleMediaChange} style={{ display: 'none' }} />
                <button onClick={() => mediaInputRef.current.click()} style={{ padding: '0.5rem 0.85rem', background: inputBg, color: mutedColor, border: `1px solid ${inputBorder}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}>📎 Media</button>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => { setShowCreate(false); setMediaFile(null); setMediaPreview(null) }} style={{ padding: '0.6rem 1rem', background: 'transparent', color: mutedColor, border: `1px solid ${inputBorder}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem' }}>Cancel</button>
                <button onClick={createPost} disabled={uploading} style={{ padding: '0.6rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '8px', cursor: uploading ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.9rem', opacity: uploading ? 0.7 : 1 }}>
                  {uploading ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {[{ id: 'all', label: '🌐 All' }, ...POST_TYPES].map(t => (
            <button key={t.id} onClick={() => setFilterType(t.id)} style={{ padding: '0.5rem 1rem', background: filterType === t.id ? 'rgba(108,99,255,0.15)' : inputBg, color: filterType === t.id ? '#a78bfa' : mutedColor, border: filterType === t.id ? '1px solid rgba(108,99,255,0.3)' : `1px solid ${inputBorder}`, borderRadius: '100px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', fontWeight: filterType === t.id ? '600' : '400', whiteSpace: 'nowrap' }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1,2,3].map(i => <div key={i} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '16px', height: '160px', animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : visiblePosts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: mutedColor }}>
            <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🎮</p>
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem', color: textColor, fontWeight: '600' }}>
              {feedTab === 'following' ? 'No posts from people you follow' : 'No posts yet'}
            </p>
            <p>{feedTab === 'following' ? 'Follow some players to see their posts here!' : 'Be the first to post!'}</p>
            {feedTab === 'following' && (
              <button onClick={() => setFeedTab('all')} style={{ marginTop: '1rem', padding: '0.6rem 1.5rem', background: 'rgba(108,99,255,0.15)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Browse all posts</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {visiblePosts.map(post => <PostCard key={post.id} post={post} />)}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  )
}