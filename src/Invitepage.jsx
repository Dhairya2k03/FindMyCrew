import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function InvitePage() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [group, setGroup] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handle = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: groupData, error } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', inviteCode)
        .single()

      if (error || !groupData) {
        setStatus('error')
        setMessage('Invalid or expired invite link.')
        return
      }

      setGroup(groupData)

      if (groupData.leader_id === user.id) {
        setStatus('already')
        setMessage("You're the leader of this group!")
        return
      }

      const { data: existing } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupData.id)
        .eq('user_id', user.id)
        .single()

      if (existing) {
        if (existing.status === 'accepted') {
          setStatus('already')
          setMessage("You're already a member of this group.")
        } else if (existing.status === 'pending') {
          setStatus('already')
          setMessage('Your join request is already pending.')
        }
        return
      }

      const { error: joinError } = await supabase.from('group_members').insert({
        group_id: groupData.id,
        user_id: user.id,
        status: 'accepted'
      })

      if (joinError) {
        setStatus('error')
        setMessage('Something went wrong. Please try again.')
        return
      }

      setStatus('success')
    }

    handle()
  }, [inviteCode])

  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 64px)',
    padding: '2rem'
  }

  const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    padding: '2.5rem',
    maxWidth: '420px',
    width: '100%',
    textAlign: 'center'
  }

  const btnStyle = {
    marginTop: '1.5rem',
    padding: '0.85rem 2rem',
    background: 'linear-gradient(135deg, #6c63ff, #a78bfa)',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontFamily: 'Inter, sans-serif',
    fontWeight: '600',
    fontSize: '1rem'
  }

  if (status === 'loading') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔗</p>
        <p style={{ color: '#888' }}>Checking invite link...</p>
      </div>
    </div>
  )

  if (status === 'error') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>❌</p>
        <h2 style={{ fontWeight: '700', marginBottom: '0.5rem' }}>Invalid Invite</h2>
        <p style={{ color: '#888', marginBottom: '1.5rem' }}>{message}</p>
        <button onClick={() => navigate('/groups')} style={btnStyle}>Browse Groups</button>
      </div>
    </div>
  )

  if (status === 'already') return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>✅</p>
        <h2 style={{ fontWeight: '700', marginBottom: '0.5rem' }}>{group?.name}</h2>
        <p style={{ color: '#a78bfa', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{group?.game}</p>
        <p style={{ color: '#888' }}>{message}</p>
        <button onClick={() => navigate(`/groups/${group?.id}`)} style={btnStyle}>Open Group</button>
      </div>
    </div>
  )

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎮</p>
        <h2 style={{ fontWeight: '700', marginBottom: '0.5rem' }}>You joined {group?.name}!</h2>
        <p style={{ color: '#a78bfa', fontSize: '0.9rem', marginBottom: '1rem' }}>{group?.game}</p>
        <p style={{ color: '#888' }}>You've been added to the group. Start chatting!</p>
        <button onClick={() => navigate(`/groups/${group?.id}`)} style={btnStyle}>Go to Group Chat</button>
      </div>
    </div>
  )
}
