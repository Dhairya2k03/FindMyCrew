import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useRole(user) {
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setRole(null)
      setLoading(false)
      return
    }

    const fetchRole = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      setRole(data?.role || 'user')
      setLoading(false)
    }

    fetchRole()
  }, [user])

  return {
    role,
    loading,
    isAdmin: role === 'admin'
  }
}