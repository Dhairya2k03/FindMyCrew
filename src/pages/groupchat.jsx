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

const EMOJI_OPTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥']

export default function GroupChat({ theme }) {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [pendingMembers, setPendingMembers] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [myRole, setMyRole] = useState('member')
  const [myMembershipId, setMyMembershipId] = useState(null)
  const [profiles, setProfiles] = useState({})
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [roleMenuOpen, setRoleMenuOpen] = useState(null)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [announcements, setAnnouncements] = useState([])
  const [newAnnouncement, setNewAnnouncement] = useState('')
  const [showAnnouncementInput, setShowAnnouncementInput] = useState(false)
  const [reactions, setReactions] = useState({})
  const [emojiPickerMsg, setEmojiPickerMsg] = useState(null)
  const [hoveredMsg, setHoveredMsg] = useState(null)
  const [events, setEvents] = useState([])
  const [showEventForm, setShowEventForm] = useState(false)
  const [onlineMembers, setOnlineMembers] = useState(new Set())
  const [newEvent, setNewEvent] = useState({ title: '', description: '', event_time: '' })
  const [pinnedMessage, setPinnedMessage] = useState(null)
  const [showPinned, setShowPinned] = useState(true)
  const [reportMsgId, setReportMsgId] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const bottomRef = useRef(null)

  const isLight = theme === 'light'
  const bg         = isLight ? '#f0f0f7'                 : '#0f0f1a'
  const border     = isLight ? 'rgba(0,0,0,0.08)'        : 'rgba(255,255,255,0.08)'
  const textColor  = isLight ? '#111'                    : 'white'
  const mutedColor = isLight ? '#555'                    : '#888'
  const inputBg    = isLight ? 'rgba(0,0,0,0.04)'        : 'rgba(255,255,255,0.05)'
  const inputBorder= isLight ? 'rgba(0,0,0,0.1)'         : 'rgba(255,255,255,0.1)'
  const bubbleOther= isLight ? 'rgba(0,0,0,0.07)'        : 'rgba(255,255,255,0.08)'
  const actionBtn  = isLight ? 'rgba(0,0,0,0.06)'        : 'rgba(255,255,255,0.08)'
  const actionBord = isLight ? 'rgba(0,0,0,0.12)'        : 'rgba(255,255,255,0.12)'

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
        setMyMembershipId(me?.id || null)
      }
      const memberIds = [...new Set([...(allMembers || []).map(m => m.user_id), groupData?.leader_id])]
      if (memberIds.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('*').in('id', memberIds)
        const map = {}
        profilesData?.forEach(p => { map[p.id] = p })
        setProfiles(map)
      }
      const { data: announcementsData } = await supabase.from('group_announcements').select('*').eq('group_id', groupId).order('created_at', { ascending: false })
      setAnnouncements(announcementsData || [])
      if (msgs && msgs.length > 0) {
        const msgIds = msgs.map(m => m.id)
        const { data: rxns } = await supabase.from('group_message_reactions').select('*').in('message_id', msgIds)
        if (rxns) {
          const grouped = {}
          rxns.forEach(r => {
            if (!grouped[r.message_id]) grouped[r.message_id] = []
            grouped[r.message_id].push(r)
          })
          setReactions(grouped)
        }
      }
      const { data: eventsData } = await supabase.from('group_events').select('*').eq('group_id', groupId).order('event_time', { ascending: true })
      setEvents(eventsData || [])
      const { data: pinned } = await supabase.from('pinned_messages').select('*').eq('chat_type', 'group').eq('chat_id', groupId).order('created_at', { ascending: false }).limit(1).single()
      if (pinned) setPinnedMessage(pinned)
      const presenceCh = supabase.channel('group-presence-' + groupId, { config: { presence: { key: user.id } } })
      presenceCh
        .on('presence', { event: 'sync' }, () => { setOnlineMembers(new Set(Object.keys(presenceCh.presenceState()))) })
        .on('presence', { event: 'join' }, ({ key }) => setOnlineMembers(prev => new Set([...prev, key])))
        .on('presence', { event: 'leave' }, ({ key }) => setOnlineMembers(prev => { const n = new Set(prev); n.delete(key); return n }))
        .subscribe(async (status) => { if (status === 'SUBSCRIBED') await presenceCh.track({ online_at: new Date().toISOString() }) })
    }
    load()
  }, [groupId])

  useEffect(() => {
    const channel = supabase.channel(`group-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, payload => {
        setMessages(prev => { const exists = prev.some(m => m.id === payload.new.id); if (exists) return prev; return [...prev, payload.new] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_announcements', filter: `group_id=eq.${groupId}` }, payload => {
        setAnnouncements(prev => [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_announcements', filter: `group_id=eq.${groupId}` }, payload => {
        setAnnouncements(prev => prev.filter(a => a.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_message_reactions' }, payload => {
        const r = payload.new
        setReactions(prev => { const existing = prev[r.message_id] || []; if (existing.some(e => e.id === r.id)) return prev; return { ...prev, [r.message_id]: [...existing, r] } })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_message_reactions' }, payload => {
        const r = payload.old
        setReactions(prev => ({ ...prev, [r.message_id]: (prev[r.message_id] || []).filter(e => e.id !== r.id) }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_events', filter: `group_id=eq.${groupId}` }, payload => {
        setEvents(prev => [...prev, payload.new].sort((a, b) => new Date(a.event_time) - new Date(b.event_time)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_events', filter: `group_id=eq.${groupId}` }, payload => {
        setEvents(prev => prev.filter(e => e.id !== payload.old.id))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [groupId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    const handler = () => { setRoleMenuOpen(null); setEmojiPickerMsg(null) }
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

  const postSystemMessage = async (content) => {
    await supabase.from('group_messages').insert({
      group_id: groupId,
      sender_id: currentUser.id,
      content,
      is_system: true
    })
  }

  const leaveGroup = async () => {
    if (!myMembershipId) return
    if (!window.confirm('Are you sure you want to leave this group?')) return
    await postSystemMessage(`${getName(currentUser.id)} left the group`)
    await supabase.from('group_members').delete().eq('id', myMembershipId)
    navigate('/groups')
  }

  const pinMessage = async (msg) => {
    if (myRole !== 'leader' && myRole !== 'admin') return
    await supabase.from('pinned_messages').delete().eq('chat_type', 'group').eq('chat_id', groupId)
    const { data } = await supabase.from('pinned_messages').insert({
      chat_type: 'group', chat_id: groupId, message_id: msg.id,
      message_content: msg.content, pinned_by: currentUser.id
    }).select().single()
    if (data) { setPinnedMessage(data); setShowPinned(true) }
  }

  const unpinMessage = async () => {
    await supabase.from('pinned_messages').delete().eq('chat_type', 'group').eq('chat_id', groupId)
    setPinnedMessage(null)
  }

  const submitReport = async (msg) => {
    if (!reportReason.trim()) return alert('Please enter a reason')
    const adminId = group?.leader_id
    await supabase.from('reports').insert({
      reporter_id: currentUser.id, reported_user_id: msg.sender_id,
      context_type: 'group_message', context_id: groupId,
      message_content: msg.content, reason: reportReason.trim()
    })
    const reporterName = profiles[currentUser.id]?.username || 'Someone'
    const reportedName = profiles[msg.sender_id]?.username || 'a member'
    await supabase.from('notifications').insert({
      user_id: adminId, type: 'report',
      content: `🚨 ${reporterName} reported ${reportedName} in "${group?.name}": "${reportReason.trim()}"`,
      read: false
    })
    setReportMsgId(null)
    setReportReason('')
    alert('Report submitted. The group leader has been notified.')
  }

  const toggleReaction = async (msgId, emoji) => {
    if (!currentUser) return
    const existing = (reactions[msgId] || []).find(r => r.user_id === currentUser.id && r.emoji === emoji)
    if (existing) {
      setReactions(prev => ({ ...prev, [msgId]: (prev[msgId] || []).filter(r => r.id !== existing.id) }))
      await supabase.from('group_message_reactions').delete().eq('id', existing.id)
    } else {
      const tempId = `temp-${Date.now()}`
      setReactions(prev => ({ ...prev, [msgId]: [...(prev[msgId] || []), { id: tempId, message_id: msgId, user_id: currentUser.id, emoji }] }))
      const { data } = await supabase.from('group_message_reactions').insert({ message_id: msgId, user_id: currentUser.id, emoji }).select().single()
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

  const postAnnouncement = async () => {
    if (!newAnnouncement.trim()) return
    const { error } = await supabase.from('group_announcements').insert({ group_id: groupId, content: newAnnouncement.trim(), created_by: currentUser.id })
    if (error) return alert(error.message)
    setNewAnnouncement('')
    setShowAnnouncementInput(false)
  }

  const deleteAnnouncement = async (id) => { await supabase.from('group_announcements').delete().eq('id', id) }

  const createEvent = async () => {
    if (!newEvent.title.trim() || !newEvent.event_time) return alert('Please fill in title and time')
    const { error } = await supabase.from('group_events').insert({ group_id: groupId, title: newEvent.title.trim(), description: newEvent.description.trim(), event_time: newEvent.event_time, created_by: currentUser.id })
    if (error) return alert(error.message)
    setNewEvent({ title: '', description: '', event_time: '' })
    setShowEventForm(false)
  }

  const deleteEvent = async (id) => { await supabase.from('group_events').delete().eq('id', id) }

  const respondToMember = async (memberId, status) => {
    const member = pendingMembers.find(m => m.id === memberId)
    await supabase.from('group_members').update({ status }).eq('id', memberId)
    if (status === 'accepted') {
      setMembers(prev => [...prev, { ...member, status: 'accepted', role: 'member' }])
      if (member) postSystemMessage(`${getName(member.user_id)} joined the group`)
    }
    setPendingMembers(prev => prev.filter(m => m.id !== memberId))
  }

  const kickMember = async (memberId) => {
    const member = members.find(m => m.id === memberId)
    await supabase.from('group_members').delete().eq('id', memberId)
    setMembers(prev => prev.filter(m => m.id !== memberId))
    setRoleMenuOpen(null)
    if (member) postSystemMessage(`${getName(member.user_id)} was removed from the group`)
  }

  const promoteRole = async (memberId, newRole) => {
    const member = members.find(m => m.id === memberId)
    const oldRole = member?.role || 'member'
    await supabase.from('group_members').update({ role: newRole }).eq('id', memberId)
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m))
    setRoleMenuOpen(null)
    if (member) {
      const roleOrder = { admin: 3, elder: 2, member: 1 }
      const isPromotion = roleOrder[newRole] > roleOrder[oldRole]
      const verb = isPromotion ? 'promoted' : 'demoted'
      const roleLabel = ROLE_CONFIG[newRole].label.replace(/^\S+\s/, '')
      postSystemMessage(`${getName(member.user_id)} was ${verb} to ${roleLabel}`)
    }
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
  const canAnnounce = isLeader || isAdmin || myRole === 'elder'
  const canPin = isLeader || isAdmin

  const getName = (uid) => { const p = profiles[uid]; return p?.username || p?.email?.split('@')[0] || 'Player' }
  const getAvatar = (uid) => profiles[uid]?.avatar_url || null
  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const getColor = (uid) => { const n = getName(uid); return avatarColors[n.charCodeAt(0) % avatarColors.length] }
  const truncate = (text, n = 50) => text?.length > n ? text.substring(0, n) + '...' : text

  const Avatar = ({ userId, size = 28 }) => {
    const url = getAvatar(userId)
    const n = getName(userId)
    if (url) return <img src={url} alt={n} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    return <div style={{ width: size, height: size, borderRadius: '50%', background: getColor(userId), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.35, fontWeight: '700', flexShrink: 0, color: 'white' }}>{n[0]?.toUpperCase()}</div>
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
    if (isAdmin && !isLeader) return <button onClick={() => kickMember(member.id)} style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '6px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }}>Kick</button>
    if (!isLeader) return null
    return (
      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
        <button onClick={() => setRoleMenuOpen(roleMenuOpen === member.id ? null : member.id)} style={{ background: actionBtn, border: `1px solid ${actionBord}`, color: mutedColor, borderRadius: '6px', padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }}>⚙️</button>
        {roleMenuOpen === member.id && (
          <div style={{ position: 'absolute', right: 0, top: '110%', background: isLight ? '#f0f0f7' : '#1a1a2e', border: `1px solid ${border}`, borderRadius: '10px', padding: '0.4rem', zIndex: 50, minWidth: '140px', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {['admin', 'elder', 'member'].map(r => (
              <button key={r} onClick={() => promoteRole(member.id, r)} style={{ background: role === r ? 'rgba(108,99,255,0.2)' : 'transparent', border: 'none', color: role === r ? '#a78bfa' : textColor, borderRadius: '6px', padding: '0.4rem 0.75rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', textAlign: 'left', fontWeight: role === r ? '600' : '400' }}>
                {ROLE_CONFIG[r].label} {role === r ? '✓' : ''}
              </button>
            ))}
            <div style={{ borderTop: `1px solid ${border}`, marginTop: '0.2rem', paddingTop: '0.2rem' }}>
              <button onClick={() => kickMember(member.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', borderRadius: '6px', padding: '0.4rem 0.75rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', textAlign: 'left', width: '100%' }}>🚫 Kick</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const sortedMembers = [...members].sort((a, b) => { const order = { admin: 0, elder: 1, member: 2 }; return (order[a.role] ?? 2) - (order[b.role] ?? 2) })
  const formatEventTime = (dt) => new Date(dt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const Sidebar = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div>
        <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginBottom: '1rem', padding: 0, fontSize: '0.9rem' }}>← Back to Groups</button>
        {canManageMembers && <button onClick={generateInvite} style={{ width: '100%', padding: '0.6rem', background: 'rgba(108,99,255,0.15)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.75rem' }}>🔗 Copy Invite Link</button>}
        <h3 style={{ fontWeight: '700', fontSize: '1.1rem', marginBottom: '0.25rem', color: textColor }}>{group?.name}</h3>
        <p style={{ color: '#a78bfa', fontSize: '0.85rem' }}>{group?.game}</p>
        <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.75rem', color: ROLE_CONFIG[myRole]?.color || mutedColor }}>You are: {ROLE_CONFIG[myRole]?.label || 'Member'}</span>
          {!isLeader && myMembershipId && (
            <button onClick={leaveGroup} style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', borderRadius: '6px', padding: '0.2rem 0.6rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: '600' }}>
              Leave
            </button>
          )}
        </div>
      </div>

      {events.length > 0 && (
        <div>
          <p style={{ color: '#10b981', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>📅 Events</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {events.map(ev => (
              <div key={ev.id} style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', padding: '0.6rem 0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ fontWeight: '600', fontSize: '0.85rem', color: '#10b981' }}>{ev.title}</p>
                  {(isLeader || isAdmin || ev.created_by === currentUser?.id) && (
                    <button onClick={() => deleteEvent(ev.id)} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                  )}
                </div>
                <p style={{ color: mutedColor, fontSize: '0.75rem' }}>{formatEventTime(ev.event_time)}</p>
                {ev.description && <p style={{ color: mutedColor, fontSize: '0.75rem', marginTop: '0.2rem' }}>{ev.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {canManageMembers && pendingMembers.length > 0 && (
        <div>
          <p style={{ color: '#f59e0b', fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Pending ({pendingMembers.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {pendingMembers.map(m => (
              <div key={m.id} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '0.75rem' }}>
                <p style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', color: textColor }}>{getName(m.user_id)}</p>
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
        <p style={{ color: mutedColor, fontWeight: '600', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Members ({members.length + 1}) · 🟢 {onlineMembers.size} online</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '8px', background: 'rgba(245,158,11,0.08)' }}>
            <Avatar userId={group?.leader_id} />
            <p style={{ fontSize: '0.85rem', fontWeight: '500', flex: 1, color: textColor }}>{getName(group?.leader_id)}</p>
            <RoleBadge role="leader" />
          </div>
          {sortedMembers.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: '8px', background: m.role === 'admin' ? 'rgba(108,99,255,0.06)' : m.role === 'elder' ? 'rgba(16,185,129,0.04)' : 'transparent' }}>
              <Avatar userId={m.user_id} />
              <p style={{ fontSize: '0.85rem', flex: 1, color: textColor }}>{getName(m.user_id)}</p>
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
      <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: bg }}>
        <div className="desktop-sidebar" style={{ width: '260px', borderRight: `1px solid ${border}`, padding: '1.5rem', flexShrink: 0 }}>
          <Sidebar />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', minWidth: 0 }}>
          <div className="mobile-header" style={{ display: 'none', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <button onClick={() => navigate('/groups')} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '0.9rem', padding: 0, fontFamily: 'Inter, sans-serif' }}>←</button>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '700', fontSize: '0.95rem', color: textColor }}>{group?.name}</p>
              <p style={{ color: '#a78bfa', fontSize: '0.75rem' }}>{group?.game}</p>
            </div>
            <button onClick={() => setSidebarOpen(true)} style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textColor, borderRadius: '8px', padding: '0.4rem 0.75rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>👥 {members.length + 1}</button>
          </div>

          {pinnedMessage && showPinned && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.25)', borderRadius: '10px', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem' }}>📌</span>
              <p style={{ flex: 1, fontSize: '0.85rem', color: '#a78bfa', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truncate(pinnedMessage.message_content, 60)}</p>
              {canPin && <button onClick={unpinMessage} title="Unpin" style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '0.75rem', padding: '0 0.25rem' }}>✕</button>}
              <button onClick={() => setShowPinned(false)} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '0.75rem' }}>▲</button>
            </div>
          )}
          {pinnedMessage && !showPinned && (
            <button onClick={() => setShowPinned(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: '0.8rem', marginBottom: '0.5rem', padding: 0 }}>
              📌 Show pinned message
            </button>
          )}

          {announcements.length > 0 && (
            <div style={{ marginBottom: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {announcements.map(a => (
                <div key={a.id} style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>📢</span>
                  <p style={{ flex: 1, fontSize: '0.9rem', color: '#f5c842', lineHeight: 1.4 }}>{a.content}</p>
                  {(isLeader || isAdmin || a.created_by === currentUser?.id) && (
                    <button onClick={() => deleteAnnouncement(a.id)} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '0.8rem', flexShrink: 0 }}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}

          {canAnnounce && showAnnouncementInput && (
            <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <input type="text" placeholder="Write an announcement..." value={newAnnouncement} onChange={e => setNewAnnouncement(e.target.value)} onKeyDown={e => e.key === 'Enter' && postAnnouncement()} style={{ flex: 1, padding: '0.65rem 1rem', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)', color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }} />
              <button onClick={postAnnouncement} style={{ padding: '0.65rem 1rem', background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem' }}>Post</button>
              <button onClick={() => setShowAnnouncementInput(false)} style={{ padding: '0.65rem 0.75rem', background: 'transparent', color: mutedColor, border: `1px solid ${border}`, borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>✕</button>
            </div>
          )}

          {canManageMembers && showEventForm && (
            <div style={{ marginBottom: '0.75rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input type="text" placeholder="Event title..." value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }} />
              <input type="text" placeholder="Description (optional)" value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }} />
              <input type="datetime-local" value={newEvent.event_time} onChange={e => setNewEvent(p => ({ ...p, event_time: e.target.value }))} style={{ padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.2)', background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }} />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={createEvent} style={{ flex: 1, padding: '0.6rem', background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>Create Event</button>
                <button onClick={() => setShowEventForm(false)} style={{ padding: '0.6rem 0.75rem', background: 'transparent', color: mutedColor, border: `1px solid ${border}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>✕</button>
              </div>
            </div>
          )}

          {reportMsgId && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: isLight ? '#f0f0f7' : '#1a1a2e', border: `1px solid ${border}`, borderRadius: '16px', padding: '1.5rem', width: '90%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontWeight: '700', fontSize: '1rem', color: '#ef4444', margin: 0 }}>🚨 Report Message</h3>
                <p style={{ color: mutedColor, fontSize: '0.85rem', margin: 0 }}>Message: <em>"{truncate(messages.find(m => m.id === reportMsgId)?.content, 60)}"</em></p>
                <textarea placeholder="Describe the reason for reporting..." value={reportReason} onChange={e => setReportReason(e.target.value)} rows={3} style={{ padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)', background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none', resize: 'none' }} />
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => submitReport(messages.find(m => m.id === reportMsgId))} style={{ flex: 1, padding: '0.75rem', background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>Submit Report</button>
                  <button onClick={() => { setReportMsgId(null); setReportReason('') }} style={{ padding: '0.75rem 1rem', background: 'transparent', color: mutedColor, border: `1px solid ${border}`, borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: mutedColor, marginTop: '3rem' }}>
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎮</p>
                <p>No messages yet. Start the conversation!</p>
              </div>
            )}
            {messages.map(msg => {
              if (msg.is_system) {
                return (
                  <div key={msg.id} style={{ textAlign: 'center', margin: '0.25rem 0' }}>
                    <span style={{ background: actionBtn, color: mutedColor, fontSize: '0.75rem', padding: '0.3rem 0.9rem', borderRadius: '100px', border: `1px solid ${actionBord}` }}>
                      {msg.content}
                    </span>
                  </div>
                )
              }
              const isMine = msg.sender_id === currentUser?.id
              const senderMember = members.find(m => m.user_id === msg.sender_id)
              const senderRole = msg.sender_id === group?.leader_id ? 'leader' : senderMember?.role || 'member'
              const roleInfo = ROLE_CONFIG[senderRole]
              const groupedRxns = getGroupedReactions(msg.id)
              const hasReactions = Object.keys(groupedRxns).length > 0
              const isHovered = hoveredMsg === msg.id
              const isPinned = pinnedMessage?.message_id === msg.id
              return (
                <div key={msg.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexDirection: isMine ? 'row-reverse' : 'row' }}
                  onMouseEnter={() => setHoveredMsg(msg.id)} onMouseLeave={() => setHoveredMsg(null)}>
                  <Avatar userId={msg.sender_id} size={32} />
                  <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                    {!isMine && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                        <p style={{ fontSize: '0.75rem', color: mutedColor }}>{getName(msg.sender_id)}</p>
                        {senderRole !== 'member' && <span style={{ fontSize: '0.6rem', color: roleInfo.color }}>{roleInfo.label}</span>}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{ background: isMine ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : bubbleOther, color: isMine ? 'white' : textColor, padding: '0.65rem 1rem', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: '0.95rem', lineHeight: 1.4, outline: isPinned ? '2px solid rgba(108,99,255,0.4)' : 'none' }}>
                        {msg.content}
                      </div>
                      {isHovered && (
                        <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                          {canPin && <button onClick={() => pinMessage(msg)} title="Pin" style={{ background: actionBtn, border: `1px solid ${actionBord}`, color: isPinned ? '#a78bfa' : textColor, borderRadius: '6px', padding: '0.25rem 0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>📌</button>}
                          {!isMine && <button onClick={() => setReportMsgId(msg.id)} title="Report" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: '6px', padding: '0.25rem 0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>🚨</button>}
                          <div style={{ position: 'relative' }}>
                            <button onClick={(e) => { e.stopPropagation(); setEmojiPickerMsg(emojiPickerMsg === msg.id ? null : msg.id) }} style={{ background: actionBtn, border: `1px solid ${actionBord}`, color: textColor, borderRadius: '6px', padding: '0.25rem 0.4rem', cursor: 'pointer', fontSize: '0.8rem' }}>😊</button>
                            {emojiPickerMsg === msg.id && (
                              <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: '110%', [isMine ? 'right' : 'left']: 0, background: isLight ? '#f0f0f7' : '#1e1e2e', border: `1px solid ${border}`, borderRadius: '12px', padding: '0.5rem', display: 'flex', gap: '0.25rem', zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
                                {EMOJI_OPTIONS.map(emoji => (
                                  <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} style={{ background: (reactions[msg.id] || []).some(r => r.emoji === emoji && r.user_id === currentUser?.id) ? 'rgba(108,99,255,0.3)' : 'transparent', border: 'none', borderRadius: '6px', padding: '0.3rem', cursor: 'pointer', fontSize: '1.2rem' }}>{emoji}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
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
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {canAnnounce && <button onClick={() => setShowAnnouncementInput(!showAnnouncementInput)} style={{ padding: '0.85rem', background: showAnnouncementInput ? 'rgba(245,158,11,0.2)' : inputBg, color: showAnnouncementInput ? '#f59e0b' : '#a78bfa', border: showAnnouncementInput ? '1px solid rgba(245,158,11,0.3)' : `1px solid ${inputBorder}`, borderRadius: '10px', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>📢</button>}
            {canManageMembers && <button onClick={() => setShowEventForm(!showEventForm)} style={{ padding: '0.85rem', background: showEventForm ? 'rgba(16,185,129,0.2)' : inputBg, color: showEventForm ? '#10b981' : '#a78bfa', border: showEventForm ? '1px solid rgba(16,185,129,0.3)' : `1px solid ${inputBorder}`, borderRadius: '10px', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>📅</button>}
            <button onClick={() => setVoiceOpen(!voiceOpen)} style={{ padding: '0.85rem', background: voiceOpen ? 'rgba(16,185,129,0.15)' : inputBg, color: voiceOpen ? '#10b981' : '#a78bfa', border: voiceOpen ? '1px solid rgba(16,185,129,0.3)' : `1px solid ${inputBorder}`, borderRadius: '10px', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}>🎙️</button>
            <input type="text" placeholder="Message the group..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none' }} />
            <button onClick={sendMessage} style={{ padding: '0.85rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>Send</button>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex' }}>
          <div onClick={() => setSidebarOpen(false)} style={{ flex: 1, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ width: '280px', background: isLight ? '#f0f0f7' : '#0f0f1a', borderLeft: `1px solid ${border}`, padding: '1.5rem', overflowY: 'auto' }}>
            <button onClick={() => setSidebarOpen(false)} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '1.2rem', marginBottom: '1rem', padding: 0 }}>✕</button>
            <Sidebar />
          </div>
        </div>
      )}

      {voiceOpen && <VoiceChat roomName={`group-${groupId}`} onClose={() => setVoiceOpen(false)} />}

      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-header { display: flex !important; }
        }
      `}</style>
    </>
  )
}