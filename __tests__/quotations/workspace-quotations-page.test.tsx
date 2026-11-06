import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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

beforeEach(() => { jest.clearAllMocks(); jest.mocked(listWorkspaceQuotations).mockReset(); siteId = 'company-a' })
it.each(['demo-habituall', 'demo-ecom-es-456', 'demo-saas-en-123'])('loads local quotations without server actions for %s', async demoId => {
  siteId = demoId
  render(<QuotationsPage />)
  await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
  expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
  expect(listWorkspaceQuotations).not.toHaveBeenCalled()
})
it('loads the selected status with the existing workspace parameters and displays load errors', async () => {
  jest.mocked(listWorkspaceQuotations).mockResolvedValue({ data: [], count: 0 })
  render(<QuotationsPage />)
  await waitFor(() => expect(listWorkspaceQuotations).toHaveBeenCalled())
  jest.mocked(listWorkspaceQuotations).mockResolvedValue({ error: 'Unable to load quotations' })
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'quotations.list.filters.sent' }), { button: 0, ctrlKey: false })
  await waitFor(() => expect(listWorkspaceQuotations).toHaveBeenLastCalledWith(expect.objectContaining({ siteId: 'company-a', status: 'sent', page: 1, pageSize: 50 })))
  await screen.findByText('quotations.list.errorLoading')
})

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

it('shows a skeleton on explicit reload with existing rows, then exposes failure and recovers', async () => {
  const result = { data: [{ id: 'sale', lead: { name: 'Existing customer' }, created_at: '2026-10-01' }], count: 1 }
  jest.mocked(listWorkspaceQuotations).mockResolvedValueOnce(result)
  render(<QuotationsPage />)
  await screen.findByText('Existing customer')
  let reject!: (error: Error) => void
  jest.mocked(listWorkspaceQuotations).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
  fireEvent.submit(screen.getAllByPlaceholderText('quotations.list.search')[0].closest('form')!)
  expect(screen.queryByText('Existing customer')).not.toBeInTheDocument()
  expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  await waitFor(() => expect(listWorkspaceQuotations).toHaveBeenCalledTimes(2))
  await act(async () => { reject(new Error('Reload failed')) })
  await screen.findByText('quotations.list.errorLoading')
  expect(screen.queryByText('Existing customer')).not.toBeInTheDocument()
  jest.mocked(listWorkspaceQuotations).mockResolvedValueOnce(result)
  fireEvent.submit(screen.getAllByPlaceholderText('quotations.list.search')[0].closest('form')!)
  await screen.findByText('Existing customer')
})

it('ignores an obsolete response after filters change', async () => {
  let resolve!: (result: { data: { id: string; lead: { name: string }; created_at: string }[]; count: number }) => void
  jest.mocked(listWorkspaceQuotations).mockImplementationOnce(() => new Promise((done) => { resolve = done }))
    .mockResolvedValueOnce({ data: [], count: 0 })
  render(<QuotationsPage />)
  await waitFor(() => expect(listWorkspaceQuotations).toHaveBeenCalledTimes(1))
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'quotations.list.filters.sent' }), { button: 0, ctrlKey: false })
  await screen.findByText('quotations.list.empty.title')
  await act(async () => { resolve({ data: [{ id: 'old', lead: { name: 'Obsolete customer' }, created_at: '2026-10-01' }], count: 1 }) })
  expect(screen.queryByText('Obsolete customer')).not.toBeInTheDocument()
})
