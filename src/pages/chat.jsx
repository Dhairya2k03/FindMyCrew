import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Chat() {
  const { userId } = useParams()
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const bottomRef = useRef(null)

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
    }
    load()
  }, [userId])

  useEffect(() => {
    const channel = supabase.channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        if (
          (msg.sender_id === currentUser?.id && msg.receiver_id === userId) ||
          (msg.sender_id === userId && msg.receiver_id === currentUser?.id)
        ) setMessages(prev => [...prev, msg])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [currentUser, userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    await supabase.from('messages').insert({ sender_id: currentUser.id, receiver_id: userId, content: newMessage.trim() })
    setNewMessage('')
  }

  const name = otherUser?.username || otherUser?.email?.split('@')[0] || 'Player'
  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const color = avatarColors[name.charCodeAt(0) % avatarColors.length]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', maxWidth: '700px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem 1.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
          {name[0]?.toUpperCase()}
        </div>
        <div>
          <p style={{ fontWeight: '600' }}>{name}</p>
          <p style={{ fontSize: '0.8rem', color: '#4caf50' }}>● Online</p>
        </div>
      </div>

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
            background: msg.sender_id === currentUser?.id ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : 'rgba(255,255,255,0.08)',
            color: 'white',
            padding: '0.65rem 1rem',
            borderRadius: msg.sender_id === currentUser?.id ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            maxWidth: '70%',
            fontSize: '0.95rem',
            lineHeight: 1.4
          }}>
            {msg.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none' }}
        />
        <button onClick={sendMessage} style={{ padding: '0.85rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>
          Send
        </button>
      </div>
    </div>
  )
}