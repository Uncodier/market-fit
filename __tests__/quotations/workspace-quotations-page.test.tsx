import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import QuotationsPage from '@/app/quotations/page'
import { listWorkspaceQuotations } from '@/app/quotations/workspace-read-actions'

let siteId = 'company-a'
const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/quotations', useSearchParams: () => new URLSearchParams() }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: siteId } }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: { id: 'member' } }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/quotations/workspace-read-actions', () => ({ listWorkspaceQuotations: jest.fn() }))
jest.mock('@/app/hooks/use-optimistic-error', () => ({
  retryOnError: (run: () => Promise<unknown>) => run(),
  useOptimisticLoadState: (isLoading: boolean, error: Error | null) => ({ isLoading, error }),
}))

beforeEach(() => { jest.clearAllMocks(); siteId = 'company-a' })
it('shows sales and tender submissions in one existing table with ordinary detail navigation', async () => {
  jest.mocked(listWorkspaceQuotations).mockResolvedValue({ data: [
    { id: 'sale', purpose: 'sales', status: 'draft', lead: { name: 'Sales customer' }, total: 12, created_at: '2026-10-01' },
    { id: 'proposal', purpose: 'procurement', status: 'sent', lead: { name: 'Tender buyer' }, total: 20,
      created_at: '2026-10-02', tender_url: '/tenders/buyer/services' },
  ], count: 2 })
  render(<QuotationsPage />)
  await screen.findByText('Tender buyer')
  expect(screen.getByText('Sales customer')).toBeInTheDocument()
  expect(screen.getAllByRole('table')).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'View tender' })).toHaveAttribute('href', '/tenders/buyer/services')
  fireEvent.click(screen.getByText('Tender buyer'))
  expect(push).toHaveBeenCalledWith('/quotations/proposal')
})

it('clears the former company data immediately when changing workspaces', async () => {
  jest.mocked(listWorkspaceQuotations).mockResolvedValueOnce({ data: [
    { id: 'proposal', purpose: 'procurement', status: 'sent', lead: { name: 'Private company A proposal' }, total: 20, created_at: '2026-10-02' },
  ], count: 1 }).mockImplementationOnce(() => new Promise(() => {}))
  const view = render(<QuotationsPage />)
  await screen.findByText('Private company A proposal')
  siteId = 'company-b'
  view.rerender(<QuotationsPage />)
  expect(screen.queryByText('Private company A proposal')).not.toBeInTheDocument()
  await waitFor(() => expect(listWorkspaceQuotations).toHaveBeenLastCalledWith(expect.objectContaining({ siteId: 'company-b' })))
})