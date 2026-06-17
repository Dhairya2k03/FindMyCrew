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

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setOtherUser(profile)

      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true })
      setMessages(msgs || [])
    }
    load()
  }, [userId])

  useEffect(() => {
    const channel = supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        if (
          (msg.sender_id === currentUser?.id && msg.receiver_id === userId) ||
          (msg.sender_id === userId && msg.receiver_id === currentUser?.id)
        ) {
          setMessages(prev => [...prev, msg])
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
    await supabase.from('messages').insert({
      sender_id: currentUser.id,
      receiver_id: userId,
      content: newMessage.trim()
    })
    setNewMessage('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') sendMessage()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>
        Chat with {otherUser?.username || otherUser?.email?.split('@')[0]}
      </h2>
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', borderRadius: '12px', padding: '1rem', background: 'white', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {messages.length === 0 && <p style={{ color: '#aaa', textAlign: 'center' }}>No messages yet. Say hi!</p>}
        {messages.map(msg => (
          <div key={msg.id} style={{
            alignSelf: msg.sender_id === currentUser?.id ? 'flex-end' : 'flex-start',
            background: msg.sender_id === currentUser?.id ? '#6c63ff' : '#eee',
            color: msg.sender_id === currentUser?.id ? 'white' : '#333',
            padding: '0.5rem 1rem',
            borderRadius: '18px',
            maxWidth: '70%',
            fontSize: '0.95rem'
          }}>
            {msg.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem' }}
        />
        <button
          onClick={sendMessage}
          style={{ padding: '0.75rem 1.5rem', background: '#6c63ff', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}
        >
          Send
        </button>
      </div>
    </div>
  )
}