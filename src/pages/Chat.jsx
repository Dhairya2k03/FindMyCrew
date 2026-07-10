import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
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

const makeTempId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `temp-${Math.random().toString(36).slice(2)}`)

const EMOJI_OPTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

export default function Chat({ theme }) {
  const { userId } = useParams()
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
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)
  const searchInputRef = useRef(null)
  const presenceChannelRef = useRef(null)
  const broadcastChannelRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const userIdRef = useRef(userId)
  const msgRefs = useRef({})

  const isLight = theme === 'light'
  const bg          = isLight ? '#f0f0f7'                : '#0f0f1a'
  const border      = isLight ? 'rgba(0,0,0,0.08)'       : 'rgba(255,255,255,0.08)'
  const textColor   = isLight ? '#111'                   : 'white'
  const mutedColor  = isLight ? '#555'                   : '#888'
  const inputBg     = isLight ? 'rgba(0,0,0,0.04)'       : 'rgba(255,255,255,0.05)'
  const inputBorder = isLight ? 'rgba(0,0,0,0.1)'        : 'rgba(255,255,255,0.1)'
  const bubbleOther = isLight ? 'rgba(0,0,0,0.07)'       : 'rgba(255,255,255,0.08)'
  const headerBg    = isLight ? 'rgba(0,0,0,0.03)'       : 'rgba(255,255,255,0.03)'

  useEffect(() => { userIdRef.current = userId }, [userId])

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
      return <img src={url} alt="sent image" style={{ maxWidth: '250px', maxHeight: '250px', borderRadius: '12px', display: 'block', cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />
    }
    return <span>{renderTextWithMentionsAndSearch(msg.content)}</span>
  }

  const truncate = (text, n = 40) => text?.startsWith('[image]') ? '📷 Image' : text?.length > n ? text.substring(0, n) + '...' : text

  const name = otherUser?.username || otherUser?.email?.split('@')[0] || 'Player'
  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length]

  const getStatus = () => {
    if (isOtherTyping) return { text: '● typing...', color: '#a78bfa' }
    if (isOtherOnline) return { text: '● Online', color: '#4caf50' }
    return { text: formatLastSeen(otherUser?.last_seen), color: mutedColor }
  }
  const status = getStatus()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', maxWidth: '700px', margin: '0 auto', padding: '1.5rem', background: bg }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', padding: '1rem 1.5rem', background: headerBg, borderRadius: '12px', border: `1px solid ${border}` }}>
        {otherUser?.avatar_url ? (
          <img src={otherUser.avatar_url} alt={name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: 'white' }}>{name[0]?.toUpperCase()}</div>
        )}
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: '600', margin: 0, color: textColor }}>{name}</p>
          <p style={{ fontSize: '0.8rem', color: status.color, margin: 0 }}>{status.text}</p>
        </div>
        <button
          onClick={toggleSearch}
          style={{ background: searchOpen ? 'rgba(108,99,255,0.2)' : inputBg, border: searchOpen ? '1px solid rgba(108,99,255,0.4)' : `1px solid ${border}`, color: searchOpen ? '#a78bfa' : mutedColor, borderRadius: '8px', padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'Inter, sans-serif' }}
          title="Search messages"
        >
          🔍
        </button>
      </div>

      {/* Search panel */}
      {searchOpen && (
        <div style={{ marginBottom: '1rem', background: headerBg, border: `1px solid ${border}`, borderRadius: '12px', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              style={{ flex: 1, padding: '0.6rem 1rem', borderRadius: '8px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '200px', overflowY: 'auto' }}>
                  {searchResults.map(msg => {
                    const isMine = msg.sender_id === currentUser?.id
                    return (
                      <button key={msg.id} onClick={() => jumpToMessage(msg.id)} style={{ background: inputBg, border: `1px solid ${border}`, borderRadius: '8px', padding: '0.5rem 0.75rem', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.2rem', fontFamily: 'Inter, sans-serif' }}>
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
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', padding: '0.5rem' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: mutedColor, marginTop: '3rem' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👋</p>
            <p>Say hi to {name}!</p>
          </div>
        )}
        {messages.map(msg => {
          const isMine = msg.sender_id === currentUser?.id
          const isTemp = msg.id?.toString().startsWith('temp-')
          const isHovered = hoveredMsg === msg.id
          const groupedRxns = getGroupedReactions(msg.id)
          const hasReactions = Object.keys(groupedRxns).length > 0
          const isRead = isMine && msg.read_at && !isTemp
          const isHighlighted = highlightedMsgId === msg.id
          const isEditing = editingMsgId === msg.id
          const isImage = msg.content?.startsWith('[image]')
          return (
            <div
              key={msg.id}
              ref={el => { if (el) msgRefs.current[msg.id] = el }}
              style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '75%', position: 'relative', transition: 'all 0.3s', background: isHighlighted ? 'rgba(245,158,11,0.1)' : 'transparent', borderRadius: '12px', padding: isHighlighted ? '0.25rem' : '0' }}
              onMouseEnter={() => setHoveredMsg(msg.id)} onMouseLeave={() => setHoveredMsg(null)}
            >
              <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {msg.reply_content && (
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderLeft: '3px solid #6c63ff', borderRadius: '6px', padding: '0.3rem 0.6rem', marginBottom: '0.25rem', fontSize: '0.75rem', color: mutedColor, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                      <button onClick={() => saveEdit(msg.id)} style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>✓</button>
                      <button onClick={cancelEdit} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ background: isImage ? 'transparent' : isMine ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : bubbleOther, color: isMine ? 'white' : textColor, padding: isImage ? '0' : '0.65rem 1rem', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: '0.95rem', lineHeight: 1.4, opacity: isTemp ? 0.7 : 1, outline: isHighlighted ? '2px solid #f59e0b' : 'none' }}>
                      {renderMessage(msg)}
                    </div>
                  )}
                  {msg.edited_at && !isTemp && !isEditing && (
                    <span style={{ fontSize: '0.65rem', color: mutedColor, marginTop: '0.15rem', alignSelf: isMine ? 'flex-end' : 'flex-start' }}>(edited)</span>
                  )}
                </div>
                {isHovered && !isEditing && !isTemp && (
                  <span style={{ fontSize: '0.7rem', color: mutedColor, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {formatTimestamp(msg.created_at)}
                  </span>
                )}
                {!isTemp && isHovered && !isEditing && (
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <button onClick={() => { setReplyTo(msg); inputRef.current?.focus() }} style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid rgba(255,255,255,0.12)`, color: textColor, borderRadius: '6px', padding: '0.25rem 0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>↩</button>
                    <div style={{ position: 'relative' }}>
                      <button onClick={(e) => { e.stopPropagation(); setEmojiPickerMsg(emojiPickerMsg === msg.id ? null : msg.id) }} style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid rgba(255,255,255,0.12)`, color: textColor, borderRadius: '6px', padding: '0.25rem 0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>😊</button>
                      {emojiPickerMsg === msg.id && (
                        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: '110%', [isMine ? 'right' : 'left']: 0, background: isLight ? '#f0f0f7' : '#1e1e2e', border: `1px solid ${border}`, borderRadius: '12px', padding: '0.5rem', display: 'flex', gap: '0.25rem', zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                          {EMOJI_OPTIONS.map(emoji => (
                            <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} style={{ background: (reactions[msg.id] || []).some(r => r.emoji === emoji && r.user_id === currentUser?.id) ? 'rgba(108,99,255,0.3)' : 'transparent', border: 'none', borderRadius: '6px', padding: '0.3rem', cursor: 'pointer', fontSize: '1.2rem' }}>{emoji}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    {isMine && !isImage && <button onClick={() => startEdit(msg)} title="Edit" style={{ background: 'rgba(255,255,255,0.08)', border: `1px solid rgba(255,255,255,0.12)`, color: textColor, borderRadius: '6px', padding: '0.25rem 0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>✏️</button>}
                    {isMine && <button onClick={() => deleteMessage(msg.id)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}>🗑️</button>}
                  </div>
                )}
              </div>
              {isMine && !isTemp && (
                <p style={{ fontSize: '0.65rem', color: isRead ? '#a78bfa' : mutedColor, marginTop: '0.2rem', textAlign: 'right' }}>
                  {isRead ? '✓✓ Read' : '✓ Sent'}
                </p>
              )}
              {hasReactions && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
                  {Object.entries(groupedRxns).map(([emoji, userIds]) => (
                    <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} style={{ background: userIds.includes(currentUser?.id) ? 'rgba(108,99,255,0.25)' : isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.07)', border: userIds.includes(currentUser?.id) ? '1px solid rgba(108,99,255,0.4)' : `1px solid ${border}`, borderRadius: '100px', padding: '0.15rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: textColor, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {emoji} <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{userIds.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {isOtherTyping && (
          <div style={{ alignSelf: 'flex-start', background: bubbleOther, padding: '0.65rem 1rem', borderRadius: '18px 18px 18px 4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa', animation: 'bounce 1s infinite' }} />
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa', animation: 'bounce 1s infinite 0.2s' }} />
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa', animation: 'bounce 1s infinite 0.4s' }} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {replyTo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', background: 'rgba(108,99,255,0.08)', borderRadius: '10px', marginBottom: '0.5rem', border: '1px solid rgba(108,99,255,0.2)' }}>
          <span style={{ color: '#a78bfa', fontSize: '0.85rem' }}>↩ Replying to: {truncate(replyTo.content)}</span>
          <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', marginLeft: 'auto', fontSize: '1rem' }}>✕</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', position: 'relative' }}>
        {showMentions && filteredMentions.length > 0 && (
          <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '0.5rem', background: isLight ? '#f0f0f7' : '#1e1e2e', border: `1px solid ${border}`, borderRadius: '10px', padding: '0.4rem', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 60, minWidth: '160px' }}>
            {filteredMentions.map(u => (
              <button key={u} onClick={() => insertMention(u)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: textColor, padding: '0.4rem 0.75rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem', borderRadius: '6px' }}>@{u}</button>
            ))}
          </div>
        )}
        <input type="file" accept="image/*" ref={fileInputRef} onChange={sendImage} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current.click()} disabled={uploading} style={{ padding: '0.85rem', background: inputBg, color: uploading ? mutedColor : '#a78bfa', border: `1px solid ${inputBorder}`, borderRadius: '10px', cursor: uploading ? 'default' : 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>
          {uploading ? '⏳' : '📷'}
        </button>
        <input ref={inputRef} type="text" placeholder={replyTo ? `Replying to ${truncate(replyTo.content, 20)}...` : 'Type a message...'} value={newMessage} onChange={handleTyping} onKeyDown={e => e.key === 'Enter' && sendMessage()} style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none' }} />
        <button onClick={sendMessage} style={{ padding: '0.85rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>Send</button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
