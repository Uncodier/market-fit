import { act, fireEvent, render, screen } from '@testing-library/react'
import RepositoriesPage from '@/app/applications/repositories/page'
import DatabasePage from '@/app/applications/database/page'
import type { ViewType } from '@/app/components/view-selector'
import type { ReactNode } from 'react'

const mockFrom = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: mockFrom }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: 'site' }, isLoading: false }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), useSearchParams: () => new URLSearchParams() }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: { children: ReactNode }) => <header>{children}</header> }))
jest.mock('@/app/components/ui/sort-dropdown', () => ({ SortDropdown: () => null }))
jest.mock('@/app/components/view-selector', () => ({
  ViewSelector: ({ currentView, onViewChange }: { currentView: ViewType; onViewChange: (v: ViewType) => void }) =>
    <button onClick={() => onViewChange(currentView === 'table' ? 'kanban' : 'table')}>{currentView}</button>,
}))

beforeEach(() => {
  mockFrom.mockReset().mockReturnValue({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(), abortSignal: jest.fn().mockResolvedValue({ data: [], error: null }) })
  jest.mocked(fetch).mockReset().mockResolvedValue({ ok: true, json: async () => ({ tenants: [] }) } as Response)
  window.matchMedia = jest.fn().mockReturnValue({ matches: true, addEventListener: jest.fn(), removeEventListener: jest.fn() })
})

it('the hydrated mobile view does not restart the repositories query', async () => {
  render(<RepositoriesPage />)
  expect(await screen.findByText('No repositories found')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'kanban' })).toBeInTheDocument()
  expect(mockFrom).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'kanban' }))
  await act(async () => {})
  expect(mockFrom).toHaveBeenCalledTimes(1)
  expect(fetch).not.toHaveBeenCalled()
})

it('switching the database view keeps its ready tenant list without a second request', async () => {
  render(<DatabasePage />)
  await screen.findByText('No tenant databases found')
  fireEvent.click(screen.getByRole('button', { name: 'kanban' }))
  await act(async () => {})
  expect(screen.getByRole('button', { name: 'table' })).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(1)
})