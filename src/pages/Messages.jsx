import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Messages() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (!msgs || msgs.length === 0) {
        setLoading(false)
        return
      }

      const convMap = {}
      msgs.forEach(msg => {
        const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
        if (!convMap[otherId]) {
          convMap[otherId] = { userId: otherId, lastMessage: msg, unread: 0 }
        }
        if (msg.sender_id !== user.id && !msg.read_at) {
          convMap[otherId].unread++
        }
      })

      const userIds = Object.keys(convMap)
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', userIds)
      const profileMap = {}
      profiles?.forEach(p => { profileMap[p.id] = p })

      const sorted = Object.values(convMap)
        .sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at))
        .map(c => ({ ...c, profile: profileMap[c.userId] }))

      setConversations(sorted)
      setLoading(false)
    }
    load()

    const channel = supabase.channel('messages-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const getColor = (name) => avatarColors[name?.charCodeAt(0) % avatarColors.length]
  const getName = (profile) => profile?.username || profile?.email?.split('@')[0] || 'Player'

  const formatTime = (date) => {
    const d = new Date(date)
    const diff = new Date() - d
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  const previewMessage = (msg) => {
    if (msg.content?.startsWith('[image]')) return '📷 Image'
    return msg.content?.length > 40 ? msg.content.substring(0, 40) + '...' : msg.content
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
      <p style={{ color: '#888' }}>Loading messages...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>Messages</h2>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Your conversations</p>

      {conversations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>💬</p>
          <p style={{ color: '#888' }}>No conversations yet. Connect with someone to start chatting!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {conversations.map(conv => {
            const name = getName(conv.profile)
            const color = getColor(name)
            const isFromMe = conv.lastMessage.sender_id === currentUser?.id
            return (
              <div
                key={conv.userId}
                onClick={() => navigate(`/chat/${conv.userId}`)}
                style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: conv.unread > 0 ? 'rgba(108,99,255,0.08)' : 'rgba(255,255,255,0.03)', border: conv.unread > 0 ? '1px solid rgba(108,99,255,0.2)' : '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {conv.profile?.avatar_url ? (
                    <img src={conv.profile.avatar_url} alt={name} style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '1.1rem' }}>
                      {name[0]?.toUpperCase()}
                    </div>
                  )}
                  {conv.unread > 0 && (
                    <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '18px', height: '18px', borderRadius: '50%', background: '#6c63ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: '700', color: 'white' }}>
                      {conv.unread > 9 ? '9+' : conv.unread}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <p style={{ fontWeight: conv.unread > 0 ? '700' : '600', fontSize: '0.95rem' }}>{name}</p>
                    <p style={{ fontSize: '0.75rem', color: '#666', flexShrink: 0 }}>{formatTime(conv.lastMessage.created_at)}</p>
                  </div>
                  <p style={{ color: conv.unread > 0 ? '#ccc' : '#666', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {isFromMe ? 'You: ' : ''}{previewMessage(conv.lastMessage)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}