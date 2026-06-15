import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const GAMING_OPTIONS = ['FPS', 'RPG', 'Strategy', 'Sports', 'MMO', 'Indie', 'Horror', 'Battle Royale']

export default function Profile() {
  const [user, setUser] = useState(null)
  const [selected, setSelected] = useState([])
  const [username, setUsername] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setSelected(data.hobbies || [])
        setUsername(data.username || '')
      }
    }
    load()
  }, [])

  const toggle = (tag) => {
    setSelected(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])
  }

  const saveProfile = async () => {
    if (!user) return alert('Not logged in')
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      username,
      hobbies: selected,
      updated_at: new Date()
    })
    if (error) alert(error.message)
    else setSaved(true)
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Your Profile</h2>
      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Username</label>
      <input
        type="text"
        placeholder="e.g. xXGamer42Xx"
        value={username}
        onChange={e => setUsername(e.target.value)}
        style={{ padding: '0.75rem', width: '100%', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '1.5rem', fontSize: '1rem' }}
      />
      <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold' }}>Gaming Interests</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {GAMING_OPTIONS.map(tag => (
          <button
            key={tag}
            onClick={() => toggle(tag)}
            style={{ padding: '0.5rem 1rem', background: selected.includes(tag) ? '#6c63ff' : '#eee', color: selected.includes(tag) ? 'white' : '#333', border: 'none', borderRadius: '20px', cursor: 'pointer' }}
          >
            {tag}
          </button>
        ))}
      </div>
      <button
        onClick={saveProfile}
        style={{ padding: '0.75rem 2rem', background: '#6c63ff', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}
      >
        Save Profile
      </button>
      {saved && <p style={{ color: 'green', marginTop: '0.75rem' }}>Profile saved!</p>}
    </div>
  )
}