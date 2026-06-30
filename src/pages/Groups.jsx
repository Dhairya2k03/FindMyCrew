import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

const ALL_GAMES = [
  'CS2', 'Dota 2', 'Elden Ring', 'Baldurs Gate 3', 'Rust', 'Terraria', 'Stardew Valley', 'Deep Rock Galactic',
  'Fortnite', 'Rocket League', 'Fall Guys', 'Borderlands 3', 'GTA V', 'Among Us',
  'God of War', 'Spider-Man 2', 'The Last of Us', 'Gran Turismo 7', 'Ghost of Tsushima',
  'Halo Infinite', 'Forza Horizon 5', 'Gears 5', 'Sea of Thieves', 'Starfield',
  'Zelda Tears of the Kingdom', 'Mario Kart 8', 'Splatoon 3', 'Pokemon Scarlet', 'Super Smash Bros',
  'PUBG Mobile', 'Call of Duty Mobile', 'Clash Royale', 'Genshin Impact', 'Mobile Legends'
]

const CATEGORIES = [
  { id: 'casual', label: '😊 Casual', desc: 'Just for fun' },
  { id: 'competitive', label: '🏆 Competitive', desc: 'Ranked & serious' },
  { id: 'social', label: '💬 Social', desc: 'Hang out & chat' },
  { id: 'coaching', label: '📚 Coaching', desc: 'Learn & improve' },
]

