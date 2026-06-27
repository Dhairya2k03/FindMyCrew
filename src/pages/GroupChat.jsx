import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import VoiceChat from '../components/VoiceChat'

const ROLE_CONFIG = {
  leader: { label: '👑 Leader', color: '#f59e0b' },
  admin:  { label: '🛡️ Admin',  color: '#6c63ff' },
  elder:  { label: '⚔️ Elder',  color: '#10b981' },
  member: { label: 'Member',    color: '#888'    },
}

export default function GroupChat() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [pendingMembers, setPendingMembers] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [myRole, setMyRole] = useState('member')
  const [profiles, setProfiles] = useState({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [roleMenuOpen, setRoleMenuOpen] = useState(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
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
      const accepted = (allMembers || []).filter(m => m.status === 'accepted')
      const pending = (allMembers || []).filter(m => m.status === 'pending')
      setMembers(accepted)
      setPendingMembers(pending)
      if (groupData?.leader_id === user.id) {
        setMyRole('leader')
      } else {
        const me = accepted.find(m => m.user_id === user.id)
        setMyRole(me?.role || 'member')
      }
      const memberIds = [...new Set([...(allMembers || []).map(m => m.user_id), groupData?.leader_id])]
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    const handler = () => setRoleMenuOpen(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    const content = newMessage.trim()
    setNewMessage('')
    const tempMsg = { id: `temp-${Date.now()}`, group_id: groupId, sender_id: currentUser.id, content, created_at: new Date() }
    setMessages(prev => [...prev, tempMsg])
    const { data } = await supabase.from('group_messages').insert({ group_id: groupId, sender_id: currentUser.id, content }).select().single()
    if (data) setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m))
  }

  const respondToMember = async (memberId, status) => {
    await supabase.from('group_members').update({ status }).eq('id', memberId)
    if (status === 'accepted') {
      const member = pendingMembers.find(m => m.id === memberId)
      setMembers(prev => [...prev, { ...member, status: 'accepted', role: 'member' }])
    }
    setPendingMembers(prev => prev.filter(m => m.id !== memberId))
  }

  const kickMember = async (memberId) => {
    await supabase.from('group_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
    setRoleMenuOpen(null)
  }

  const promoteRole = async (memberId, newRole) => {
    await supabase.from('group_members').update({ role: newRole }).eq('id', memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    setRoleMenuOpen(null)
  }

  const generateInvite = async () => {
    const code = Math.random().toString(36).substring(2, 10)
    await supabase.from('groups').update({ invite_code: code }).eq('id', groupId)
    const link = `${window.location.origin}/invite/${code}`
    await navigator.clipboard.writeText(link)
    alert('Invite link copied to clipboard!')
  }

  const isLeader = group?.leader_id === currentUser?.id
  const isAdmin = myRole === 'admin'
  const canManageMembers = isLeader || isAdmin

  const getName = (userId) => { const p = profiles[userId]; return p?.username || p?.email?.split('@')[0] || 'Player' }
  const getAvatar = (userId) => profiles[userId]?.avatar_url || null
  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const getColor = (userId) => { const name = getName(userId); return avatarColors[name.charCodeAt(0) % avatarColors.length] }

  const Avatar = ({ userId, size = 28 }) => {
    const url = getAvatar(userId)
    const name = getName(userId)
    if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    return <div style={{ width: size, height: size, borderRadius: '50%', background: getColor(userId), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: '700', flexShrink: 0 }}>{name[0]?.toUpperCase()}</div>
  }

  const RoleBadge = ({ role }) => {
    const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.member
    if (role === 'member') return null
    return <span style={{ fontSize: '0.65rem', color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}40`, borderRadius: '100px', padding: '1px 6px', whiteSpace: 'nowrap' }}>{cfg.label}</span>
  }

  const RoleMenu = ({ member }) => {
    const role = member.role || 'member'
    const isTargetLeader = member.user_id === group?.leader_id
    const isMe = member.user_id === currentUser?.id
    if (isTargetLeader || isMe) return null
    if (isAdmin && !isLeader) {
      return <button onClick={() => kickMember(member.id)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '6px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }}>Kick</button>
    }
    if (!isLeader) return null
    return (
      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button onClick={() => setRoleMenuOpen(roleMenuOpen === member.id ? null : member.id)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#aaa', borderRadius: '6px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }}>⚙️</button>
        {roleMenuOpen === member.id && (
          <div style={{ position: 'absolute', right: 0, top: '110%', background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '0.4rem', zIndex: 50, minWidth: '140px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {['admin', 'elder', 'member'].map(r => (
              <button key={r} onClick={() => promoteRole(member.id, r)} style={{ background: role === r ? 'rgba(108,99,255,0.2)' : 'transparent', border: 'none', color: role === r ? '#a78bfa' : '#ccc', borderRadius: '6px', padding: '0.4rem 0.75rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', textAlign: 'left', fontWeight: role === r ? '600' : '400' }}>
                {ROLE_CONFIG[r].label} {role === r ? '✓' : ''}
              </button>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '0.2rem', paddingTop: '0.2rem' }}>
              <button onClick={() => kickMember(member.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', borderRadius: '6px', padding: '0.4rem 0.75rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', textAlign: 'left', width: '100%' }}>🚫 Kick</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const sortedMembers = [...members].sort((a, b) => {
    const order = { admin: 0, elder: 1, member: 2 }
    return (order[a.role] ?? 2) - (order[b.role] ?? 2)
  })

  const Sidebar = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div>
        <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginBottom: '1rem', padding: 0, fontSize: '0.9rem' }}>← Back to Groups</button>
        {canManageMembers && (
          <button onClick={generateInvite} style={{ width: '100%', padding: '0.6rem', background: 'rgba(108,99,255,0.15)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.75rem' }}>🔗 Copy Invite Link</button>
        )}
        <h3 style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.25rem' }}>{group?.name}</h3>
        <p style={{ color: '#a78bfa', fontSize: '0.85rem' }}>{group?.game}</p>
        <div style={{ marginTop: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', color: ROLE_CONFIG[myRole]?.color || '#888' }}>You are: {ROLE_CONFIG[myRole]?.label || 'Member'}</span>
        </div>
      </div>

      {canManageMembers && pendingMembers.length > 0 && (
        <div>
          <p style={{ color: '#f59e0b', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Pending ({pendingMembers.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingMembers.map(m => (
              <div key={m.id} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '0.75rem' }}>
                <p style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{getName(m.user_id)}</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => respondToMember(m.id, 'accepted')} style={{ flex: 1, padding: '0.3rem', background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: '600' }}>Accept</button>
                  <button onClick={() => respondToMember(m.id, 'declined')} style={{ flex: 1, padding: '0.3rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', fontWeight: '600' }}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p style={{ color: '#aaa', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Members ({members.length + 1})</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '8px', background: 'rgba(245,158,11,0.08)' }}>
            <Avatar userId={group?.leader_id} />
            <p style={{ fontSize: '0.85rem', fontWeight: '500', flex: 1 }}>{getName(group?.leader_id)}</p>
            <RoleBadge role="leader" />
          </div>
          {sortedMembers.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '8px', background: m.role === 'admin' ? 'rgba(108,99,255,0.06)' : m.role === 'elder' ? 'rgba(16,185,129,0.04)' : 'transparent' }}>
              <Avatar userId={m.user_id} />
              <p style={{ fontSize: '0.85rem', flex: 1 }}>{getName(m.user_id)}</p>
              <RoleBadge role={m.role || 'member'} />
              <RoleMenu member={m} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
        <div className="desktop-sidebar" style={{ width: '260px', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '1.5rem', flexShrink: 0 }}>
          <Sidebar />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', minWidth: 0 }}>
          <div className="mobile-header" style={{ display: 'none', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem', padding: 0, fontFamily: 'Inter, sans-serif' }}>←</button>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '700', fontSize: '0.95rem' }}>{group?.name}</p>
              <p style={{ color: '#a78bfa', fontSize: '0.75rem' }}>{group?.game}</p>
            </div>
            <button onClick={() => setSidebarOpen(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: '8px', padding: '0.4rem 0.75rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>👥 {members.length + 1}</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#888', marginTop: '3rem' }}>
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎮</p>
                <p>No messages yet. Start the conversation!</p>
              </div>
            )}
            {messages.map(msg => {
              const isMine = msg.sender_id === currentUser?.id
              const senderMember = members.find(m => m.user_id === msg.sender_id)
              const senderRole = msg.sender_id === group?.leader_id ? 'leader' : senderMember?.role || 'member'
              const roleInfo = ROLE_CONFIG[senderRole]
              return (
                <div key={msg.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexDirection: isMine ? 'row-reverse' : 'row' }}>
                  <Avatar userId={msg.sender_id} size={32} />
                  <div style={{ maxWidth: '65%' }}>
                    {!isMine && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                        <p style={{ fontSize: '0.75rem', color: '#888' }}>{getName(msg.sender_id)}</p>
                        {senderRole !== 'member' && <span style={{ fontSize: '0.6rem', color: roleInfo.color }}>{roleInfo.label}</span>}
                      </div>
                    )}
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
            <button
              onClick={() => setVoiceOpen(!voiceOpen)}
              style={{ padding: '0.85rem', background: voiceOpen ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', color: voiceOpen ? '#10b981' : '#a78bfa', border: voiceOpen ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
            >
              🎙️
            </button>
            <input type="text" placeholder="Message the group..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none' }} />
            <button onClick={sendMessage} style={{ padding: '0.85rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>Send</button>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
          <div onClick={() => setSidebarOpen(false)} style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ width: '280px', background: '#0f0f1a', borderLeft: '1px solid rgba(255,255,255,0.08)', padding: '1.5rem', overflowY: 'auto' }}>
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem', marginBottom: '1rem', padding: 0 }}>✕</button>
            <Sidebar />
          </div>
        </div>
      )}

      {voiceOpen && (
        <VoiceChat
          roomName={`group-${groupId}`}
          onClose={() => setVoiceOpen(false)}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-header { display: flex !important; }
        }
      `}</style>
    </>
  )
}