import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase client before importing the module under test, so
// updateLoginStreak never tries to hit a real database.
const mockSingle = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))

vi.mock('./supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) })),
      update: mockUpdate,
    })),
  },
}))

const { updateLoginStreak } = await import('./streak')

const toLocalDateStr = (d) => {
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().split('T')[0]
}

describe('updateLoginStreak', () => {
  beforeEach(() => {
    mockSingle.mockReset()
    mockUpdate.mockClear()
  })

  it('does not change the streak if already logged in today', async () => {
    const today = toLocalDateStr(new Date())
    mockSingle.mockResolvedValue({
      data: { login_streak: 5, longest_streak: 9, last_login_date: today },
    })

    const result = await updateLoginStreak('user-1')

    expect(result).toEqual({ streak: 5, longestStreak: 9, isNewToday: false })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('increments the streak when the last login was yesterday', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    mockSingle.mockResolvedValue({
      data: { login_streak: 5, longest_streak: 9, last_login_date: toLocalDateStr(yesterday) },
    })

    const result = await updateLoginStreak('user-1')

    expect(result).toEqual({ streak: 6, longestStreak: 9, isNewToday: true })
  })

  it('resets the streak to 1 when a day was missed', async () => {
    const longAgo = new Date()
    longAgo.setDate(longAgo.getDate() - 5)
    mockSingle.mockResolvedValue({
      data: { login_streak: 5, longest_streak: 9, last_login_date: toLocalDateStr(longAgo) },
    })

    const result = await updateLoginStreak('user-1')

    expect(result).toEqual({ streak: 1, longestStreak: 9, isNewToday: true })
  })

  it('raises longestStreak when a new streak beats the record', async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    mockSingle.mockResolvedValue({
      data: { login_streak: 9, longest_streak: 9, last_login_date: toLocalDateStr(yesterday) },
    })

    const result = await updateLoginStreak('user-1')

    expect(result.longestStreak).toBe(10)
  })

  it('returns null when the profile cannot be found', async () => {
    mockSingle.mockResolvedValue({ data: null })

    const result = await updateLoginStreak('missing-user')

    expect(result).toBeNull()
  })
})
