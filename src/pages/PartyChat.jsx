import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const makeTempId = () => crypto.randomUUID()

export default function PartyChat({ theme }) {
  const { partyId } = useParams()
  const navigate = useNavigate()
  const [party, setParty] = useState(null)
  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState({})
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [addPickerOpen, setAddPickerOpen] = useState(false)
  const [addCandidates, setAddCandidates] = useState([])
  const bottomRef = useRef(null)

  const isLight = theme === 'light'
  const bg          = isLight ? '#f0f0f7'          : '#0f0f1a'
  const border      = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const textColor   = isLight ? '#111'             : 'white'
  const mutedColor  = isLight ? '#555'              : '#888'
  const inputBg     = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'
  const inputBorder = isLight ? 'rgba(0,0,0,0.1)'  : 'rgba(255,255,255,0.1)'
  const bubbleOther = isLight ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.08)'

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data: partyData } = await supabase.from('parties').select('*').eq('id', partyId).single()
      setParty(partyData)

      const { data: memberRows } = await supabase.from('party_members').select('*').eq('party_id', partyId)
      setMembers(memberRows || [])

      const ids = (memberRows || []).map(m => m.user_id)
      if (ids.length > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('*').in('id', ids)
        const map = {}
        profilesData?.forEach(p => { map[p.id] = p })
        setProfiles(map)
      }

      const { data: msgs } = await supabase.from('party_messages').select('*').eq('party_id', partyId).order('created_at', { ascending: true })
      setMessages(msgs || [])
    }
    load()

    const channel = supabase.channel(`party-${partyId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_messages', filter: `party_id=eq.${partyId}` }, payload => {
        setMessages(prev => { if (prev.some(m => m.id === payload.new.id)) return prev; return [...prev, payload.new] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_members', filter: `party_id=eq.${partyId}` }, async payload => {
        setMembers(prev => [...prev, payload.new])
        const { data } = await supabase.from('profiles').select('*').eq('id', payload.new.user_id).single()
        if (data) setProfiles(prev => ({ ...prev, [data.id]: data }))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [partyId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    const content = newMessage.trim()
    setNewMessage('')
    const tempMsg = { id: makeTempId(), party_id: partyId, sender_id: currentUser.id, content, created_at: new Date() }
    setMessages(prev => [...prev, tempMsg])
    const { data } = await supabase.from('party_messages').insert({ party_id: partyId, sender_id: currentUser.id, content }).select().single()
    if (data) setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m))
  }

  const openAddPicker = async () => {
    // Candidates: people in the same source group not already in the party
    if (!party?.group_id) { setAddCandidates([]); setAddPickerOpen(true); return }
    const { data: groupMembers } = await supabase.from('group_members').select('user_id').eq('group_id', party.group_id).eq('status', 'accepted')
    const { data: groupData } = await supabase.from('groups').select('leader_id').eq('id', party.group_id).single()
    const candidateIds = [...new Set([...(groupMembers || []).map(m => m.user_id), groupData?.leader_id])]
      .filter(id => id && !members.some(m => m.user_id === id))
    if (candidateIds.length === 0) { setAddCandidates([]); setAddPickerOpen(true); return }
    const { data: profilesData } = await supabase.from('profiles').select('*').in('id', candidateIds)
    setAddCandidates(profilesData || [])
    setAddPickerOpen(true)
  }

  const addMember = async (userId) => {
    const { error } = await supabase.from('party_members').insert({ party_id: partyId, user_id: userId })
    if (error) return alert(error.message)
    setAddCandidates(prev => prev.filter(p => p.id !== userId))
  }

  const leaveParty = async () => {
    const myMembership = members.find(m => m.user_id === currentUser?.id)
    if (!myMembership) return
    if (!window.confirm('Leave this party chat?')) return
    await supabase.from('party_members').delete().eq('id', myMembership.id)
    navigate(party?.group_id ? `/groups/${party.group_id}` : '/messages')
  }

  const getName = (uid) => { const p = profiles[uid]; return p?.username || p?.email?.split('@')[0] || 'Player' }
  const getAvatar = (uid) => profiles[uid]?.avatar_url
  const avatarColors = ['#6c63ff', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#ec4899']
  const getColor = (uid) => { const n = getName(uid); return avatarColors[n.charCodeAt(0) % avatarColors.length] }

  const Avatar = ({ userId, size = 32 }) => {
    const url = getAvatar(userId)
    const n = getName(userId)
    if (url) return <img src={url} alt={n} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    return <div style={{ width: size, height: size, borderRadius: '50%', background: getColor(userId), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: '700', color: 'white', flexShrink: 0 }}>{n[0]?.toUpperCase()}</div>
  }

  const partyName = party?.name || members.filter(m => m.user_id !== currentUser?.id).map(m => getName(m.user_id)).slice(0, 3).join(', ') || 'Party'

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: bg }}>
      <div style={{ width: '240px', borderRight: `1px solid ${border}`, padding: '1.5rem', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <button onClick={() => navigate(party?.group_id ? `/groups/${party.group_id}` : '/messages')} style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', padding: 0, textAlign: 'left' }}>← Back</button>
        <div>
          <p style={{ fontWeight: '700', color: textColor, fontSize: '1.05rem', marginBottom: '0.2rem' }}>🎉 {partyName}</p>
          <p style={{ color: mutedColor, fontSize: '0.78rem' }}>{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {members.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Avatar userId={m.user_id} size={26} />
              <p style={{ fontSize: '0.85rem', color: textColor }}>{getName(m.user_id)}{m.user_id === currentUser?.id ? ' (you)' : ''}</p>
            </div>
          ))}
        </div>
        <button onClick={openAddPicker} style={{ padding: '0.5rem', background: 'rgba(108,99,255,0.12)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: '600' }}>+ Add member</button>
        <button onClick={leaveParty} style={{ marginTop: 'auto', padding: '0.5rem', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.82rem', fontWeight: '600' }}>Leave party</button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', minWidth: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: mutedColor, marginTop: '3rem' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎉</p>
              <p>Say hi to start the party chat!</p>
            </div>
          )}
          {messages.map(msg => {
            const isMine = msg.sender_id === currentUser?.id
            return (
              <div key={msg.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', flexDirection: isMine ? 'row-reverse' : 'row' }}>
                <Avatar userId={msg.sender_id} />
                <div style={{ maxWidth: '65%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                  {!isMine && <p style={{ fontSize: '0.75rem', color: mutedColor, marginBottom: '0.2rem' }}>{getName(msg.sender_id)}</p>}
                  <div style={{ background: isMine ? 'linear-gradient(135deg, #6c63ff, #a78bfa)' : bubbleOther, color: isMine ? 'white' : textColor, padding: '0.65rem 1rem', borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', fontSize: '0.95rem' }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input type="text" placeholder="Message the party..." value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} style={{ flex: 1, padding: '0.85rem 1rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textColor, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none' }} />
          <button onClick={sendMessage} style={{ padding: '0.85rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>Send</button>
        </div>
      </div>

      {addPickerOpen && (
        <div onClick={() => setAddPickerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: isLight ? '#f0f0f7' : '#1a1a2e', border: `1px solid ${border}`, borderRadius: '16px', padding: '1.5rem', width: '90%', maxWidth: '360px' }}>
            <h3 style={{ fontWeight: '700', marginBottom: '1rem', color: textColor }}>Add to party</h3>
            {addCandidates.length === 0 ? (
              <p style={{ color: mutedColor, fontSize: '0.9rem' }}>No one else to add.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {addCandidates.map(p => (
                  <button key={p.id} onClick={() => addMember(p.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', background: inputBg, border: `1px solid ${border}`, borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Inter, sans-serif' }}>
                    <Avatar userId={p.id} size={28} />
                    <span style={{ color: textColor, fontSize: '0.9rem' }}>{p.username || p.email?.split('@')[0]}</span>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setAddPickerOpen(false)} style={{ marginTop: '1rem', width: '100%', padding: '0.6rem', background: 'transparent', color: mutedColor, border: `1px solid ${border}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}