export default function Groups({ theme }) {
  const isLight = theme === 'light'
  const textPrimary = isLight ? '#111' : 'white'
  const textMuted   = isLight ? '#555' : '#888'
  const cardBg      = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'
  const cardBorder  = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'
  const inputBg     = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)'
  const inputBorder = isLight ? 'rgba(0,0,0,0.1)'  : 'rgba(255,255,255,0.1)'
  const selectBg    = isLight ? '#f0f0f7'           : '#1a1a2e'

  const [groups, setGroups] = useState([])
  const [user, setUser] = useState(null)
  const [myMemberships, setMyMemberships] = useState({})
  const [membershipIds, setMembershipIds] = useState({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupGame, setNewGroupGame] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [newGroupMax, setNewGroupMax] = useState(20)
  const [newGroupCategory, setNewGroupCategory] = useState('casual')
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data: groupsData } = await supabase.from('groups').select('*').order('created_at', { ascending: false })
      const { data: memberships } = await supabase.from('group_members').select('*').eq('user_id', user.id)
      const memberMap = {}
      const idMap = {}
      memberships?.forEach(m => {
        memberMap[m.group_id] = m.status
        idMap[m.group_id] = m.id
      })
      setMyMemberships(memberMap)
      setMembershipIds(idMap)
      setGroups(groupsData || [])
      setLoading(false)
    }
    load()
  }, [])

  const createGroup = async () => {
    if (!newGroupName.trim() || !newGroupGame) return alert('Please fill in all fields')
    const { data, error } = await supabase.from('groups').insert({
      name: newGroupName.trim(),
      game: newGroupGame,
      description: newGroupDesc.trim(),
      max_members: newGroupMax,
      category: newGroupCategory,
      leader_id: user.id
    }).select().single()
    if (error) return alert(error.message)
    setGroups(prev => [data, ...prev])
    setShowCreate(false)
    setNewGroupName('')
    setNewGroupGame('')
    setNewGroupDesc('')
    setNewGroupMax(20)
    setNewGroupCategory('casual')
    navigate(`/groups/${data.id}`)
  }

  const requestJoin = async (groupId) => {
    const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: user.id, status: 'pending' })
    if (error) return alert(error.message)
    setMyMemberships(prev => ({ ...prev, [groupId]: 'pending' }))
  }

  const leaveGroup = async (groupId, e) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to leave this group?')) return
    const membershipId = membershipIds[groupId]
    if (!membershipId) return
    await supabase.from('group_members').delete().eq('id', membershipId)
    setMyMemberships(prev => { const n = { ...prev }; delete n[groupId]; return n })
    setMembershipIds(prev => { const n = { ...prev }; delete n[groupId]; return n })
  }

  const filtered = groups.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) || g.game.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !filterCategory || g.category === filterCategory
    return matchSearch && matchCategory
  })

  const getCategoryLabel = (cat) => CATEGORIES.find(c => c.id === cat)?.label || cat

  const getButtonLabel = (group) => {
    if (group.leader_id === user?.id) return '👑 Your Group'
    const status = myMemberships[group.id]
    if (status === 'accepted') return '✓ Joined'
    if (status === 'pending') return '⏳ Pending'
    return 'Request Join'
  }

  const getButtonStyle = (group) => {
    const isLeader = group.leader_id === user?.id
    const status = myMemberships[group.id]
    return {
      padding: '0.5rem 1.25rem',
      background: isLeader ? 'rgba(245,158,11,0.15)' : status === 'accepted' ? 'rgba(16,185,129,0.15)' : status === 'pending' ? inputBg : 'linear-gradient(135deg, #6c63ff, #a78bfa)',
      color: isLeader ? '#f59e0b' : status === 'accepted' ? '#10b981' : status === 'pending' ? textMuted : 'white',
      border: isLeader ? '1px solid rgba(245,158,11,0.3)' : status ? `1px solid ${inputBorder}` : 'none',
      borderRadius: '8px',
      cursor: (isLeader || status) ? 'default' : 'pointer',
      fontFamily: 'Inter, sans-serif',
      fontWeight: '600',
      fontSize: '0.85rem',
      whiteSpace: 'nowrap'
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 64px)' }}>
      <p style={{ color: textMuted }}>Loading groups...</p>
    </div>
  )

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem', color: textPrimary }}>Game Groups</h2>
          <p style={{ color: textMuted }}>Join or create communities for your favorite games</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.95rem' }}>
          + Create Group
        </button>
      </div>

      {showCreate && (
        <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: '600', color: textPrimary }}>Create a New Group</h3>
          <input type="text" placeholder="Group name (e.g. Fortnite Squads EU)" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} style={{ padding: '0.75rem 1rem', width: '100%', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none', marginBottom: '1rem', boxSizing: 'border-box' }} />
          <textarea placeholder="Description (optional) — what's this group about?" value={newGroupDesc} onChange={e => setNewGroupDesc(e.target.value)} rows={2} maxLength={200} style={{ padding: '0.75rem 1rem', width: '100%', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none', marginBottom: '1rem', resize: 'none', boxSizing: 'border-box' }} />
          <select value={newGroupGame} onChange={e => setNewGroupGame(e.target.value)} style={{ padding: '0.75rem 1rem', width: '100%', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: selectBg, color: newGroupGame ? textPrimary : textMuted, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none', marginBottom: '1rem' }}>
            <option value="">Select a game...</option>
            {ALL_GAMES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          <p style={{ color: textMuted, fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Category</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => setNewGroupCategory(cat.id)} style={{ padding: '0.5rem 1rem', background: newGroupCategory === cat.id ? 'rgba(108,99,255,0.2)' : inputBg, color: newGroupCategory === cat.id ? '#a78bfa' : textMuted, border: newGroupCategory === cat.id ? '1px solid rgba(108,99,255,0.4)' : `1px solid ${inputBorder}`, borderRadius: '100px', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'Inter, sans-serif' }}>
                {cat.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <label style={{ color: textMuted, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>Max Members:</label>
            <input type="number" min={2} max={100} value={newGroupMax} onChange={e => setNewGroupMax(Number(e.target.value))} style={{ padding: '0.5rem 0.75rem', width: '80px', borderRadius: '8px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none' }} />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={createGroup} style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>Create Group</button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: textMuted, border: `1px solid ${inputBorder}`, borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search by group name or game..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: inputBg, color: textPrimary, fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', flex: 1, minWidth: '200px', outline: 'none' }} />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: `1px solid ${inputBorder}`, background: selectBg, color: filterCategory ? textPrimary : textMuted, fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', outline: 'none' }}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: textMuted }}>No groups found.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map(group => {
            const isLeader = group.leader_id === user?.id
            const status = myMemberships[group.id]
            return (
              <div key={group.id} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '16px', padding: '1.25rem 1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
                    🎮
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <p style={{ fontWeight: '600', color: textPrimary }}>{group.name}</p>
                      {group.category && (
                        <span style={{ fontSize: '0.7rem', color: '#a78bfa', background: 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '100px', padding: '1px 7px' }}>
                          {getCategoryLabel(group.category)}
                        </span>
                      )}
                    </div>
                    <p style={{ color: '#a78bfa', fontSize: '0.85rem' }}>{group.game}</p>
                    {group.description && <p style={{ color: textMuted, fontSize: '0.8rem', marginTop: '0.25rem' }}>{group.description}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {group.max_members && (
                      <span style={{ fontSize: '0.75rem', color: textMuted }}>👥 {group.max_members}</span>
                    )}
                    {(status === 'accepted' || isLeader) && (
                      <button onClick={() => navigate(`/groups/${group.id}`)} style={{ padding: '0.5rem 1.25rem', background: inputBg, color: textPrimary, border: `1px solid ${inputBorder}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem' }}>
                        Open →
                      </button>
                    )}
                    {/* Leave button — only for accepted non-leaders */}
                    {status === 'accepted' && !isLeader && (
                      <button
                        onClick={(e) => leaveGroup(group.id, e)}
                        style={{ padding: '0.5rem 0.9rem', background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem' }}
                      >
                        Leave
                      </button>
                    )}
                    <button onClick={() => { if (!myMemberships[group.id] && !isLeader) requestJoin(group.id) }} style={getButtonStyle(group)}>
                      {getButtonLabel(group)}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}