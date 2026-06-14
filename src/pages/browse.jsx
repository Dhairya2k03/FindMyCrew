import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import HobbyCard from '../components/HobbyCard'

export default function Browse() {
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      const { data: me } = await supabase
        .from('profiles')
        .select('hobbies')
        .eq('id', user.id)
        .single()

      const { data: others } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)

      // Sort by hobby overlap
      const sorted = (others || []).sort((a, b) => {
        const overlapA = (a.hobbies || []).filter(h => (me?.hobbies || []).includes(h)).length
        const overlapB = (b.hobbies || []).filter(h => (me?.hobbies || []).includes(h)).length
        return overlapB - overlapA
      })

      setProfiles(sorted)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p style={{ padding: '2rem' }}>Loading players...</p>

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Find Players 🎮</h2>
      {profiles.length === 0 ? (
        <p style={{ color: '#555' }}>No other players yet — invite some friends!</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {profiles.map(p => <HobbyCard key={p.id} profile={p} />)}
        </div>
      )}
    </div>
  )
}