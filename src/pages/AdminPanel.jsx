import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { ADMIN_EMAIL } from '../lib/constants'

export default function AdminPanel({ theme }) {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [reports, setReports] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [dismissing, setDismissing] = useState(null)
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const isLight = theme === 'light'
  const bg          = isLight ? '#f0f0f7'              : '#0f0f1a'
  const cardBg      = isLight ? 'rgba(0,0,0,0.03)'     : 'rgba(255,255,255,0.03)'
  const cardBorder  = isLight ? 'rgba(0,0,0,0.08)'     : 'rgba(255,255,255,0.08)'
  const textPrimary = isLight ? '#111'                  : 'white'
  const textMuted   = isLight ? '#555'                  : '#888'
  const inputBg     = isLight ? 'rgba(0,0,0,0.04)'     : 'rgba(255,255,255,0.05)'
  const inputBorder = isLight ? 'rgba(0,0,0,0.1)'      : 'rgba(255,255,255,0.1)'

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      if (user?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) { navigate('/'); return }

      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })

      setReports(reportsData || [])

      const userIds = new Set()
      reportsData?.forEach(r => {
        if (r.reporter_id) userIds.add(r.reporter_id)
        if (r.reported_user_id) userIds.add(r.reported_user_id)
      })
      if (userIds.size > 0) {
        const { data: profilesData } = await supabase.from('profiles').select('*').in('id', [...userIds])
        const map = {}
        profilesData?.forEach(p => { map[p.id] = p })
        setProfiles(map)
      }

      setLoading(false)
      loadStats()
    }
    load()
  }, [])

  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const { count: totalUsers } = await supabase.from('profiles').select('id', { count: 'exact', head: true })
      const { count: totalPosts } = await supabase.from('posts').select('id', { count: 'exact', head: true })
      const { count: totalGroups } = await supabase.from('groups').select('id', { count: 'exact', head: true })
      const { count: totalLfgPosts } = await supabase.from('lfg_posts').select('id', { count: 'exact', head: true })
      const { count: openLfgPosts } = await supabase.from('lfg_posts').select('id', { count: 'exact', head: true }).eq('status', 'open')
      const { count: totalConnections } = await supabase.from('connections').select('id', { count: 'exact', head: true }).eq('status', 'accepted')
      const { count: totalMessages } = await supabase.from('messages').select('id', { count: 'exact', head: true })

      const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

      const { count: signups7d } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo)
      const { count: signups30d } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo)
      const { count: posts7d } = await supabase.from('posts').select('id', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo)

      setStats({
        totalUsers: totalUsers || 0,
        totalPosts: totalPosts || 0,
        totalGroups: totalGroups || 0,
        totalLfgPosts: totalLfgPosts || 0,
        openLfgPosts: openLfgPosts || 0,
        totalConnections: totalConnections || 0,
        totalMessages: totalMessages || 0,
        signups7d: signups7d || 0,
        signups30d: signups30d || 0,
        posts7d: posts7d || 0,
      })
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
    setStatsLoading(false)
  }

  const getName = (id) => {
    const p = profiles[id]
    return p?.username || p?.email?.split('@')[0] || id?.slice(0, 8) + '...'
  }

  const dismissReport = async (reportId) => {
    setDismissing(reportId)
    await supabase.from('reports').delete().eq('id', reportId)
    setReports(prev => prev.filter(r => r.id !== reportId))
    setDismissing(null)
  }

  const filtered = reports.filter(r => filter === 'all' ? true : r.context_type === filter)

  const formatDate = (d) => new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)', background: bg }}>
      <p style={{ color: textMuted }}>Loading...</p>
    </div>
  )

  if (currentUser?.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return null

  const STAT_CARDS = stats ? [
    { label: 'Total Users', value: stats.totalUsers, icon: '👤', color: '#6c63ff', sub: `+${stats.signups7d} this week` },
    { label: 'Total Posts', value: stats.totalPosts, icon: '📝', color: '#10b981', sub: `+${stats.posts7d} this week` },
    { label: 'Groups', value: stats.totalGroups, icon: '👥', color: '#f59e0b' },
    { label: 'LFG Posts', value: stats.totalLfgPosts, icon: '🎯', color: '#ec4899', sub: `${stats.openLfgPosts} open` },
    { label: 'Connections', value: stats.totalConnections, icon: '🤝', color: '#3b82f6' },
    { label: 'Messages Sent', value: stats.totalMessages, icon: '💬', color: '#8b5cf6' },
  ] : []

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', background: bg, padding: '2rem' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🛡️</span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: textPrimary, margin: 0 }}>Admin Panel</h1>
          </div>
          <p style={{ color: textMuted }}>Platform overview and report moderation</p>
        </div>

        {/* Growth summary strip */}
        {stats && (
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: '700' }}>📈 {stats.signups7d} new users (7d)</span>
            </div>
            <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.25)', borderRadius: '10px', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#a78bfa', fontWeight: '700' }}>📈 {stats.signups30d} new users (30d)</span>
            </div>
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {statsLoading ? (
            [1,2,3,4,5,6].map(i => (
              <div key={i} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '14px', padding: '1.25rem', height: '90px', animation: 'pulse 1.5s infinite' }} />
            ))
          ) : (
            STAT_CARDS.map(stat => (
              <div key={stat.label} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '14px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>{stat.icon}</span>
                </div>
                <p style={{ fontSize: '1.8rem', fontWeight: '800', color: stat.color, margin: 0, lineHeight: 1 }}>{stat.value.toLocaleString()}</p>
                <p style={{ color: textMuted, fontSize: '0.8rem', marginTop: '0.35rem' }}>{stat.label}</p>
                {stat.sub && <p style={{ color: stat.color, fontSize: '0.7rem', marginTop: '0.15rem', fontWeight: '600' }}>{stat.sub}</p>}
              </div>
            ))
          )}
        </div>

        {/* Existing report stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Reports', value: reports.length, color: '#6c63ff' },
            { label: 'Profile Reports', value: reports.filter(r => r.context_type === 'profile').length, color: '#f59e0b' },
            { label: 'Message Reports', value: reports.filter(r => r.context_type === 'group_message').length, color: '#ef4444' },
          ].map(stat => (
            <div key={stat.label} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '14px', padding: '1.25rem' }}>
              <p style={{ fontSize: '2rem', fontWeight: '800', color: stat.color, margin: 0, lineHeight: 1 }}>{stat.value}</p>
              <p style={{ color: textMuted, fontSize: '0.85rem', marginTop: '0.4rem' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'profile', label: 'Profile Reports' },
            { id: 'group_message', label: 'Message Reports' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                padding: '0.5rem 1.1rem',
                background: filter === tab.id ? 'rgba(108,99,255,0.2)' : inputBg,
                color: filter === tab.id ? '#a78bfa' : textMuted,
                border: filter === tab.id ? '1px solid rgba(108,99,255,0.4)' : `1px solid ${inputBorder}`,
                borderRadius: '100px',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontWeight: filter === tab.id ? '600' : '400',
                fontSize: '0.85rem',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: textMuted }}>
            <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</p>
            <p style={{ fontWeight: '600', fontSize: '1rem' }}>No reports to review</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>All clear!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filtered.map(report => (
              <div key={report.id} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '16px', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: report.context_type === 'profile' ? '#f59e0b' : '#ef4444',
                        background: report.context_type === 'profile' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${report.context_type === 'profile' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        borderRadius: '100px',
                        padding: '2px 8px',
                      }}>
                        {report.context_type === 'profile' ? '👤 Profile' : '💬 Message'}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: textMuted }}>{formatDate(report.created_at)}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.85rem', color: textMuted }}>Reported by</span>
                      <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#a78bfa' }}>{getName(report.reporter_id)}</span>
                      <span style={{ fontSize: '0.85rem', color: textMuted }}>→</span>
                      <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#ef4444' }}>{getName(report.reported_user_id)}</span>
                    </div>

                    <div style={{ background: isLight ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '10px', padding: '0.65rem 0.9rem', marginBottom: report.message_content ? '0.6rem' : 0 }}>
                      <p style={{ fontSize: '0.8rem', color: textMuted, marginBottom: '0.2rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reason</p>
                      <p style={{ fontSize: '0.9rem', color: textPrimary, margin: 0 }}>{report.reason}</p>
                    </div>

                    {report.message_content && (
                      <div style={{ background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: '10px', padding: '0.65rem 0.9rem', marginTop: '0.6rem' }}>
                        <p style={{ fontSize: '0.8rem', color: textMuted, marginBottom: '0.2rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reported Message</p>
                        <p style={{ fontSize: '0.9rem', color: textPrimary, margin: 0, fontStyle: 'italic' }}>"{report.message_content}"</p>
                      </div>
                    )}

                    {report.context_type === 'group_message' && report.context_id && (
                      <p style={{ fontSize: '0.78rem', color: textMuted, marginTop: '0.5rem' }}>
                        Group ID: <span style={{ fontFamily: 'monospace', color: '#a78bfa' }}>{report.context_id}</span>
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
                    <button
                      onClick={() => navigate(`/user/${report.reported_user_id}`)}
                      style={{ padding: '0.5rem 1rem', background: 'rgba(108,99,255,0.15)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    >
                      View Profile
                    </button>
                    {report.context_type === 'group_message' && (
                      <button
                        onClick={() => navigate(`/groups/${report.context_id}`)}
                        style={{ padding: '0.5rem 1rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                      >
                        View Group
                      </button>
                    )}
                    <button
                      onClick={() => dismissReport(report.id)}
                      disabled={dismissing === report.id}
                      style={{ padding: '0.5rem 1rem', background: 'transparent', color: textMuted, border: `1px solid ${inputBorder}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '0.8rem', opacity: dismissing === report.id ? 0.5 : 1 }}
                    >
                      {dismissing === report.id ? 'Dismissing...' : '✓ Dismiss'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
    </div>
  )
}