import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { SimpleMessagesView } from '@/app/components/simple-messages-view'
import { useSimpleMessagesView } from '@/app/components/simple-messages-view/use-simple-messages-view'

const mockToast = jest.fn()
const mockDatabaseRequest = jest.fn(() => { throw new Error('Unexpected database request without an instance') })
const mockSite = { currentSite: { id: 'smoke-site' } }
const mockRouter = { push: jest.fn(), replace: jest.fn() }
const mockSearchParams = new URLSearchParams()
const mockRefreshRobots = jest.fn()

// Keep the view, model, composer, and instance/state hooks real. Only host/service boundaries are replaced.
jest.mock('@/app/context/ThemeContext', () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => mockSite }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/RobotsContext', () => ({ useRobots: () => ({ refreshRobots: mockRefreshRobots }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock('@/app/context/ScreenAccessContext', () => ({ useOptionalScreenAccess: () => null }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'smoke-user' } }) }))
jest.mock('@/app/components/ui/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }))
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter, useSearchParams: () => mockSearchParams, usePathname: () => '/robots',
}))
jest.mock('@/app/services/user-service', () => ({
  getUserData: jest.fn().mockResolvedValue({ name: 'Smoke User', avatar_url: null }),
}))
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ from: () => mockDatabaseRequest(), channel: () => mockDatabaseRequest() }),
}))
jest.mock('@/app/records/response-record-actions', () => ({
  syncAiFeedbackRecord: jest.fn(), createResponseRecord: jest.fn(),
  getResponseRecordCategories: jest.fn().mockResolvedValue({ categories: [] }),
}))
jest.mock('react-markdown', () => ({
  __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
jest.mock('remark-gfm', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('remark-breaks', () => ({ __esModule: true, default: jest.fn() }))

it('mounts the real empty-instance model and composer without starting instance requests or reporting errors', async () => {
  const originalResizeObserver = globalThis.ResizeObserver
  const errors = jest.spyOn(console, 'error')
  const fetchMock = jest.mocked(fetch)
  fetchMock.mockReset()
  fetchMock.mockImplementation(async input => {
    if (input !== '/api/skills?site_id=smoke-site') throw new Error(`Unexpected request: ${String(input)}`)
    return { ok: true, json: async () => ({ skills: [] }) } as Response
  })
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.localStorage.clear()
  jest.clearAllMocks()

  try {
    expect(jest.isMockFunction(useSimpleMessagesView)).toBe(false)
    const { unmount } = render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <SimpleMessagesView />
      </SWRConfig>,
    )
    await act(async () => {})
    const composer = screen.getByRole('textbox')
    expect(composer).toBeEnabled()
    expect(composer).toHaveValue('')
    expect(composer).toHaveAttribute('placeholder', 'Analyze our product-market fit...')
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    fireEvent.change(composer, { target: { value: 'Draft without starting an agent' } })
    expect(composer).toHaveValue('Draft without starting an agent')
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    await waitFor(() => expect(window.localStorage.getItem('input-cache-chat-new')).toContain('Draft without starting an agent'))

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/skills?site_id=smoke-site'])
    expect(mockDatabaseRequest).not.toHaveBeenCalled()
    expect(mockToast).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
    unmount()
  } finally {
    errors.mockRestore()
    globalThis.ResizeObserver = originalResizeObserver
    window.localStorage.clear()
  }
})