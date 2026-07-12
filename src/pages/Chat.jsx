import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const formatLastSeen = (date) => {
  if (!date) return 'Offline'
  const d = new Date(date)
  const diff = new Date() - d
  if (diff < 60000) return 'Last seen just now'
  if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `Last seen ${Math.floor(diff / 86400000)}d ago`
  return `Last seen ${d.toLocaleDateString()}`
}

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp)
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

const formatShortTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

const formatDateDivider = (timestamp) => {
  const d = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const sameDay = (a, b) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
}

const formatConvTime = (timestamp) => {
  const d = new Date(timestamp)
  const diff = new Date() - d
  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const makeTempId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp-${Math.random().toString(36).slice(2)}`)

// Messages from the same sender within this window (and same day) visually
// collapse into one group, like Discord/Slack — cuts down on repeated
// timestamps/tails and makes back-and-forth bursts easier to scan.
const GROUP_WINDOW_MS = 5 * 60 * 1000

const EMOJI_OPTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

export default function Chat({ theme }) {
  const { userId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [messages, setMessages] = useState([])
  const [reactions, setReactions] = useState({})
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [isOtherOnline, setIsOtherOnline] = useState(false)
  const [isOtherTyping, setIsOtherTyping] = useState(false)
  const [hoveredMsg, setHoveredMsg] = useState(null)
  const [emojiPickerMsg, setEmojiPickerMsg] = useState(null)
  const [replyTo, setReplyTo] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [highlightedMsgId, setHighlightedMsgId] = useState(null)
  const [editingMsgId, setEditingMsgId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const [conversations, setConversations] = useState([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [convSearch, setConvSearch] = useState('')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [infoPanelOpen, setInfoPanelOpen] = useState(true)
  const [lightboxImage, setLightboxImage] = useState(null)
  const [onlineIds, setOnlineIds] = useState({})
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)
  const searchInputRef = useRef(null)
  const presenceChannelRef = useRef(null)
  const broadcastChannelRef = useRef(null)
  const conversationsChannelRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const userIdRef = useRef(userId)
  const msgRefs = useRef({})

  const isLight = theme === 'light'
  const bg          = isLight ? '#f0f0f7'                : '#0f0f1a'
  const border      = isLight ? 'rgba(0,0,0,0.08)'       : 'rgba(255,255,255,0.08)'
  const textColor   = isLight ? '#111'                   : 'white'
  const mutedColor  = isLight ? '#555'                   : '#888'
  const inputBg     = isLight ? 'rgba(255,255,255,0.9)'  : 'rgba(255,255,255,0.06)'
  const inputBorder = isLight ? 'rgba(0,0,0,0.1)'        : 'rgba(255,255,255,0.1)'
  const bubbleOther = isLight ? '#ffffff'                : 'rgba(255,255,255,0.07)'
  const headerBg    = isLight ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.04)'
  const panelShadow = isLight ? '0 4px 24px rgba(17,17,17,0.06)' : '0 4px 24px rgba(0,0,0,0.35)'
  const sidebarBg   = isLight ? 'rgba(255,255,255,0.6)'  : 'rgba(255,255,255,0.03)'
  const panelBg     = isLight ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.025)'

  const avatarColorFor = (n) => {
    const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
    return avatarColors[(n?.charCodeAt(0) || 0) % avatarColors.length]
  }

  useEffect(() => { userIdRef.current = userId }, [userId])

  // Switch to a different conversation (updates the route, existing effects re-trigger on userId change)
  const openConversation = (otherId) => {
    if (otherId === userId) { setMobileSidebarOpen(false); return }
    const newPath = location.pathname.replace(userId, otherId)
    navigate(newPath)
    setMobileSidebarOpen(false)
  }

  // Load the list of people the current user has exchanged messages with
  const loadConversations = async (me) => {
    setConversationsLoading(true)
    const { data: msgs } = await supabase.from('messages').select('*')
      .or(`sender_id.eq.${me},receiver_id.eq.${me}`)
      .order('created_at', { ascending: false })
    if (!msgs) { setConversationsLoading(false); return }

    const map = {}
    msgs.forEach(m => {
      const otherId = m.sender_id === me ? m.receiver_id : m.sender_id
      if (!map[otherId]) {
        map[otherId] = { otherId, lastMessage: m, unreadCount: 0 }
      }
      if (m.receiver_id === me && !m.read_at) map[otherId].unreadCount += 1
    })

    const otherIds = Object.keys(map)
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', otherIds)
      profiles?.forEach(p => { if (map[p.id]) map[p.id].profile = p })
    }

    const list = Object.values(map).sort((a, b) => new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at))
    setConversations(list)
    setConversationsLoading(false)
  }

  useEffect(() => {
    if (!currentUser?.id) return
    loadConversations(currentUser.id)

    const channel = supabase.channel('conversations-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const m = payload.new
        const me = currentUser.id
        if (m.sender_id !== me && m.receiver_id !== me) return
        const otherId = m.sender_id === me ? m.receiver_id : m.sender_id
        setConversations(prev => {
          const existing = prev.find(c => c.otherId === otherId)
          const isCurrentlyOpen = otherId === userIdRef.current
          const unreadCount = m.receiver_id === me && !isCurrentlyOpen ? (existing?.unreadCount || 0) + 1 : (existing?.unreadCount || 0)
          const updated = { otherId, lastMessage: m, unreadCount, profile: existing?.profile }
          const rest = prev.filter(c => c.otherId !== otherId)
          if (!updated.profile) {
            supabase.from('profiles').select('*').eq('id', otherId).single().then(({ data }) => {
              if (data) setConversations(p => p.map(c => c.otherId === otherId ? { ...c, profile: data } : c))
            })
          }
          return [updated, ...rest]
        })
      })
      .subscribe()
    conversationsChannelRef.current = channel

    // Lightweight global presence to show online dots in the sidebar
    const presence = supabase.channel('global-presence', { config: { presence: { key: currentUser.id } } })
    presence.on('presence', { event: 'sync' }, () => {
      const state = presence.presenceState()
      setOnlineIds(Object.keys(state).reduce((acc, k) => ({ ...acc, [k]: true }), {}))
    }).subscribe(async (status) => { if (status === 'SUBSCRIBED') await presence.track({ online_at: new Date().toISOString() }) })

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(presence)
    }
  }, [currentUser?.id])

  // Reset unread count locally the moment a conversation is opened
  useEffect(() => {
    if (!userId) return
    setConversations(prev => prev.map(c => c.otherId === userId ? { ...c, unreadCount: 0 } : c))
  }, [userId])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {})
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setOtherUser(profile)
      const { data: msgs } = await supabase.from('messages').select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])

      if (msgs && msgs.length > 0) {
        const msgIds = msgs.map(m => m.id)
        const { data: rxns } = await supabase.from('message_reactions').select('*').in('message_id', msgIds)
        if (rxns) {
          const grouped = {}
          rxns.forEach(r => {
            if (!grouped[r.message_id]) grouped[r.message_id] = []
            grouped[r.message_id].push(r)
          })
          setReactions(grouped)
        }
      }

      supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('receiver_id', user.id).eq('sender_id', userId).is('read_at', null).then(() => {})

      const presenceChannel = supabase.channel(`presence-${[user.id, userId].sort().join('-')}`, { config: { presence: { key: user.id } } })
      presenceChannel
        .on('presence', { event: 'sync' }, () => { const state = presenceChannel.presenceState(); setIsOtherOnline(!!state[userId]) })
        .on('presence', { event: 'join' }, ({ key }) => { if (key === userId) setIsOtherOnline(true) })
        .on('presence', { event: 'leave' }, ({ key }) => {
          if (key === userId) {
            setIsOtherOnline(false)
            setIsOtherTyping(false)
            supabase.from('profiles').select('last_seen').eq('id', userId).single().then(({ data }) => {
              if (data) setOtherUser(prev => ({ ...prev, last_seen: data.last_seen }))
            })
          }
        })
        .subscribe(async (status) => { if (status === 'SUBSCRIBED') await presenceChannel.track({ online_at: new Date().toISOString() }) })
      presenceChannelRef.current = presenceChannel

      const broadcastChannel = supabase.channel(`typing-${[user.id, userId].sort().join('-')}`)
      broadcastChannel.on('broadcast', { event: 'typing' }, ({ payload }) => { if (payload.userId === userId) setIsOtherTyping(payload.typing) }).subscribe()
      broadcastChannelRef.current = broadcastChannel
    }
    load()

    const interval = setInterval(() => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {})
      })
    }, 120000)

    return () => {
      clearInterval(interval)
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current)
      if (broadcastChannelRef.current) supabase.removeChannel(broadcastChannelRef.current)
    }
  }, [userId])

  useEffect(() => {
    if (!currentUser) return
    const channel = supabase.channel('messages-and-reactions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        if ((msg.sender_id === currentUser?.id && msg.receiver_id === userId) || (msg.sender_id === userId && msg.receiver_id === currentUser?.id)) {
          setMessages(prev => { const exists = prev.some(m => m.id === msg.id); if (exists) return prev; return [...prev, msg] })
          if (msg.sender_id === userId) supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id).then(() => {})
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, payload => {
        const r = payload.new
        setReactions(prev => { const existing = prev[r.message_id] || []; if (existing.some(e => e.id === r.id)) return prev; return { ...prev, [r.message_id]: [...existing, r] } })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, payload => {
        const r = payload.old
        setReactions(prev => ({ ...prev, [r.message_id]: (prev[r.message_id] || []).filter(e => e.id !== r.id) }))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [currentUser, userId])

  useEffect(() => {
    if (!searchOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOtherTyping, searchOpen])

  useEffect(() => {
    const handler = () => setEmojiPickerMsg(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [searchOpen])

  // Close the lightbox with Escape
  useEffect(() => {
    if (!lightboxImage) return
    const handler = (e) => { if (e.key === 'Escape') setLightboxImage(null) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [lightboxImage])

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchQuery('')
      setSearchResults([])
      setHighlightedMsgId(null)
    }
    setSearchOpen(prev => !prev)
  }

  const handleSearch = (q) => {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    const results = messages.filter(m =>
      !m.content?.startsWith('[image]') &&
      m.content?.toLowerCase().includes(q.toLowerCase())
    )
    setSearchResults(results)
  }

  const jumpToMessage = (msgId) => {
    setHighlightedMsgId(msgId)
    const el = msgRefs.current[msgId]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => setHighlightedMsgId(null), 2000)
  }

  const mentionCandidates = [otherUser?.username || otherUser?.email?.split('@')[0]].filter(Boolean)

  const handleTyping = (e) => {
    const val = e.target.value
    setNewMessage(val)
    const cursorPos = e.target.selectionStart
    const textBeforeCursor = val.slice(0, cursorPos)
    const match = textBeforeCursor.match(/@(\w*)$/)
    if (match) {
      setMentionQuery(match[1])
      setShowMentions(true)
    } else {
      setShowMentions(false)
    }
    if (!broadcastChannelRef.current || !currentUser) return
    broadcastChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { typing: true, userId: currentUser.id } })
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      broadcastChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { typing: false, userId: currentUser.id } })
    }, 1500)
  }

  const insertMention = (username) => {
    setNewMessage(prev => prev.replace(/@(\w*)$/, `@${username} `))
    setShowMentions(false)
    inputRef.current?.focus()
  }

  const filteredMentions = mentionCandidates.filter(u => u.toLowerCase().includes(mentionQuery.toLowerCase()))

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    const content = newMessage.trim()
    setNewMessage('')
    setReplyTo(null)
    setShowMentions(false)
    clearTimeout(typingTimeoutRef.current)
    broadcastChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { typing: false, userId: currentUser.id } })
    const tempMsg = { id: makeTempId(), sender_id: currentUser.id, receiver_id: userId, content, created_at: new Date(), read_at: null, reply_to: replyTo?.id || null, reply_content: replyTo?.content || null }
    setMessages(prev => [...prev, tempMsg])
    supabase.from('messages').insert({ sender_id: currentUser.id, receiver_id: userId, content, reply_to: replyTo?.id || null, reply_content: replyTo?.content || null }).select().single().then(({ data }) => {
      if (data) setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m))
    })
  }

  const deleteMessage = async (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId))
    await supabase.from('messages').delete().eq('id', msgId)
  }

  const startEdit = (msg) => {
    setEditingMsgId(msg.id)
    setEditContent(msg.content)
    setEmojiPickerMsg(null)
  }

  const cancelEdit = () => {
    setEditingMsgId(null)
    setEditContent('')
  }

  const saveEdit = async (msgId) => {
    const trimmed = editContent.trim()
    if (!trimmed) return
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: trimmed, edited_at: new Date().toISOString() } : m))
    setEditingMsgId(null)
    setEditContent('')
    await supabase.from('messages').update({ content: trimmed, edited_at: new Date().toISOString() }).eq('id', msgId)
  }

  const toggleReaction = async (msgId, emoji) => {
    if (!currentUser) return
    const existing = (reactions[msgId] || []).find(r => r.user_id === currentUser.id && r.emoji === emoji)
    if (existing) {
      setReactions(prev => ({ ...prev, [msgId]: (prev[msgId] || []).filter(r => r.id !== existing.id) }))
      await supabase.from('message_reactions').delete().eq('id', existing.id)
    } else {
      const tempId = makeTempId()
      setReactions(prev => ({ ...prev, [msgId]: [...(prev[msgId] || []), { id: tempId, message_id: msgId, user_id: currentUser.id, emoji }] }))
      const { data } = await supabase.from('message_reactions').insert({ message_id: msgId, user_id: currentUser.id, emoji }).select().single()
      if (data) setReactions(prev => ({ ...prev, [msgId]: (prev[msgId] || []).map(r => r.id === tempId ? data : r) }))
    }
    setEmojiPickerMsg(null)
  }

  const getGroupedReactions = (msgId) => {
    const rxns = reactions[msgId] || []
    const grouped = {}
    rxns.forEach(r => { if (!grouped[r.emoji]) grouped[r.emoji] = []; grouped[r.emoji].push(r.user_id) })
    return grouped
  }

  const sendImage = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return alert('Please select an image file')
    if (file.size > 5 * 1024 * 1024) return alert('Image must be under 5MB')
    setUploading(true)
    const fileName = `${currentUser.id}-${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('chat-images').upload(fileName, file)
    if (uploadError) { alert('Failed to upload image: ' + uploadError.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)
    const tempMsg = { id: makeTempId(), sender_id: currentUser.id, receiver_id: userId, content: `[image]${publicUrl}`, created_at: new Date(), read_at: null }
    setMessages(prev => [...prev, tempMsg])
    supabase.from('messages').insert({ sender_id: currentUser.id, receiver_id: userId, content: `[image]${publicUrl}` }).select().single().then(({ data }) => {
      if (data) setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m))
    })
    setUploading(false)
    fileInputRef.current.value = ''
  }

  const renderTextWithMentionsAndSearch = (text) => {
    const usernames = [otherUser?.username || otherUser?.email?.split('@')[0], currentUser?.user_metadata?.username || currentUser?.email?.split('@')[0]].filter(Boolean)
    let segments = [text]
    if (usernames.length) {
      const escaped = usernames.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      const mentionRegex = new RegExp(`(@(?:${escaped.join('|')}))(?!\\w)`, 'g')
      segments = text.split(mentionRegex)
    }
    return segments.map((seg, i) => {
      const isMention = usernames.some(u => seg === `@${u}`)
      if (isMention) {
        return <span key={i} style={{ color: '#a78bfa', fontWeight: 600 }}>{seg}</span>
      }
      if (searchQuery && seg.toLowerCase().includes(searchQuery.toLowerCase())) {
        const parts = seg.split(new RegExp(`(${searchQuery})`, 'gi'))
        return <span key={i}>{parts.map((part, j) => part.toLowerCase() === searchQuery.toLowerCase() ? <mark key={j} style={{ background: '#f59e0b', color: '#000', borderRadius: '3px', padding: '0 2px' }}>{part}</mark> : part)}</span>
      }
      return seg
    })
  }

  const renderMessage = (msg) => {
    if (msg.content?.startsWith('[image]')) {
      const url = msg.content.replace('[image]', '')
      return <img src={url} alt="sent image" style={{ maxWidth: '260px', maxHeight: '260px', borderRadius: '14px', display: 'block', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.25)' }} onClick={() => setLightboxImage(url)} />
    }
    return <span>{renderTextWithMentionsAndSearch(msg.content)}</span>
  }

  const truncate = (text, n = 40) => text?.startsWith('[image]') ? '📷 Image' : text?.length > n ? text.substring(0, n) + '...' : text

  const name = otherUser?.username || otherUser?.email?.split('@')[0] || 'Player'
  const color = avatarColorFor(name)

  const getStatus = () => {
    if (isOtherTyping) return { text: 'typing...', color: '#a78bfa' }
    if (isOtherOnline) return { text: 'Online', color: '#4caf50' }
    return { text: formatLastSeen(otherUser?.last_seen), color: mutedColor }
  }
  const status = getStatus()

  const filteredConversations = conversations.filter(c => {
    if (!convSearch.trim()) return true
    const cName = c.profile?.username || c.profile?.email?.split('@')[0] || ''
    return cName.toLowerCase().includes(convSearch.toLowerCase())
  })

  // Shared media for the info panel — newest first
  const sharedMedia = useMemo(
    () => messages.filter(m => m.content?.startsWith('[image]')).slice().reverse(),
    [messages]
  )

  // Precompute grouping metadata once per render pass instead of per-message
  // lookups, so consecutive same-sender bursts within the time window
  // collapse visually (tighter spacing, avatar/timestamp only once).
  const messageMeta = useMemo(() => {
    return messages.map((msg, idx) => {
      const prevMsg = messages[idx - 1]
      const nextMsg = messages[idx + 1]
      const msgDate = new Date(msg.created_at)
      const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
      const showDateDivider = !prevMsg || !sameDay(prevMsg.created_at, msg.created_at)
      const isSameSenderAsPrev = !showDateDivider && prevMsg && prevMsg.sender_id === msg.sender_id &&
        (msgDate - new Date(prevMsg.created_at)) < GROUP_WINDOW_MS
      const isSameSenderAsNext = nextMsg && nextMsg.sender_id === msg.sender_id &&
        sameDay(msg.created_at, nextMsg.created_at) && (new Date(nextMsg.created_at) - msgDate) < GROUP_WINDOW_MS
      return {
        showDateDivider,
        isGroupStart: !isSameSenderAsPrev,
        isGroupEnd: !isSameSenderAsNext
      }
    })
  }, [messages])

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', width: '100%', background: bg, backgroundImage: isLight
      ? 'radial-gradient(circle at 85% 0%, rgba(108,99,255,0.07), transparent 45%), radial-gradient(circle at 0% 100%, rgba(167,139,250,0.06), transparent 40%)'
      : 'radial-gradient(circle at 85% 0%, rgba(108,99,255,0.10), transparent 45%), radial-gradient(circle at 0% 100%, rgba(167,139,250,0.07), transparent 40%)',
      position: 'relative' }}>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div className="mobile-only" onClick={() => setMobileSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }} />
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div onClick={() => setLightboxImage(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', cursor: 'zoom-out', animation: 'fadeIn 0.15s ease' }}>
          <img src={lightboxImage} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }} />
          <button onClick={() => setLightboxImage(null)} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}

      {/* Conversation sidebar */}
      <div className={`chat-sidebar ${mobileSidebarOpen ? 'mobile-open' : ''}`} style={{ width: '280px', flexShrink: 0, borderRight: `1px solid ${border}`, background: sidebarBg, display: 'flex', flexDirection: 'column', padding: '1.5rem 0.85rem 1rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: textColor, margin: '0 0.5rem 0.85rem', letterSpacing: '-0.01em' }}>Messages</h2>
        <input
          type="text"
          placeholder="Search people..."
          value={convSearch}
          onChange={e => setConvSearch(e.target.value)}
          style={{ margin: '0 0.5rem 0.85rem', padding: '0.55rem 0.85rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', outline: 'none' }}
        />
        <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          {conversationsLoading ? (
            [1, 2, 3].map(i => <div key={i} style={{ height: '58px', margin: '0 0.25rem', borderRadius: '12px', background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />)
          ) : filteredConversations.length === 0 ? (
            <p style={{ color: mutedColor, fontSize: '0.85rem', padding: '0 0.75rem' }}>No conversations yet. Connect with someone to start chatting!</p>
          ) : (
            filteredConversations.map(c => {
              const cName = c.profile?.username || c.profile?.email?.split('@')[0] || 'Player'
              const cColor = avatarColorFor(cName)
              const isActive = c.otherId === userId
              const isMineLast = c.lastMessage.sender_id === currentUser?.id
              const isOnline = !!onlineIds[c.otherId]
              return (
                <button
                  key={c.otherId}
                  onClick={() => openConversation(c.otherId)}
                  className="conv-item"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.6rem 0.65rem', borderRadius: '12px', border: 'none', background: isActive ? (isLight ? 'rgba(108,99,255,0.1)' : 'rgba(108,99,255,0.16)') : 'transparent', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'Inter, sans-serif' }}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    {c.profile?.avatar_url ? (
                      <img src={c.profile.avatar_url} alt={cName} style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: `linear-gradient(135deg, ${cColor}, ${cColor}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', fontSize: '1rem' }}>{cName[0]?.toUpperCase()}</div>
                    )}
                    {isOnline && <span style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '11px', height: '11px', borderRadius: '50%', background: '#4caf50', border: `2px solid ${isLight ? '#fdfdff' : '#15152a'}` }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.4rem' }}>
                      <p style={{ margin: 0, fontWeight: isActive ? '700' : '600', color: textColor, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cName}</p>
                      <span style={{ fontSize: '0.7rem', color: mutedColor, flexShrink: 0 }}>{formatConvTime(c.lastMessage.created_at)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.4rem' }}>
                      <p style={{ margin: '0.1rem 0 0', color: c.unreadCount > 0 ? textColor : mutedColor, fontWeight: c.unreadCount > 0 ? '600' : '400', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isMineLast ? 'You: ' : ''}{truncate(c.lastMessage.content, 28)}
                      </p>
                      {c.unreadCount > 0 && (
                        <span style={{ background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', fontSize: '0.68rem', fontWeight: '700', borderRadius: '100px', minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                          {c.unreadCount > 9 ? '9+' : c.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Chat panel — centered at a comfortable reading width so bubbles
          don't stretch across the whole viewport on wide screens */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '1.5rem', alignItems: 'center' }}>
        <div style={{ width: '100%', maxWidth: '760px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem', padding: '0.9rem 1.4rem', background: headerBg, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderRadius: '16px', border: `1px solid ${border}`, boxShadow: panelShadow }}>
            <button onClick={() => setMobileSidebarOpen(true)} className="mobile-only icon-btn" style={{ background: 'transparent', border: `1px solid ${border}`, color: textColor, borderRadius: '10px', padding: '0.5rem 0.65rem', cursor: 'pointer', fontSize: '0.95rem', display: 'none' }}>☰</button>
            <div
              style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
              onClick={() => setInfoPanelOpen(o => !o)}
              title="View info"
            >
              {otherUser?.avatar_url ? (
                <img src={otherUser.avatar_url} alt={name} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: `linear-gradient(135deg, ${color}, ${color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', fontSize: '1.05rem' }}>{name[0]?.toUpperCase()}</div>
              )}
              {isOtherOnline && (
                <span style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '13px', height: '13px', borderRadius: '50%', background: '#4caf50', border: `2.5px solid ${isLight ? '#fdfdff' : '#15152a'}`, boxShadow: '0 0 0 1px rgba(76,175,80,0.3)' }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setInfoPanelOpen(o => !o)}>
              <p style={{ fontWeight: '700', margin: 0, color: textColor, fontSize: '1.02rem', letterSpacing: '-0.01em' }}>{name}</p>
              <p style={{ fontSize: '0.8rem', color: status.color, margin: '0.1rem 0 0', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {isOtherTyping ? (
                  <span style={{ display: 'inline-flex', gap: '2px' }}>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#a78bfa', animation: 'bounce 1s infinite' }} />
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#a78bfa', animation: 'bounce 1s infinite 0.2s' }} />
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#a78bfa', animation: 'bounce 1s infinite 0.4s' }} />
                  </span>
                ) : isOtherOnline ? (
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4caf50', flexShrink: 0 }} />
                ) : null}
                {status.text}
              </p>
            </div>
            <button
              onClick={toggleSearch}
              className="icon-btn"
              style={{ background: searchOpen ? 'rgba(108,99,255,0.18)' : 'transparent', border: searchOpen ? '1px solid rgba(108,99,255,0.4)' : `1px solid ${border}`, color: searchOpen ? '#a78bfa' : mutedColor, borderRadius: '10px', padding: '0.55rem 0.75rem', cursor: 'pointer', fontSize: '0.95rem', fontFamily: 'Inter, sans-serif' }}
              title="Search messages"
            >
              🔍
            </button>
            <button
              onClick={() => setInfoPanelOpen(o => !o)}
              className="icon-btn info-toggle-btn"
              style={{ background: infoPanelOpen ? 'rgba(108,99,255,0.18)' : 'transparent', border: infoPanelOpen ? '1px solid rgba(108,99,255,0.4)' : `1px solid ${border}`, color: infoPanelOpen ? '#a78bfa' : mutedColor, borderRadius: '10px', padding: '0.55rem 0.75rem', cursor: 'pointer', fontSize: '0.95rem', fontFamily: 'Inter, sans-serif' }}
              title="Conversation info"
            >
              ℹ️
            </button>
          </div>

          {/* Search panel */}
          {searchOpen && (
            <div style={{ marginBottom: '1rem', background: headerBg, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: `1px solid ${border}`, borderRadius: '16px', padding: '0.85rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: panelShadow, animation: 'slideDown 0.2s ease' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  style={{ flex: 1, padding: '0.65rem 1rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }}
                />
                {searchQuery && (
                  <button onClick={() => handleSearch('')} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '1rem' }}>✕</button>
                )}
              </div>
              {searchQuery && (
                <div>
                  <p style={{ color: mutedColor, fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </p>
                  {searchResults.length === 0 ? (
                    <p style={{ color: mutedColor, fontSize: '0.85rem' }}>No messages found for "{searchQuery}"</p>
                  ) : (
                    <div className="thin-scroll" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                      {searchResults.map(msg => {
                        const isMine = msg.sender_id === currentUser?.id
                        return (
                          <button key={msg.id} onClick={() => jumpToMessage(msg.id)} className="search-result-btn" style={{ background: inputBg, border: `1px solid ${border}`, borderRadius: '10px', padding: '0.5rem 0.75rem', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.2rem', fontFamily: 'Inter, sans-serif' }}>
                            <span style={{ fontSize: '0.7rem', color: mutedColor }}>{isMine ? 'You' : name} · {new Date(msg.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            <span style={{ fontSize: '0.85rem', color: textColor }}>
                              {msg.content.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                                part.toLowerCase() === searchQuery.toLowerCase()
                                  ? <mark key={i} style={{ background: '#f59e0b', color: '#000', borderRadius: '3px', padding: '0 2px' }}>{part}</mark>
                                  : part
                              )}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', marginBottom: '1rem', padding: '0.5rem 0.25rem' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: mutedColor, margin: 'auto 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(108,99,255,0.15), rgba(167,139,250,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', marginBottom: '0.25rem' }}>👋</div>
                <p style={{ color: textColor, fontWeight: '600', margin: 0 }}>Say hi to {name}!</p>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>This is the start of your conversation.</p>
              </div>
            )}
            {messages.map((msg, idx) => {
              const isMine = msg.sender_id === currentUser?.id
              const isTemp = msg.id?.toString().startsWith('temp-')
              const isHovered = hoveredMsg === msg.id
              const groupedRxns = getGroupedReactions(msg.id)
              const hasReactions = Object.keys(groupedRxns).length > 0
              const isRead = isMine && msg.read_at && !isTemp
              const isHighlighted = highlightedMsgId === msg.id
              const isEditing = editingMsgId === msg.id
              const isImage = msg.content?.startsWith('[image]')
              const { showDateDivider, isGroupStart, isGroupEnd } = messageMeta[idx]
              return (
                <div key={msg.id}>
                  {showDateDivider && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.75rem 0' }}>
                      <div style={{ flex: 1, height: '1px', background: border }} />
                      <span style={{ fontSize: '0.72rem', color: mutedColor, fontWeight: '600', whiteSpace: 'nowrap' }}>{formatDateDivider(msg.created_at)}</span>
                      <div style={{ flex: 1, height: '1px', background: border }} />
                    </div>
                  )}
                  <div
                    ref={el => { if (el) msgRefs.current[msg.id] = el }}
                    style={{
                      alignSelf: isMine ? 'flex-end' : 'flex-start',
                      display: 'flex',
                      flexDirection: isMine ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      gap: '0.5rem',
                      maxWidth: '80%',
                      marginLeft: isMine ? 'auto' : 0,
                      marginTop: isGroupStart ? '0.7rem' : '0.15rem',
                      position: 'relative',
                      transition: 'background 0.3s',
                      background: isHighlighted ? 'rgba(245,158,11,0.1)' : 'transparent',
                      borderRadius: '12px',
                      padding: isHighlighted ? '0.25rem' : '0',
                      animation: isTemp ? 'none' : 'fadeInUp 0.25s ease'
                    }}
                    onMouseEnter={() => setHoveredMsg(msg.id)} onMouseLeave={() => setHoveredMsg(null)}
                  >
                    {/* Per-group avatar for the other person — reserves the
                        same width even when hidden so grouped messages stay
                        aligned under the lead message */}
                    {!isMine && (
                      <div style={{ width: '26px', height: '26px', flexShrink: 0 }}>
                        {isGroupEnd && (
                          otherUser?.avatar_url ? (
                            <img src={otherUser.avatar_url} alt={name} style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: `linear-gradient(135deg, ${color}, ${color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', fontSize: '0.7rem' }}>{name[0]?.toUpperCase()}</div>
                          )
                        )}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {msg.reply_content && (
                            <div style={{ background: isLight ? 'rgba(108,99,255,0.06)' : 'rgba(255,255,255,0.06)', borderLeft: '3px solid #6c63ff', borderRadius: '6px', padding: '0.3rem 0.6rem', marginBottom: '0.3rem', fontSize: '0.75rem', color: mutedColor, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              ↩ {truncate(msg.reply_content)}
                            </div>
                          )}
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                value={editContent}
                                onChange={e => setEditContent(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') saveEdit(msg.id); if (e.key === 'Escape') cancelEdit() }}
                                autoFocus
                                style={{ padding: '0.5rem 0.8rem', borderRadius: '14px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none', minWidth: '180px' }}
                              />
                              <button onClick={() => saveEdit(msg.id)} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: '8px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>✓</button>
                              <button onClick={cancelEdit} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '8px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                            </div>
                          ) : (
                            <div style={{
                              background: isImage ? 'transparent' : isMine ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : bubbleOther,
                              color: isMine ? 'white' : textColor,
                              padding: isImage ? '0' : '0.65rem 1.05rem',
                              borderRadius: isImage ? '14px' : isMine
                                ? `18px 18px ${isGroupEnd ? '4px' : '18px'} 18px`
                                : `18px 18px 18px ${isGroupEnd ? '4px' : '18px'}`,
                              fontSize: '0.95rem',
                              lineHeight: 1.45,
                              opacity: isTemp ? 0.65 : 1,
                              outline: isHighlighted ? '2px solid #f59e0b' : 'none',
                              boxShadow: isImage ? 'none' : isMine ? '0 2px 10px rgba(108,99,255,0.25)' : isLight ? '0 1px 4px rgba(17,17,17,0.06)' : '0 1px 4px rgba(0,0,0,0.2)',
                              border: !isImage && !isMine ? `1px solid ${border}` : 'none'
                            }}>
                              {renderMessage(msg)}
                            </div>
                          )}
                          {msg.edited_at && !isTemp && !isEditing && (
                            <span style={{ fontSize: '0.65rem', color: mutedColor, marginTop: '0.15rem', alignSelf: isMine ? 'flex-end' : 'flex-start' }}>(edited)</span>
                          )}
                        </div>
                        {isHovered && !isEditing && !isTemp && (
                          <span style={{ fontSize: '0.7rem', color: mutedColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {formatShortTime(msg.created_at)}
                          </span>
                        )}
                        {!isTemp && isHovered && !isEditing && (
                          <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(30,30,46,0.9)', border: `1px solid ${border}`, borderRadius: '10px', padding: '0.2rem', boxShadow: panelShadow, animation: 'fadeIn 0.15s ease' }}>
                            <button onClick={() => { setReplyTo(msg); inputRef.current?.focus() }} className="msg-action-btn" style={{ background: 'transparent', border: 'none', color: textColor, borderRadius: '6px', padding: '0.3rem 0.45rem', cursor: 'pointer', fontSize: '0.85rem' }}>↩</button>
                            <div style={{ position: 'relative' }}>
                              <button onClick={(e) => { e.stopPropagation(); setEmojiPickerMsg(emojiPickerMsg === msg.id ? null : msg.id) }} className="msg-action-btn" style={{ background: 'transparent', border: 'none', color: textColor, borderRadius: '6px', padding: '0.3rem 0.45rem', cursor: 'pointer', fontSize: '0.85rem' }}>😊</button>
                              {emojiPickerMsg === msg.id && (
                                <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: '110%', [isMine ? 'right' : 'left']: 0, background: isLight ? '#ffffff' : '#1e1e2e', border: `1px solid ${border}`, borderRadius: '14px', padding: '0.5rem', display: 'flex', gap: '0.25rem', zIndex: 50, boxShadow: '0 8px 30px rgba(0,0,0,0.35)', animation: 'fadeIn 0.15s ease' }}>
                                  {EMOJI_OPTIONS.map(emoji => (
                                    <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="emoji-option-btn" style={{ background: (reactions[msg.id] || []).some(r => r.emoji === emoji && r.user_id === currentUser?.id) ? 'rgba(108,99,255,0.3)' : 'transparent', border: 'none', borderRadius: '8px', padding: '0.3rem', cursor: 'pointer', fontSize: '1.2rem' }}>{emoji}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                            {isMine && !isImage && <button onClick={() => startEdit(msg)} title="Edit" className="msg-action-btn" style={{ background: 'transparent', border: 'none', color: textColor, borderRadius: '6px', padding: '0.3rem 0.45rem', cursor: 'pointer', fontSize: '0.85rem' }}>✏️</button>}
                            {isMine && <button onClick={() => deleteMessage(msg.id)} className="msg-action-btn" style={{ background: 'transparent', border: 'none', color: '#ef4444', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>🗑️</button>}
                          </div>
                        )}
                      </div>
                      {isMine && !isTemp && isGroupEnd && (
                        <p style={{ fontSize: '0.65rem', color: isRead ? '#a78bfa' : mutedColor, marginTop: '0.25rem', textAlign: 'right', fontWeight: isRead ? '600' : '400' }}>
                          {isRead ? '✓✓ Read' : '✓ Sent'}
                        </p>
                      )}
                      {hasReactions && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.35rem' }}>
                          {Object.entries(groupedRxns).map(([emoji, uids]) => (
                            <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} style={{ background: uids.includes(currentUser?.id) ? 'rgba(108,99,255,0.22)' : isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)', border: uids.includes(currentUser?.id) ? '1px solid rgba(108,99,255,0.4)' : `1px solid ${border}`, borderRadius: '100px', padding: '0.15rem 0.55rem', cursor: 'pointer', fontSize: '0.8rem', color: textColor, display: 'flex', alignItems: 'center', gap: '0.25rem', boxShadow: isLight ? '0 1px 3px rgba(17,17,17,0.05)' : 'none' }}>
                              {emoji} <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{uids.length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {isOtherTyping && (
              <div style={{ alignSelf: 'flex-start', background: bubbleOther, border: `1px solid ${border}`, padding: '0.7rem 1.05rem', borderRadius: '18px 18px 18px 4px', display: 'flex', gap: '4px', alignItems: 'center', boxShadow: isLight ? '0 1px 4px rgba(17,17,17,0.06)' : '0 1px 4px rgba(0,0,0,0.2)', animation: 'fadeInUp 0.2s ease', marginTop: '0.7rem' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa', animation: 'bounce 1s infinite' }} />
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa', animation: 'bounce 1s infinite 0.2s' }} />
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa', animation: 'bounce 1s infinite 0.4s' }} />
            </div>
            )}
            <div ref={bottomRef} />
          </div>

          {replyTo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1.1rem', background: isLight ? 'rgba(108,99,255,0.07)' : 'rgba(108,99,255,0.1)', borderRadius: '12px', marginBottom: '0.6rem', border: '1px solid rgba(108,99,255,0.25)', animation: 'slideDown 0.2s ease' }}>
              <span style={{ color: '#a78bfa', fontSize: '0.85rem' }}>↩ Replying to: {truncate(replyTo.content)}</span>
              <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', marginLeft: 'auto', fontSize: '1rem' }}>✕</button>
            </div>
          )}

          <div className={`chat-input-bar ${inputFocused ? 'focused' : ''}`} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', position: 'relative', background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: '16px', padding: '0.5rem', boxShadow: panelShadow }}>
            {showMentions && filteredMentions.length > 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '0.5rem', background: isLight ? '#ffffff' : '#1e1e2e', border: `1px solid ${border}`, borderRadius: '12px', padding: '0.4rem', boxShadow: '0 8px 30px rgba(0,0,0,0.35)', zIndex: 60, minWidth: '160px', animation: 'fadeIn 0.15s ease' }}>
                {filteredMentions.map(u => (
                  <button key={u} onClick={() => insertMention(u)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: textColor, padding: '0.4rem 0.75rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', borderRadius: '8px' }}>@{u}</button>
                ))}
              </div>
            )}
            <input type="file" accept="image/*" ref={fileInputRef} onChange={sendImage} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current.click()} disabled={uploading} className="attach-btn" style={{ width: '42px', height: '42px', flexShrink: 0, background: isLight ? 'rgba(108,99,255,0.08)' : 'rgba(108,99,255,0.12)', color: uploading ? mutedColor : '#a78bfa', border: 'none', borderRadius: '12px', cursor: uploading ? 'default' : 'pointer', fontSize: '1.15rem', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {uploading ? '⏳' : '📷'}
            </button>
            <input
              ref={inputRef}
              type="text"
              placeholder={replyTo ? `Replying to ${truncate(replyTo.content, 20)}...` : 'Type a message...'}
              value={newMessage}
              onChange={handleTyping}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              style={{ flex: 1, padding: '0.75rem 0.4rem', border: 'none', background: 'transparent', color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none' }}
            />
            <button onClick={sendMessage} disabled={!newMessage.trim()} className="send-btn" style={{ padding: '0.7rem 1.4rem', background: newMessage.trim() ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)', color: newMessage.trim() ? 'white' : mutedColor, border: 'none', borderRadius: '12px', cursor: newMessage.trim() ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.9rem', transition: 'background 0.15s, transform 0.1s' }}>Send</button>
          </div>
        </div>
      </div>

      {/* Info panel — fills the space that used to just be empty background,
          gives quick access to the person's profile and shared photos */}
      <div className={`info-panel ${infoPanelOpen ? 'open' : ''}`} style={{ width: infoPanelOpen ? '300px' : '0px', flexShrink: 0, borderLeft: infoPanelOpen ? `1px solid ${border}` : 'none', background: panelBg, overflow: 'hidden', transition: 'width 0.2s ease' }}>
        <div style={{ width: '300px', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', overflowY: 'auto' }} className="thin-scroll">
          <div style={{ position: 'relative', marginBottom: '0.9rem' }}>
            {otherUser?.avatar_url ? (
              <img src={otherUser.avatar_url} alt={name} style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', display: 'block', boxShadow: '0 6px 20px rgba(108,99,255,0.25)' }} />
            ) : (
              <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: `linear-gradient(135deg, ${color}, ${color}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white', fontSize: '2rem', boxShadow: '0 6px 20px rgba(108,99,255,0.25)' }}>{name[0]?.toUpperCase()}</div>
            )}
            {isOtherOnline && (
              <span style={{ position: 'absolute', bottom: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#4caf50', border: `3px solid ${isLight ? '#f7f7fb' : '#111124'}` }} />
            )}
          </div>
          <p style={{ fontWeight: '700', fontSize: '1.15rem', color: textColor, margin: 0, textAlign: 'center' }}>{name}</p>
          <p style={{ fontSize: '0.82rem', color: status.color, margin: '0.25rem 0 0', textAlign: 'center' }}>{status.text}</p>

          <button
            onClick={() => navigate(`/user/${userId}`)}
            style={{ marginTop: '1.1rem', padding: '0.55rem 1.2rem', background: isLight ? 'rgba(108,99,255,0.08)' : 'rgba(108,99,255,0.15)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.3)', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem', width: '100%' }}
          >
            View full profile
          </button>

          <div style={{ width: '100%', height: '1px', background: border, margin: '1.4rem 0' }} />

          <div style={{ width: '100%' }}>
            <p style={{ fontSize: '0.78rem', fontWeight: '700', color: mutedColor, textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 0.75rem' }}>
              Shared photos {sharedMedia.length > 0 && `· ${sharedMedia.length}`}
            </p>
            {sharedMedia.length === 0 ? (
              <p style={{ fontSize: '0.82rem', color: mutedColor, lineHeight: 1.5 }}>Photos you send each other will show up here.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                {sharedMedia.slice(0, 12).map(m => {
                  const url = m.content.replace('[image]', '')
                  return (
                    <div
                      key={m.id}
                      onClick={() => setLightboxImage(url)}
                      style={{ aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', border: `1px solid ${border}` }}
                    >
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .thin-scroll::-webkit-scrollbar { width: 6px; }
        .thin-scroll::-webkit-scrollbar-track { background: transparent; }
        .thin-scroll::-webkit-scrollbar-thumb { background: ${isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'}; border-radius: 10px; }
        .chat-input-bar.focused { box-shadow: 0 0 0 2px rgba(108,99,255,0.35), ${panelShadow}; border-color: rgba(108,99,255,0.4); }
        .icon-btn:hover { background: rgba(108,99,255,0.12) !important; color: #a78bfa !important; }
        .attach-btn:hover:not(:disabled) { background: rgba(108,99,255,0.18) !important; }
        .send-btn:not(:disabled):hover { transform: translateY(-1px); }
        .msg-action-btn:hover { background: rgba(108,99,255,0.15) !important; }
        .emoji-option-btn:hover { background: rgba(108,99,255,0.18) !important; transform: scale(1.1); }
        .search-result-btn:hover { border-color: rgba(108,99,255,0.35) !important; }
        .conv-item:hover { background: ${isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'} !important; }
        .mobile-only { display: none; }
        @media (max-width: 1080px) {
          .info-panel { display: none; }
          .info-toggle-btn { display: none; }
        }
        @media (max-width: 780px) {
          .mobile-only { display: flex !important; }
          .chat-sidebar {
            position: fixed;
            top: 64px;
            bottom: 0;
            left: 0;
            z-index: 50;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            box-shadow: 4px 0 24px rgba(0,0,0,0.3);
          }
          .chat-sidebar.mobile-open {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}
