import { supabase } from './supabaseClient'

export const awardAchievement = async (userId, type) => {
  try {
    await supabase
      .from('achievements')
      .upsert({ user_id: userId, type }, { onConflict: 'user_id,type' })
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
