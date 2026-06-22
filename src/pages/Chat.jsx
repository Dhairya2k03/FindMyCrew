import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Chat() {
  const { userId } = useParams()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [uploading, setUploading] = useState(false)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setOtherUser(profile)
      const { data: msgs } = await supabase.from('messages').select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])
      // Mark messages as read
await supabase.from('messages')
  .update({ read_at: new Date().toISOString() })
  .eq('receiver_id', user.id)
  .eq('sender_id', userId)
  .is('read_at', null)

      // Mark messages as read
      await supabase.from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('receiver_id', user.id)
        .eq('sender_id', userId)
        .is('read_at', null)
    }
    load()
  }, [userId])

  useEffect(() => {
    if (!currentUser) return
    const channel = supabase.channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        if (
          (msg.sender_id === currentUser?.id && msg.receiver_id === userId) ||
          (msg.sender_id === userId && msg.receiver_id === currentUser?.id)
        ) {
          setMessages(prev => {
            const exists = prev.some(m => m.id === msg.id)
            if (exists) return prev
            return [...prev, msg]
          })
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [currentUser, userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    const content = newMessage.trim()
    setNewMessage('')

    const tempMsg = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser.id,
      receiver_id: userId,
      content,
      created_at: new Date()
    }
    setMessages(prev => [...prev, tempMsg])

    const { data } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: userId,
      content
    }).select().single()

    if (data) {
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m))
    }
  }

  const sendImage = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return alert('Please select an image file')
    if (file.size > 5 * 1024 * 1024) return alert('Image must be under 5MB')

    setUploading(true)

    const fileName = `${currentUser.id}-${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file)

    if (uploadError) {
      alert('Failed to upload image: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName)

    const tempMsg = {
      id: `temp-${Date.now()}`,
      sender_id: currentUser.id,
      receiver_id: userId,
      content: `[image]${publicUrl}`,
      created_at: new Date()
    }
    setMessages(prev => [...prev, tempMsg])

    const { data } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: userId,
      content: `[image]${publicUrl}`
    }).select().single()

    if (data) {
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m))
    }

    setUploading(false)
    fileInputRef.current.value = ''
  }

  const renderMessage = (msg) => {
    if (msg.content?.startsWith('[image]')) {
      const url = msg.content.replace('[image]', '')
      return (
        <img
          src={url}
          alt="sent image"
          style={{ maxWidth: '250px', maxHeight: '250px', borderRadius: '12px', display: 'block', cursor: 'pointer' }}
          onClick={() => window.open(url, '_blank')}
        />
      )
    }
    return msg.content
  }

  const name = otherUser?.username || otherUser?.email?.split('@')[0] || 'Player'
  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', maxWidth: '700px', margin: '0 auto', padding: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
          {name[0]?.toUpperCase()}
        </div>
        <div>
          <p style={{ fontWeight: '600' }}>{name}</p>
          <p style={{ fontSize: '0.8rem', color: '#4caf50' }}>● Online</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem', padding: '0.5rem' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '3rem' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👋</p>
            <p>Say hi to {name}!</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={{
            alignSelf: msg.sender_id === currentUser?.id ? 'flex-end' : 'flex-start',
            background: msg.content?.startsWith('[image]')
              ? 'transparent'
              : msg.sender_id === currentUser?.id
              ? 'linear-gradient(135deg, #6c63ff, #a78bfa)'
              : 'rgba(255,255,255,0.08)',
            color: 'white',
            padding: msg.content?.startsWith('[image]') ? '0' : '0.65rem 1rem',
            borderRadius: msg.sender_id === currentUser?.id ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            maxWidth: '70%',
            fontSize: '0.95rem',
            lineHeight: 1.4
          }}>
            {renderMessage(msg)}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={sendImage}
          style={{ display: 'none' }}
        />
        <button
          onClick={() => fileInputRef.current.click()}
          disabled={uploading}
          style={{
            padding: '0.85rem',
            background: 'rgba(255,255,255,0.05)',
            color: uploading ? '#555' : '#a78bfa',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            cursor: uploading ? 'default' : 'pointer',
            fontSize: '1.2rem',
            lineHeight: 1
          }}
        >
          {uploading ? '⏳' : '📷'}
        </button>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none' }}
        />
        <button
          onClick={sendMessage}
          style={{ padding: '0.85rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}
        >
          Send
        </button>
      </div>
    </div>
  )
}