import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const TYPE_ICONS = {
  message: '💬',
  connection: '🤝',
  connection_accepted: '✅',
  group_invite: '🎮',
  group_join: '👥',
  lfg_accepted: '✅',
  lfg_group_created: '🎮',
  report: '🚨',
}

const getLink = (notif) => {
  const content = notif.content || ''
  const type = notif.type || ''

  if (notif.link) return notif.link
  if (type === 'message') return '/messages'
  if (type === 'connection') return '/connections'
  if (type === 'connection_accepted') return '/connections'
  if (type === 'lfg_accepted') return '/lfg'
  if (type === 'lfg_group_created') return '/lfg'
  if (type === 'report') return '/admin'
  if (type === 'group_join' || type === 'group_invite') return '/groups'

  // Try to extract group id from content
  const groupMatch = content.match(/group[^a-z]/i)
  if (groupMatch) return '/groups'

  return null
}

export default function Notifications({ theme }) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const navigate = useNavigate()

  const isLight = theme === 'light'
  const bg = isLight ? '#f0f0f7' : '#0f0f1a'
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const textColor = isLight ? '#111' : 'white'
  const mutedColor = isLight ? '#555' : '#888'
  const cardBg = isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.03)'
  const unreadBg = isLight ? 'rgba(108,99,255,0.06)' : 'rgba(108,99,255,0.08)'

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
      await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    }
    load()

    const channel = supabase.channel('notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        setNotifications(prev => [payload.new, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).eq('user_id', currentUser.id)
  }

  const deleteNotif = async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
    await supabase.from('notifications').delete().eq('id', id)
  }

  const handleClick = (notif) => {
    const link = getLink(notif)
    if (link) navigate(link)
  }

  const formatTime = (date) => {
    const d = new Date(date)
    const diff = new Date() - d
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
    return d.toLocaleDateString()
  }

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: bg, padding: '1.5rem' }}>
      <div style={{ maxWidth: '650px', margin: '0 auto' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', margin: 0, color: textColor }}>Notifications</h2>
            {unreadCount > 0 && <p style={{ color: '#a78bfa', fontSize: '0.9rem', margin: '0.2rem 0 0' }}>{unreadCount} unread</p>}
          </div>
          {notifications.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ padding: '0.5rem 1rem', background: 'rgba(108,99,255,0.1)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' }}>
                  Mark all read
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[1,2,3].map(i => <div key={i} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: '12px', height: '72px', animation: 'pulse 1.5s infinite' }} />)}
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: mutedColor }}>
            <p style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔔</p>
            <p style={{ fontSize: '1rem', color: textColor, fontWeight: '600', marginBottom: '0.5rem' }}>No notifications yet</p>
            <p>You'll see activity from connections, groups, and messages here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {notifications.map(notif => {
              const link = getLink(notif)
              const isClickable = !!link
              return (
                <div
                  key={notif.id}
                  onClick={() => handleClick(notif)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1rem',
                    padding: '1rem 1.25rem',
                    background: !notif.read ? unreadBg : cardBg,
                    border: !notif.read ? '1px solid rgba(108,99,255,0.2)' : `1px solid ${border}`,
                    borderRadius: '12px',
                    cursor: isClickable ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                    position: 'relative'
                  }}
                  onMouseEnter={e => { if (isClickable) e.currentTarget.style.border = '1px solid rgba(108,99,255,0.4)' }}
                  onMouseLeave={e => { e.currentTarget.style.border = !notif.read ? '1px solid rgba(108,99,255,0.2)' : `1px solid ${border}` }}
                >
                  <span style={{ fontSize: '1.4rem', flexShrink: 0, marginTop: '0.1rem' }}>
                    {TYPE_ICONS[notif.type] || '🔔'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.92rem', color: textColor, lineHeight: 1.5, margin: 0, marginBottom: '0.2rem' }}>
                      {notif.content}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <p style={{ fontSize: '0.75rem', color: mutedColor, margin: 0 }}>{formatTime(notif.created_at)}</p>
                      {isClickable && <span style={{ fontSize: '0.72rem', color: '#a78bfa' }}>Tap to view →</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    {!notif.read && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6c63ff', flexShrink: 0 }} />
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); deleteNotif(notif.id) }}
                      style={{ background: 'none', border: 'none', color: mutedColor, cursor: 'pointer', fontSize: '0.85rem', padding: '0.2rem', opacity: 0.6 }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  )
}