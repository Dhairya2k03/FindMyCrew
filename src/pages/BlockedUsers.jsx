import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function BlockedUsers({ theme }) {
  const [blocked, setBlocked] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const isLight = theme === 'light'
  const textColor = isLight ? '#111' : 'white'
  const mutedColor = isLight ? '#555' : '#888'
  const cardBg = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'
  const border = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: blocks } = await supabase.from('blocked_users').select('*').eq('blocker_id', user.id)
      const ids = blocks?.map(b => b.blocked_id) || []
      if (ids.length === 0) { setLoading(false); return }
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids)
      const map = {}
      profiles?.forEach(p => { map[p.id] = p })
      setBlocked(blocks.map(b => ({ ...b, profile: map[b.blocked_id] })))
      setLoading(false)
    }
    load()
  }, [])

  const unblock = async (blockId, blockedId) => {
    setBlocked(prev => prev.filter(b => b.id !== blockId))
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('blocked_users').delete().eq('blocker_id', user.id).eq('blocked_id', blockedId)
  }

  if (loading) return <p style={{ padding: '2rem', color: mutedColor }}>Loading...</p>

  return (
    <div style={{ maxWidth: '650px', margin: '0 auto', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem', color: textColor }}>Blocked Users</h2>
      <p style={{ color: mutedColor, marginBottom: '2rem' }}>People you've blocked can't message you or see your profile.</p>

      {blocked.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: mutedColor }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🚫</p>
          <p>You haven't blocked anyone.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {blocked.map(b => (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', background: cardBg, border: `1px solid ${border}`, borderRadius: '14px' }}>
              <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/user/${b.blocked_id}`)}>
                <p style={{ fontWeight: '600', color: textColor, margin: 0 }}>
                  {b.profile?.username || b.profile?.email?.split('@')[0] || 'Unknown user'}
                </p>
              </div>
              <button
                onClick={() => unblock(b.id, b.blocked_id)}
                style={{ padding: '0.5rem 1rem', background: 'rgba(108,99,255,0.1)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem' }}
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}