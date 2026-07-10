import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const LEVEL_ICONS = { beginner: '🌱', intermediate: '⚡', pro: '🔥' }
const PLATFORM_ICONS = { steam: '🖥️', epic: '🎮', playstation: '🎮', xbox: '🟢', nintendo: '🔴', mobile: '📱' }

const ACHIEVEMENT_CONFIG = {
  first_connection: { label: 'First Connection', icon: '🤝', desc: 'Made your first connection' },
  five_connections: { label: 'Social Butterfly', icon: '🦋', desc: 'Connected with 5 players' },
  first_group: { label: 'Team Player', icon: '👥', desc: 'Joined your first group' },
  group_leader: { label: 'Leader', icon: '👑', desc: 'Created a group' },
  profile_complete: { label: 'All Set', icon: '✅', desc: 'Completed your profile' },
}

export default function UserProfile({ theme }) {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mutualGames, setMutualGames] = useState([])
  const [isBlocked, setIsBlocked] = useState(false)
  const [achievements, setAchievements] = useState([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [userPosts, setUserPosts] = useState([])
  const [postLikes, setPostLikes] = useState({})

  const isLight = theme === 'light'
  const bg = isLight ? '#f0f0f7' : '#0f0f1a'
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const textColor = isLight ? '#111' : 'white'
  const mutedColor = isLight ? '#555' : '#888'
  const cardBg = isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.03)'

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(profileData)
      const { data: me } = await supabase.from('profiles').select('hobbies').eq('id', user.id).single()
      const mutual = (profileData?.hobbies || []).filter(h => (me?.hobbies || []).includes(h))
      setMutualGames(mutual)

      try {
        const { data: sent } = await supabase.from('connections').select('*').eq('sender_id', user.id).eq('receiver_id', userId).single()
        if (sent) setConnectionStatus(sent.status)
      } catch {}
      try {
        const { data: received } = await supabase.from('connections').select('*').eq('receiver_id', user.id).eq('sender_id', userId).single()
        if (received) setConnectionStatus(received.status)
      } catch {}

      try {
        const { data: blocked } = await supabase.from('blocked_users').select('id').eq('blocker_id', user.id).eq('blocked_id', userId).single()
        setIsBlocked(!!blocked)
      } catch {}

      const { data: ach } = await supabase.from('achievements').select('*').eq('user_id', userId)
      setAchievements(ach || [])

      try {
        const { data: followData } = await supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', userId).single()
        setIsFollowing(!!followData)
      } catch {}

      const { count: fCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId)
      setFollowerCount(fCount || 0)

      const { count: fgCount } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)
      setFollowingCount(fgCount || 0)

      const { data: posts } = await supabase.from('posts').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(6)
      setUserPosts(posts || [])
      if (posts && posts.length > 0) {
        const postIds = posts.map(p => p.id)
        const { data: likes } = await supabase.from('post_likes').select('*').in('post_id', postIds)
        const likesMap = {}
        likes?.forEach(l => { likesMap[l.post_id] = (likesMap[l.post_id] || 0) + 1 })
        setPostLikes(likesMap)
      }

      setLoading(false)
    }
    load()
  }, [userId])

  const sendRequest = async () => {
    const { error } = await supabase.from('connections').insert({ sender_id: currentUser.id, receiver_id: userId })
    if (error) alert(error.message)
    else setConnectionStatus('pending')
  }

  const toggleFollow = async () => {
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', userId)
      setIsFollowing(false)
      setFollowerCount(prev => prev - 1)
    } else {
      await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: userId })
      setIsFollowing(true)
      setFollowerCount(prev => prev + 1)
    }
  }

  const toggleBlock = async () => {
    if (isBlocked) {
      await supabase.from('blocked_users').delete().eq('blocker_id', currentUser.id).eq('blocked_id', userId)
      setIsBlocked(false)
    } else {
      await supabase.from('blocked_users').insert({ blocker_id: currentUser.id, blocked_id: userId })
      setIsBlocked(true)
    }
  }

  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const name = profile?.username || profile?.email?.split('@')[0] || 'Player'
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length]

  const POST_TYPE_LABELS = { general: '💬', lf_partner: '🎮', lf_team: '👥', clip: '🎬' }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', background: bg }}>
      <p style={{ color: mutedColor }}>Loading profile...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '2rem', background: bg, minHeight: 'calc(100vh - 64px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', padding: 0 }}>← Back</button>
        {currentUser?.id !== userId && (
          <button onClick={toggleBlock} style={{ background: isBlocked ? 'rgba(239,68,68,0.1)' : 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '8px', padding: '0.4rem 0.85rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>
            {isBlocked ? '🚫 Unblock' : '🚫 Block'}
          </button>
        )}
      </div>

      {/* Header */}
      <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '20px', padding: '2rem', marginBottom: '1.5rem', textAlign: 'center' }}>
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt={name} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem' }} />
        ) : (
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '2rem', margin: '0 auto 1rem', color: 'white' }}>
            {name[0]?.toUpperCase()}
          </div>
        )}
        <h2 style={{ fontWeight: '700', fontSize: '1.5rem', marginBottom: '0.25rem', color: textColor }}>{name}</h2>

        {profile?.bio && <p style={{ color: mutedColor, fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5, maxWidth: '400px', margin: '0 auto 1rem' }}>{profile.bio}</p>}

        {/* Stats */}
        <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: '700', fontSize: '1.2rem', color: textColor, margin: 0 }}>{followerCount}</p>
            <p style={{ color: mutedColor, fontSize: '0.8rem', margin: 0 }}>Followers</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: '700', fontSize: '1.2rem', color: textColor, margin: 0 }}>{followingCount}</p>
            <p style={{ color: mutedColor, fontSize: '0.8rem', margin: 0 }}>Following</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: '700', fontSize: '1.2rem', color: textColor, margin: 0 }}>{userPosts.length}</p>
            <p style={{ color: mutedColor, fontSize: '0.8rem', margin: 0 }}>Posts</p>
          </div>
        </div>

        {mutualGames.length > 0 && <p style={{ color: '#a78bfa', fontSize: '0.85rem', marginBottom: '1rem' }}>🎮 {mutualGames.length} game{mutualGames.length > 1 ? 's' : ''} in common</p>}

        {profile?.discord_username && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(88,101,242,0.15)', border: '1px solid rgba(88,101,242,0.3)', borderRadius: '100px', padding: '0.3rem 0.9rem', marginBottom: '1rem' }}>
            <span>💬</span>
            <span style={{ color: '#a5b4fc', fontSize: '0.85rem', fontWeight: '600' }}>{profile.discord_username}</span>
          </div>
        )}

        {profile?.platforms?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {profile.platforms.map(p => (
              <span key={p} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${border}`, borderRadius: '100px', padding: '0.3rem 0.75rem', fontSize: '0.8rem', color: mutedColor }}>
                {PLATFORM_ICONS[p] || '🎮'} {p.charAt(0).toUpperCase() + p.slice(1)}
              </span>
            ))}
          </div>
        )}

        {/* Action buttons */}
        {currentUser?.id !== userId && !isBlocked && (
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={toggleFollow} style={{ padding: '0.7rem 1.5rem', background: isFollowing ? 'rgba(108,99,255,0.15)' : 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: isFollowing ? '#a78bfa' : 'white', border: isFollowing ? '1px solid rgba(108,99,255,0.3)' : 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.9rem' }}>
              {isFollowing ? '✓ Following' : '+ Follow'}
            </button>
            {connectionStatus === 'accepted' ? (
              <>
                <button onClick={() => navigate(`/chat/${userId}`)} style={{ padding: '0.7rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>💬 Message</button>
                <span style={{ padding: '0.7rem 1.5rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', fontWeight: '600', fontSize: '0.9rem' }}>✓ Connected</span>
              </>
            ) : connectionStatus === 'pending' ? (
              <span style={{ padding: '0.7rem 1.5rem', background: 'rgba(255,255,255,0.05)', color: mutedColor, border: `1px solid ${border}`, borderRadius: '10px', fontWeight: '600', fontSize: '0.9rem' }}>⏳ Pending</span>
            ) : (
              <button onClick={sendRequest} style={{ padding: '0.7rem 1.5rem', background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.9rem' }}>🤝 Connect</button>
            )}
          </div>
        )}
        {isBlocked && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>You have blocked this user.</p>}
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: '700', marginBottom: '1rem', fontSize: '1rem', color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Achievements</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {achievements.map(a => {
              const cfg = ACHIEVEMENT_CONFIG[a.type]
              if (!cfg) return null
              return (
                <div key={a.id} title={cfg.desc} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '100px', padding: '0.3rem 0.85rem' }}>
                  <span>{cfg.icon}</span>
                  <span style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: '600' }}>{cfg.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent posts */}
      {userPosts.length > 0 && (
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '20px', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: '700', fontSize: '1rem', color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Recent Posts</h3>
            <button onClick={() => navigate('/feed')} style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}>See all →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {userPosts.map(post => (
              <div key={post.id} onClick={() => navigate('/feed')} style={{ background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', border: `1px solid ${border}`, borderRadius: '10px', padding: '0.75rem', cursor: 'pointer', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {post.media_url && post.media_type === 'image' && (
                  <img src={post.media_url} alt="" style={{ width: '100%', height: '60px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.4rem' }} />
                )}
                {post.media_url && post.media_type === 'video' && (
                  <div style={{ width: '100%', height: '60px', background: '#000', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.4rem', fontSize: '1.5rem' }}>🎬</div>
                )}
                <p style={{ fontSize: '0.78rem', color: textColor, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {POST_TYPE_LABELS[post.post_type]} {post.content || ''}
                </p>
                <p style={{ fontSize: '0.7rem', color: mutedColor, margin: 0, marginTop: '0.25rem' }}>❤️ {postLikes[post.id] || 0}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Games */}
      {profile?.hobbies?.length > 0 && (
        <div style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '20px', padding: '1.5rem' }}>
          <h3 style={{ fontWeight: '700', marginBottom: '1rem', fontSize: '1rem', color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Games</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {profile.hobbies.map(game => {
              const level = profile.game_levels?.[game]
              const isMutual = mutualGames.includes(game)
              return (
                <div key={game} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: isMutual ? 'rgba(108,99,255,0.08)' : isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)', borderRadius: '10px', border: isMutual ? '1px solid rgba(108,99,255,0.2)' : `1px solid ${border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {isMutual && <span style={{ fontSize: '0.7rem', color: '#a78bfa' }}>●</span>}
                    <p style={{ fontWeight: '500', fontSize: '0.95rem', color: textColor }}>{game}</p>
                  </div>
                  {level && <span style={{ fontSize: '0.85rem', color: mutedColor }}>{LEVEL_ICONS[level]} {level.charAt(0).toUpperCase() + level.slice(1)}</span>}
                </div>
              )
            })}
          </div>
          {mutualGames.length > 0 && <p style={{ color: mutedColor, fontSize: '0.75rem', marginTop: '0.75rem' }}>● Games you both play</p>}
        </div>
      )}
    </div>
  )
}