import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useRole } from '../hooks/useRole'

export default function AdminPanel({ theme }) {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  const { isAdmin, loading: roleLoading } = useRole(user)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null)
    })
  }, [])

  useEffect(() => {
    if (!user) return

    const load = async () => {
      const { data } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })

      setReports(data || [])
      setLoading(false)
    }

    load()
  }, [user])

  const dismiss = async (id) => {
    await supabase.from('reports').delete().eq('id', id)
    setReports(prev => prev.filter(r => r.id !== id))
  }

  if (loading || roleLoading) return null
  if (!isAdmin) return <Navigate to="/" />

  return (
    <div style={{ padding: 20 }}>
      <h1>Admin Panel</h1>

      {reports.map(r => (
        <div key={r.id}>
          <p>{r.reason}</p>
          <button onClick={() => dismiss(r.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  )
}