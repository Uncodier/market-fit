import { render, screen, waitFor } from '@testing-library/react'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { LocalizationProvider } from '@/app/context/LocalizationContext'
import { ProcurementState } from '@/app/purchases/procurement/ui/workspace'
import { DocumentTable } from '@/app/purchases/procurement/commerce/document-ui'
import { RequestList } from '@/app/purchases/requests/request-list'
import { TenderList } from '@/app/purchases/tenders/tender-list'
import { SupplierList } from '@/app/suppliers/components/supplier-list'
import ApprovalPage from '@/app/purchases/procurement/approvals/page'
import { ReplenishmentRules } from '@/app/purchases/procurement/replenishment/rules'
import { RulesEditor } from '@/app/purchases/procurement/components/rules-editor'

jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: { id: '11111111-1111-4111-8111-111111111111' } }) }))
jest.mock('@/app/components/auth/auth-provider', () => ({ useAuthContext: () => ({ user: null, isLoading: false }) }))
jest.mock('@/app/components/ui/empty-card', () => {
  const actual = jest.requireActual('@/app/components/ui/empty-card')
  return { ...actual, EmptyCard: jest.fn((props) => actual.EmptyCard(props)) }
})
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })
beforeEach(() => {
  localStorage.clear()
  jest.mocked(EmptyCard).mockClear()
  jest.mocked(fetch).mockReset().mockResolvedValue({ ok: true, json: async () => ({
    requests: [], tenders: [], suppliers: [], rows: [], rules: [], cases: [], queue: [], count: 0, total: 0,
    rule_count: 0, case_count: 0, can_manage: true, can_create: false,
  }) } as Response)
})
const shell = (child: React.ReactNode, locale: 'en' | 'es' = 'en') => <LocalizationProvider preferredLocale={locale}>{child}</LocalizationProvider>
const sharedCards = () => jest.mocked(EmptyCard).mock.calls.map(([props]) => props)

test('workspace empty results use the same bounded EmptyCard as Leads instead of a viewport-sized EmptyState', () => {
  const view = render(shell(<ProcurementState empty emptyTitle="No requisitions" description="Adjust the filters" />))
  expect(screen.getByRole('heading', { name: 'No requisitions' })).toBeInTheDocument()
  expect(screen.getByText('Adjust the filters')).toBeInTheDocument()
  expect(sharedCards()).toContainEqual(expect.objectContaining({ title: 'No requisitions', showHint: false, showShadow: true }))
  expect(view.container.querySelector('[class*="100vh-207px"]')).toBeNull()
  expect(screen.queryByText(/Most operations run automatically/)).not.toBeInTheDocument()
})

test.each(['loading', 'error'] as const)('%s never renders an empty card even when empty was requested', state => {
  render(shell(<ProcurementState empty loading={state === 'loading'} error={state === 'error' ? 'Storage unavailable' : null} />))
  expect(EmptyCard).not.toHaveBeenCalled()
  expect(screen.getByRole(state === 'loading' ? 'status' : 'alert')).toBeInTheDocument()
})

test('empty document tables render EmptyCard outside the table and keep loading/populated rows unchanged', () => {
  const view = render(shell(<DocumentTable rows={[]} columns={[{ label: 'Name', render: (row: { id: string }) => row.id }]} empty="No documents" compact />))
  expect(screen.getByRole('heading', { name: 'No documents' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(sharedCards()[0]).toMatchObject({ showShadow: false, contentClassName: 'min-h-[180px] py-6' })
  jest.mocked(EmptyCard).mockClear()
  view.rerender(shell(<DocumentTable rows={[]} columns={[{ label: 'Name', render: (row: { id: string }) => row.id }]} empty="No documents" loading />))
  expect(screen.getByRole('table')).toBeInTheDocument()
  expect(EmptyCard).not.toHaveBeenCalled()
  view.rerender(shell(<DocumentTable rows={[{ id: 'Stored record' }]} columns={[{ label: 'Name', render: row => row.id }]} empty="No documents" />))
  expect(screen.getByRole('table')).toHaveTextContent('Stored record')
  expect(EmptyCard).not.toHaveBeenCalled()
})

test.each([
  ['requests', <RequestList key="requests" />, 'No requests match this view.'],
  ['tenders', <TenderList key="tenders" />, 'No tenders match this view.'],
  ['suppliers', <SupplierList key="suppliers" siteId="site" />, 'No suppliers found'],
  ['approvals', <ApprovalPage key="approvals" />, 'No approvals match these filters.'],
] as const)('%s uses the shared empty card for real empty API results', async (_module, child, title) => {
  render(shell(child))
  await screen.findByRole('heading', { name: title })
  expect(sharedCards()).toContainEqual(expect.objectContaining({ title }))
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('replenishment rules, open cases and policy lists reuse compact EmptyCards', async () => {
  render(shell(<><ReplenishmentRules siteId="site" /><RulesEditor rules={[]} onChange={() => undefined} siteId="site" timeZone="UTC" /></>))
  await waitFor(() => expect(sharedCards().length).toBeGreaterThanOrEqual(3))
  for (const props of sharedCards()) expect(props).toMatchObject({ showShadow: false, contentClassName: 'min-h-[180px] py-6' })
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
})

test('localized empty text changes without reloading or mutating requests', async () => {
  const view = render(shell(<RequestList />))
  await screen.findByRole('heading', { name: 'No requests match this view.' })
  const reads = jest.mocked(fetch).mock.calls.length
  view.rerender(shell(<RequestList />, 'es'))
  expect(screen.getByRole('heading', { name: 'Ninguna solicitud coincide con esta vista.' })).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(reads)
})