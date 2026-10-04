import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockInsert = vi.fn(() => Promise.resolve({ error: null }))
vi.mock('../lib/supabaseClient', () => ({
  supabase: { from: vi.fn(() => ({ insert: mockInsert })) },
}))

const { default: HobbyCard } = await import('./HobbyCard')

const baseProfile = {
  id: 'profile-1',
  username: 'ShadowStriker',
  hobbies: ['Valorant', 'Chess'],
}

function renderCard(props = {}) {
  return render(
    <MemoryRouter>
      <HobbyCard profile={baseProfile} currentUserId="me" connectionStatus={null} {...props} />
    </MemoryRouter>
  )
}

describe('HobbyCard', () => {
  it('renders the username, hobby tags, and a Connect button', () => {
    renderCard()
    expect(screen.getByText('ShadowStriker')).toBeInTheDocument()
    expect(screen.getByText('Valorant')).toBeInTheDocument()
    expect(screen.getByText('Chess')).toBeInTheDocument()
    expect(screen.getByText('+ Connect')).toBeInTheDocument()
  })

  it('shows "Pending" state without sending a request when already pending', () => {
    renderCard({ connectionStatus: 'pending' })
    expect(screen.getByText('⏳ Pending')).toBeInTheDocument()
    fireEvent.click(screen.getByText('⏳ Pending'))
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('shows "Connected" state when already accepted', () => {
    renderCard({ connectionStatus: 'accepted' })
    expect(screen.getByText('✓ Connected')).toBeInTheDocument()
  })

  it('sends a connection request and flips to Pending on click', async () => {
    renderCard()
    fireEvent.click(screen.getByText('+ Connect'))
    expect(mockInsert).toHaveBeenCalledWith({ sender_id: 'me', receiver_id: 'profile-1' })
    expect(await screen.findByText('⏳ Pending')).toBeInTheDocument()
  })
})
