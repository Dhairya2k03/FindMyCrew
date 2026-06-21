import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function GroupChat() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [pendingMembers, setPendingMembers] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [profiles, setProfiles] = useState({})
  const bottomRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data: groupData } = await supabase.from('groups').select('*').eq('id', groupId).single()
      setGroup(groupData)

      const { data: msgs } = await supabase.from('group_messages').select('*').eq('group_id', groupId).order('created_at', { ascending: true })
      setMessages(msgs || [])

      const { data: allMembers } = await supabase.from('group_members').select('*').eq('group_id', groupId)
      setMembers((allMembers || []).filter(m => m.status === 'accepted'))
      setPendingMembers((allMembers || []).filter(m => m.status === 'pending'))

      const memberIds = [...new Set([
        ...(allMembers || []).map(m => m.user_id),
        groupData?.leader_id
      ])]

      if (memberIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('*').in('id', memberIds)
        const map = {}
        profilesData?.forEach(p => { map[p.id] = p })
        setProfiles(map)
      }
    }
    load()
  }, [groupId])

  useEffect(() => {
    const channel = supabase.channel(`group-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, payload => {
        setMessages(prev => {
          const exists = prev.some(m => m.id === payload.new.id)
          if (exists) return prev
          return [...prev, payload.new]
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [groupId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    const content = newMessage.trim()
    setNewMessage('')

    const tempMsg = {
      id: `temp-${Date.now()}`,
      group_id: groupId,
      sender_id: currentUser.id,
      content,
      created_at: new Date()
    }
    setMessages(prev => [...prev, tempMsg])

    const { data } = await supabase.from('group_messages').insert({
      group_id: groupId,
      sender_id: currentUser.id,
      content
    }).select().single()

    if (data) setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m))
  }

  const respondToMember = async (memberId, status) => {
    await supabase.from('group_members').update({ status }).eq('id', memberId)
    if (status === 'accepted') {
      const member = pendingMembers.find(m => m.id === memberId)
      setMembers(prev => [...prev, { ...member, status: 'accepted' }])
    }
    setPendingMembers(prev => prev.filter(m => m.id !== memberId))
  }

  const kickMember = async (memberId) => {
    await supabase.from('group_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
  }

  const isLeader = group?.leader_id === currentUser?.id

  const getName = (userId) => {
    const p = profiles[userId]
    return p?.username || p?.email?.split('@')[0] || 'Player'
  }

  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const getColor = (userId) => {
    const name = getName(userId)
    return avatarColors[name.charCodeAt(0) % avatarColors.length]
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>

      {/* Sidebar */}
      <div style={{ width: '260px', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', flexShrink: 0 }}>
        <div>
          <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginBottom: '1rem', padding: 0, fontSize: '0.9rem' }}>
            ← Back to Groups
          </button>
          <h3 style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{group?.name}</h3>
          <p style={{ color: '#a78bfa', fontSize: '0.85rem' }}>{group?.game}</p>
        </div>

        {isLeader && pendingMembers.length > 0 && (
          <div>
            <p style={{ color: '#f59e0b', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Pending ({pendingMembers.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingMembers.map(m => (
                <div key={m.id} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '0.75rem' }}>
                  <p style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{getName(m.user_id)}</p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => respondToMember(m.id, 'accepted')} style={{ flex: 1, padding: '0.3rem', background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: '600' }}>
                      Accept
                    </button>
                    <button onClick={() => respondToMember(m.id, 'declined')} style={{ flex: 1, padding: '0.3rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: '600' }}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p style={{ color: '#aaa', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Members ({members.length + 1})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '8px', background: 'rgba(245,158,11,0.08)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: getColor(group?.leader_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', flexShrink: 0 }}>
                {getName(group?.leader_id)[0]?.toUpperCase()}
              </div>
              <p style={{ fontSize: '0.85rem', fontWeight: '500', flex: 1 }}>{getName(group?.leader_id)}</p>
              <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>👑</span>
            </div>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: getColor(m.user_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', flexShrink: 0 }}>
                  {getName(m.user_id)[0]?.toUpperCase()}
                </div>
                <p style={{ fontSize: '0.85rem', flex: 1 }}>{getName(m.user_id)}</p>
                {isLeader && m.user_id !== currentUser?.id && (
                  <button onClick={() => kickMember(m.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem 0.4rem', borderRadius: '4px', fontFamily: 'Inter, sans-serif' }}>
                    Kick
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1.5rem' }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#888', marginTop: '3rem' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎮</p>
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          {messages.map(msg => {
            const isMine = msg.sender_id === currentUser?.id
            const name = getName(msg.sender_id)
            const color = getColor(msg.sender_id)
            return (
              <div key={msg.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexDirection: isMine ? 'row-reverse' : 'row' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: '700', flexShrink: 0 }}>
                  {name[0]?.toUpperCase()}
                </div>
                <div style={{ maxWidth: '65%' }}>
                  {!isMine && <p style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>{name}</p>}
                  <div style={{ background: isMine ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : 'rgba(255,255,255,0.08)', color: 'white', padding: '0.65rem 1rem', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: '0.95rem', lineHeight: 1.4 }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            placeholder="Message the group..."
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
    </div>
  )
}