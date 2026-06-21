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

export default function Groups() {
  const [groups, setGroups] = useState([])
  const [user, setUser] = useState(null)
  const [myMemberships, setMyMemberships] = useState({})
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupGame, setNewGroupGame] = useState('')
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      const { data: groupsData } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false })

      const { data: memberships } = await supabase
        .from('group_members')
        .select('*')
        .eq('user_id', user.id)

      const memberMap = {}
      memberships?.forEach(m => { memberMap[m.group_id] = m.status })
      setMyMemberships(memberMap)
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
      leader_id: user.id
    }).select().single()
    if (error) return alert(error.message)
    setGroups(prev => [data, ...prev])
    setShowCreate(false)
    setNewGroupName('')
    setNewGroupGame('')
    navigate(`/groups/${data.id}`)
  }

  const requestJoin = async (groupId) => {
    const { error } = await supabase.from('group_members').insert({
      group_id: groupId,
      user_id: user.id,
      status: 'pending'
    })
    if (error) return alert(error.message)
    setMyMemberships(prev => ({ ...prev, [groupId]: 'pending' }))
  }

  const filtered = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.game.toLowerCase().includes(search.toLowerCase())
  )

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
      background: isLeader ? 'rgba(245, 158, 11, 0.15)'
        : status === 'accepted' ? 'rgba(16,185,129,0.15)'
        : status === 'pending' ? 'rgba(255,255,255,0.05)'
        : 'linear-gradient(135deg, #6c63ff, #a78bfa)',
      color: isLeader ? '#f59e0b'
        : status === 'accepted' ? '#10b981'
        : status === 'pending' ? '#888'
        : 'white',
      border: isLeader ? '1px solid rgba(245,158,11,0.3)'
        : status ? '1px solid rgba(255,255,255,0.1)'
        : 'none',
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
      <p style={{ color: '#888' }}>Loading groups...</p>
    </div>
  )

  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>Game Groups</h2>
          <p style={{ color: '#888' }}>Join or create communities for your favorite games</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          style={{ padding: '0.75rem 1.5rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.95rem' }}
        >
          + Create Group
        </button>
      </div>

      {showCreate && (
        <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: '600' }}>Create a New Group</h3>
          <input
            type="text"
            placeholder="Group name (e.g. Fortnite Squads EU)"
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            style={{ padding: '0.75rem 1rem', width: '100%', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none', marginBottom: '1rem' }}
          />
          <select
            value={newGroupGame}
            onChange={e => setNewGroupGame(e.target.value)}
            style={{ padding: '0.75rem 1rem', width: '100%', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: '#1a1a2e', color: newGroupGame ? 'white' : '#888', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', outline: 'none', marginBottom: '1rem' }}
          >
            <option value="">Select a game...</option>
            {ALL_GAMES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={createGroup} style={{ flex: 1, padding: '0.75rem', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600' }}>
              Create Group
            </button>
            <button onClick={() => setShowCreate(false)} style={{ padding: '0.75rem 1.5rem', background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <input
        type="text"
        placeholder="Search by group name or game..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'white', fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', width: '100%', maxWidth: '400px', marginBottom: '2rem', outline: 'none' }}
      />

      {filtered.length === 0 ? (
        <p style={{ color: '#888' }}>No groups found. Create one!</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filtered.map(group => (
            <div key={group.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #6c63ff, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
                🎮
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{group.name}</p>
                <p style={{ color: '#a78bfa', fontSize: '0.85rem' }}>{group.game}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {(myMemberships[group.id] === 'accepted' || group.leader_id === user?.id) && (
                  <button
                    onClick={() => navigate(`/groups/${group.id}`)}
                    style={{ padding: '0.5rem 1.25rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: '600', fontSize: '0.85rem' }}
                  >
                    Open →
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!myMemberships[group.id] && group.leader_id !== user?.id) requestJoin(group.id)
                  }}
                  style={getButtonStyle(group)}
                >
                  {getButtonLabel(group)}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}