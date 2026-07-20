// src/lib/useOnlineUsers.js
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Shares the same 'global-presence' topic Chat.jsx already tracks into,
// so any page that mounts this sees the same live online set.
export function useOnlineUsers(currentUserId) {
  const [onlineIds, setOnlineIds] = useState(new Set())

  useEffect(() => {
    if (!currentUserId) return
    const channel = supabase.channel('global-presence', { config: { presence: { key: currentUserId } } })
    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineIds(new Set(Object.keys(channel.presenceState())))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() })
      })
    return () => supabase.removeChannel(channel)
  }, [currentUserId])

  return onlineIds
}