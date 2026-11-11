import { act, render, screen } from '@testing-library/react'
import { AuthLandingClient } from '@/app/components/auth/AuthLandingClient'

const getUser = jest.fn()
const signOut = jest.fn()
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser, signOut } }),
}))
jest.mock('@/app/components/auth/auth-form', () => ({
  AuthForm: () => <form aria-label="Sign in" />,
}))
jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }))
jest.mock('@/app/context/LocalizationContext', () => ({
  useLocalization: () => ({ t: () => '' }),
}))
jest.mock('@/app/hooks/use-safari-detection', () => ({ useSafariDetection: () => false }))

describe('auth landing session recovery', () => {
  const originalLocation = window.location
  const replace = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://app.makinari.com/auth', hostname: 'app.makinari.com', replace },
    })
    localStorage.clear()
    signOut.mockResolvedValue({ error: null })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    jest.restoreAllMocks()
  })

  it('renders sign in even when the session check never settles', async () => {
    getUser.mockReturnValue(new Promise(() => {}))
    render(<AuthLandingClient />)
    expect(await screen.findByRole('form', { name: 'Sign in' })).toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('preserves the session on a transient lookup failure', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } })
    await act(async () => { render(<AuthLandingClient />) })
    expect(screen.getByRole('form', { name: 'Sign in' })).toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('preserves the session when the SDK throws', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    getUser.mockRejectedValue(new Error('Session lock unavailable'))
    await act(async () => { render(<AuthLandingClient />) })
    expect(screen.getByRole('form', { name: 'Sign in' })).toBeInTheDocument()
    expect(signOut).not.toHaveBeenCalled()
  })

  it('redirects a verified user to the workspace', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null })
    await act(async () => { render(<AuthLandingClient />) })
    expect(replace).toHaveBeenCalledWith('/projects')
  })

  it('ignores a session check that finishes after unmount', async () => {
    let resolve!: (value: unknown) => void
    getUser.mockReturnValue(new Promise((done) => { resolve = done }))
    const view = render(<AuthLandingClient />)
    view.unmount()
    await act(async () => { resolve({ data: { user: { id: 'user-a' } }, error: null }) })
    expect(replace).not.toHaveBeenCalled()
  })
})