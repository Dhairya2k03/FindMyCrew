import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const TYPE_ICONS = {
  message: '💬',
  connection: '🤝',
  connection_accepted: '✅',
  group_invite: '🎮',
  group_join: '👥',
}

export default function Notifications() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setNotifications(data || [])
      setLoading(false)

      // Mark all as read
      supabase.from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
        .then(() => {})
    }
    load()

    const channel = supabase.channel('notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        setNotifications(prev => [payload.new, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const formatTime = (date) => {
    const d = new Date(date)
    const diff = new Date() - d
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return d.toLocaleDateString()
  }

  const handleClick = (notif) => {
    if (notif.link) navigate(notif.link)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
      <p style={{ color: '#888' }}>Loading notifications...</p>
    </div>
  )

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>Notifications</h2>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Your recent activity</p>

      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔔</p>
          <p style={{ color: '#888' }}>No notifications yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => handleClick(notif)}
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: notif.read ? 'rgba(255,255,255,0.02)' : 'rgba(108,99,255,0.08)', border: notif.read ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(108,99,255,0.2)', borderRadius: '14px', cursor: notif.link ? 'pointer' : 'default', transition: 'all 0.2s' }}
            >
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(108,99,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                {TYPE_ICONS[notif.type] || '🔔'}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.95rem', fontWeight: notif.read ? '400' : '600', marginBottom: '0.2rem' }}>{notif.message}</p>
                <p style={{ fontSize: '0.75rem', color: '#666' }}>{formatTime(notif.created_at)}</p>
              </div>
              {!notif.read && (
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6c63ff', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}