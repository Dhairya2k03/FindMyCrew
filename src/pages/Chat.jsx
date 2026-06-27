import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import VoiceChat from '../components/VoiceChat'
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

const EMOJI_OPTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

export default function Chat() {
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
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [emojiPickerMsg, setEmojiPickerMsg] = useState(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const presenceChannelRef = useRef(null)
  const broadcastChannelRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const userIdRef = useRef(userId)

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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, isOtherTyping])

  useEffect(() => {
    const handler = () => setEmojiPickerMsg(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const handleTyping = (e) => {
    setNewMessage(e.target.value)
    if (!broadcastChannelRef.current || !currentUser) return
    broadcastChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { typing: true, userId: currentUser.id } })
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      broadcastChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { typing: false, userId: currentUser.id } })
    }, 1500)
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    const content = newMessage.trim()
    setNewMessage('')
    clearTimeout(typingTimeoutRef.current)
    broadcastChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { typing: false, userId: currentUser.id } })
    const tempMsg = { id: `temp-${Date.now()}`, sender_id: currentUser.id, receiver_id: userId, content, created_at: new Date() }
    setMessages(prev => [...prev, tempMsg])
    supabase.from('messages').insert({ sender_id: currentUser.id, receiver_id: userId, content }).select().single().then(({ data }) => {
      if (data) setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m))
    })
  }

  const deleteMessage = async (msgId) => {
    setMessages(prev => prev.filter(m => m.id !== msgId))
    await supabase.from('messages').delete().eq('id', msgId)
  }

  const toggleReaction = async (msgId, emoji) => {
    if (!currentUser) return
    const existing = (reactions[msgId] || []).find(r => r.user_id === currentUser.id && r.emoji === emoji)
    if (existing) {
      setReactions(prev => ({ ...prev, [msgId]: (prev[msgId] || []).filter(r => r.id !== existing.id) }))
      await supabase.from('message_reactions').delete().eq('id', existing.id)
    } else {
      const tempId = `temp-${Date.now()}`
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
    const tempMsg = { id: `temp-${Date.now()}`, sender_id: currentUser.id, receiver_id: userId, content: `[image]${publicUrl}`, created_at: new Date() }
    setMessages(prev => [...prev, tempMsg])
    supabase.from('messages').insert({ sender_id: currentUser.id, receiver_id: userId, content: `[image]${publicUrl}` }).select().single().then(({ data }) => {
      if (data) setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m))
    })
    setUploading(false)
    fileInputRef.current.value = ''
  }

  const renderMessage = (msg) => {
    if (msg.content?.startsWith('[image]')) {
      const url = msg.content.replace('[image]', '')
      return <img src={url} alt="sent image" style={{ maxWidth: '250px', maxHeight: '250px', borderRadius: '12px', display: 'block', cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />
    }
    return msg.content
  }

  const name = otherUser?.username || otherUser?.email?.split('@')[0] || 'Player'
  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length]

  const getStatus = () => {
    if (isOtherTyping) return { text: '● typing...', color: '#a78bfa' }
    if (isOtherOnline) return { text: '● Online', color: '#4caf50' }
    return { text: formatLastSeen(otherUser?.last_seen), color: '#888' }
  }
  const status = getStatus()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', maxWidth: '700px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
        {otherUser?.avatar_url ? (
          <img src={otherUser.avatar_url} alt={name} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>{name[0]?.toUpperCase()}</div>
        )}
        <div>
          <p style={{ fontWeight: '600', margin: 0 }}>{name}</p>
          <p style={{ fontSize: '0.8rem', color: status.color, margin: 0 }}>{status.text}</p>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', padding: '0.5rem' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '3rem' }}>
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
          return (
            <div key={msg.id} style={{ alignSelf: isMine ? 'flex-end' : 'flex-start', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '75%', position: 'relative' }}
              onMouseEnter={() => setHoveredMsg(msg.id)} onMouseLeave={() => setHoveredMsg(null)}>
              <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ background: msg.content?.startsWith('[image]') ? 'transparent' : isMine ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : 'rgba(255,255,255,0.08)', color: 'white', padding: msg.content?.startsWith('[image]') ? '0' : '0.65rem 1rem', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: '0.95rem', lineHeight: 1.4, opacity: isTemp ? 0.7 : 1 }}>
                  {renderMessage(msg)}
                </div>
                {!isTemp && isHovered && (
                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <button onClick={(e) => { e.stopPropagation(); setEmojiPickerMsg(emojiPickerMsg === msg.id ? null : msg.id) }} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', borderRadius: '6px', padding: '0.25rem 0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>😊</button>
                      {emojiPickerMsg === msg.id && (
                        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: '110%', [isMine ? 'right' : 'left']: 0, background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '0.5rem', display: 'flex', gap: '0.25rem', zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                          {EMOJI_OPTIONS.map(emoji => (
                            <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} style={{ background: (reactions[msg.id] || []).some(r => r.emoji === emoji && r.user_id === currentUser?.id) ? 'rgba(108,99,255,0.3)' : 'transparent', border: 'none', borderRadius: '6px', padding: '0.3rem', cursor: 'pointer', fontSize: '1.2rem' }}>{emoji}</button>
                          ))}
                        </div>
                      )}
                    </div>
                    {isMine && <button onClick={() => deleteMessage(msg.id)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem' }}>🗑️</button>}
                  </div>
                )}
              </div>
              {hasReactions && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
                  {Object.entries(groupedRxns).map(([emoji, userIds]) => (
                    <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} style={{ background: userIds.includes(currentUser?.id) ? 'rgba(108,99,255,0.25)' : 'rgba(255,255,255,0.07)', border: userIds.includes(currentUser?.id) ? '1px solid rgba(108,99,255,0.4)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '100px', padding: '0.15rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: 'white', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {emoji} <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{userIds.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {isOtherTyping && (
          <div style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.08)', padding: '0.65rem 1rem', borderRadius: '18px 18px 18px 4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa', animation: 'bounce 1s infinite' }} />
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa', animation: 'bounce 1s infinite 0.2s' }} />
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a78bfa', animation: 'bounce 1s infinite 0.4s' }} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <input type="file" accept="image/*" ref={fileInputRef} onChange={sendImage} style={{ display: 'none' }} />
        <button onClick={() => fileInputRef.current.click()} disabled={uploading} style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.05)', color: uploading ? '#555' : '#a78bfa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', cursor: uploading ? 'default' : 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>
          {uploading ? '⏳' : '📷'}
        </button>
        <button onClick={() => setVoiceOpen(!voiceOpen)} style={{ padding: '0.85rem', background: voiceOpen ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: voiceOpen ? '#10b981' : '#a78bfa', border: voiceOpen ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>
          🎙️
        </button>
        <input type="text" placeholder="Type a message..." value={newMessage} onChange={handleTyping} onKeyDown={e => e.key === 'Enter' && sendMessage()} style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none' }} />
        <button onClick={sendMessage} style={{ padding: '0.85rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>Send</button>
      </div>

      {voiceOpen && (
        <VoiceChat
          roomName={`chat-${[currentUser?.id, userId].sort().join('-')}`}
          onClose={() => setVoiceOpen(false)}
        />
      )}

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}