import { supabase } from './supabaseClient'

// Returns today's date as YYYY-MM-DD in the user's local timezone.
const todayStr = () => {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().split('T')[0]
}

const yesterdayStr = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const offset = d.getTimezoneOffset()
  const local = new Date(d.getTime() - offset * 60000)
  return local.toISOString().split('T')[0]
}

// Call once per session after auth resolves. Updates the streak in the DB
// and returns the current state so the UI can show it immediately.
// isNewToday tells the caller whether this call actually advanced the
// streak (so a "streak!" toast/animation only fires once per day).
export const updateLoginStreak = async (userId) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('login_streak, longest_streak, last_login_date')
    .eq('id', userId)
    .single()

  if (!profile) return null

  const today = todayStr()
  const yesterday = yesterdayStr()
  const lastLogin = profile.last_login_date

  // Already logged in today — no change, just report current state.
  if (lastLogin === today) {
    return {
      streak: profile.login_streak || 0,
      longestStreak: profile.longest_streak || 0,
      isNewToday: false,
    }
  }

  const continuedStreak = lastLogin === yesterday
  const newStreak = continuedStreak ? (profile.login_streak || 0) + 1 : 1
  const newLongest = Math.max(newStreak, profile.longest_streak || 0)

  await supabase
    .from('profiles')
    .update({
      login_streak: newStreak,
      longest_streak: newLongest,
      last_login_date: today,
    })
    .eq('id', userId)

  return {
    streak: newStreak,
    longestStreak: newLongest,
    isNewToday: true,
  }
}