import { supabase } from './supabaseClient'

// Point values per achievement — feel free to retune. Rarer ones (per
// AchievementsPage's rarity labels) are worth more.
const ACHIEVEMENT_POINTS = {
  first_connection: 10,
  five_connections: 25,
  first_group: 10,
  group_leader: 30,
  profile_complete: 15,
}

export const awardAchievement = async (userId, type) => {
  try {
    // Check first so we only add points on a genuinely new award — the
    // upsert alone can't tell us whether the row already existed.
    const { data: existing } = await supabase
      .from('achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('type', type)
      .maybeSingle()
    if (existing) return

    await supabase.from('achievements').upsert({ user_id: userId, type }, { onConflict: 'user_id,type' })

    const points = ACHIEVEMENT_POINTS[type] || 0
    if (points > 0) {
      const { data: profile } = await supabase.from('profiles').select('points').eq('id', userId).single()
      await supabase.from('profiles').update({ points: (profile?.points || 0) + points }).eq('id', userId)
    }
  } catch {
    // best-effort — don't block the caller if the award insert fails
  }
}

export const checkAndAwardAchievements = async (userId) => {
  const { data: connections } = await supabase
    .from('connections')
    .select('id')
    .eq('sender_id', userId)
    .eq('status', 'accepted')

  const count = connections?.length || 0
  if (count >= 1) await awardAchievement(userId, 'first_connection')
  if (count >= 5) await awardAchievement(userId, 'five_connections')

  const { data: groups } = await supabase
    .from('group_members')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'accepted')
  if (groups?.length >= 1) await awardAchievement(userId, 'first_group')

  const { data: led } = await supabase
    .from('groups')
    .select('id')
    .eq('leader_id', userId)
  if (led?.length >= 1) await awardAchievement(userId, 'group_leader')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, bio, avatar_url')
    .eq('id', userId)
    .single()
  if (profile?.username && profile?.bio && profile?.avatar_url)
    await awardAchievement(userId, 'profile_complete')
}