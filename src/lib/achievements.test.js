import { describe, it, expect, vi, beforeEach } from 'vitest'

// Chainable builder so supabase.from('x').upsert(...).select('id') and
// supabase.from('x').select(...).eq(...).single() both work from one mock.
function makeBuilder(result = { data: null, error: null }) {
  const builder = {
    upsert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => Promise.resolve(result).then(resolve),
  }
  return builder
}

const mockFrom = vi.fn()
vi.mock('./supabaseClient', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
}))

const { awardAchievement, checkAndAwardAchievements } = await import('./achievements')

describe('awardAchievement', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('awards points when the achievement is newly inserted', async () => {
    const achievementsBuilder = makeBuilder({ data: [{ id: 'row-1' }], error: null })
    const profilesSelectBuilder = makeBuilder({ data: { points: 20 }, error: null })
    const profilesUpdateBuilder = makeBuilder({ data: null, error: null })

    mockFrom.mockImplementation((table) => {
      if (table === 'achievements') return achievementsBuilder
      // first profiles call reads points, second one writes them
      return mockFrom.mock.calls.filter(c => c[0] === 'profiles').length <= 1
        ? profilesSelectBuilder
        : profilesUpdateBuilder
    })

    await awardAchievement('user-1', 'first_connection')

    expect(achievementsBuilder.upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', type: 'first_connection' },
      { onConflict: 'user_id,type', ignoreDuplicates: true }
    )
    expect(profilesUpdateBuilder.update).toHaveBeenCalledWith({ points: 30 }) // 20 + 10
  })

  it('does nothing further when the achievement already exists (no row returned)', async () => {
    const achievementsBuilder = makeBuilder({ data: [], error: null })
    mockFrom.mockImplementation((table) => {
      if (table === 'achievements') return achievementsBuilder
      throw new Error(`unexpected table ${table}`)
    })

    await awardAchievement('user-1', 'first_connection')

    // Only the achievements table should ever have been touched —
    // no profiles read/write means no double-award of points.
    expect(mockFrom).toHaveBeenCalledTimes(1)
    expect(mockFrom).toHaveBeenCalledWith('achievements')
  })

  it('swallows errors instead of throwing', async () => {
    const achievementsBuilder = makeBuilder({ data: null, error: new Error('boom') })
    mockFrom.mockImplementation(() => achievementsBuilder)

    await expect(awardAchievement('user-1', 'first_connection')).resolves.toBeUndefined()
  })
})

describe('checkAndAwardAchievements', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('awards first_connection and profile_complete when thresholds are met', async () => {
    const awarded = []
    mockFrom.mockImplementation((table) => {
      if (table === 'connections') return makeBuilder({ data: [{ id: 'c1' }], error: null })
      if (table === 'group_members') return makeBuilder({ data: [], error: null })
      if (table === 'groups') return makeBuilder({ data: [], error: null })
      if (table === 'profiles') {
        return makeBuilder({
          data: { username: 'Foo', bio: 'Hi', avatar_url: 'http://x' },
          error: null,
        })
      }
      if (table === 'achievements') {
        const b = makeBuilder({ data: [{ id: 'row' }], error: null })
        const origUpsert = b.upsert
        b.upsert = vi.fn((payload, opts) => { awarded.push(payload.type); return origUpsert(payload, opts) })
        return b
      }
      throw new Error(`unexpected table ${table}`)
    })

    await checkAndAwardAchievements('user-1')

    expect(awarded).toContain('first_connection')
    expect(awarded).toContain('profile_complete')
    expect(awarded).not.toContain('five_connections') // only 1 connection, threshold is 5
  })
})
