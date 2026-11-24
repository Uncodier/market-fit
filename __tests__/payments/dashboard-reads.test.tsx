import { act, fireEvent, render, screen } from '@testing-library/react'
import { SWRConfig } from 'swr'
import PaymentsPage from '@/app/payments/page'

const mockRead = jest.fn()
const firstSite = '11111111-1111-4111-8111-111111111111'
let mockSite = firstSite
let mockActor: string | null = 'actor-a'
let mockHydrating = false
let mockBillingAvailable = true
const mockRetryBilling = jest.fn(async () => {})
jest.mock('@/app/hooks/use-auth', () => ({ useAuth: () => ({ isLoading: false, user: mockActor && { id: mockActor } }) }))
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ isLoading: mockHydrating,
  requestScope: { actorId: mockActor, siteId: mockSite }, currentSite: {
  id: mockSite, billing_read_status: mockBillingAvailable ? 'loaded' : 'unavailable',
  billing: { account_balance: 50, credits_available: 120 },
}, refreshSiteBilling: mockRetryBilling }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: () => '' }) }))
jest.mock('@/app/components/ui/sticky-header', () => ({ StickyHeader: ({ children }: React.PropsWithChildren) => children }))
jest.mock('@/app/payments/components/WalletChart', () => ({ WalletChart: ({ data }: { data: unknown[] }) =>
  <output data-testid="wallet-chart">{JSON.stringify(data.at(-1))}</output> }))
jest.mock('@/app/payments/components/SalesWithdrawalsChart', () => ({ SalesWithdrawalsChart: () => null }))
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ from: (table: string) => ({
  select: (fields: string) => ({ eq: (column: string, site: string) => ({
    in: (kind: string, values: string[]) => ({ order: () => mockRead(table, fields, column, site, kind, values) }),
    order: () => mockRead(table, fields, column, site),
  }) }),
}) }) }))

function reply(table: string) {
  const created_at = new Date().toISOString()
  const records: Record<string, unknown[]> = {
    payments: [{ id: 'sale', amount: 34, transaction_type: 'sale', created_at, status: 'completed' },
      { id: 'fee', amount: 3, transaction_type: 'commission', created_at, status: 'completed' }],
    payout_requests: [{ id: 'payout', requested_credits: 11, status: 'completed', created_at }],
    credit_transactions: [{ amount: 8, created_at }],
  }
  if (!records[table]) throw new Error('Unexpected read')
  return { data: records[table], error: null }
}
const ui = () => <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false, keepPreviousData: true }}><PaymentsPage /></SWRConfig>
function tab(name: string) { fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0, ctrlKey: false }) }
beforeEach(() => {
  jest.clearAllMocks(); mockSite = firstSite; mockActor = 'actor-a'; mockHydrating = false; mockBillingAvailable = true
  mockRead.mockImplementation(async (table: string) => reply(table))
})

it('reads all three inputs for Overview, restricts operations to the consumed types, and reuses rows on tab changes', async () => {
  render(ui())
  const chart = await screen.findByTestId('wallet-chart')
  expect(JSON.parse(chart.textContent!)).toMatchObject({ sales: 31, withdrawals: 11, operations: 39, consumed: 11 })
  for (const [label, amount] of [['Total Operations', '2'], ['Total Usable Credits', '170'],
    ['Withdrawable Balance', '$50.00'], ['Total Withdrawals', '$11.00']]) {
    expect(screen.getByText(label).closest('[data-report-kpi]')?.querySelector('[data-kpi-slot="value"]')).toHaveTextContent(amount)
  }
  expect(mockRead.mock.calls).toEqual(expect.arrayContaining([
    ['payments', 'id, status, created_at, transaction_type, amount, details', 'site_id', mockSite, 'transaction_type', ['sale', 'commission']],
    ['payout_requests', 'id, status, created_at, requested_credits', 'site_id', mockSite],
    ['credit_transactions', 'amount, created_at', 'site_id', mockSite],
  ]))
  tab('Operations'); expect(await screen.findByText('Platform Commission')).toBeVisible()
  tab('Withdrawals'); expect(await screen.findByText('Payout to bank account')).toBeVisible()
  expect(mockRead).toHaveBeenCalledTimes(3)
  expect(fetch).not.toHaveBeenCalled()
})

it('does not publish an empty ledger or chart on denial, and retries only the failed read', async () => {
  let denied = true
  mockRead.mockImplementation(async (table: string) => table === 'payments' && denied
    ? { error: { code: '42501' }, data: null } : reply(table))
  render(ui())
  expect(await screen.findByRole('alert')).toHaveTextContent('Payment history could not be loaded')
  expect(screen.queryByTestId('wallet-chart')).not.toBeInTheDocument()
  tab('Withdrawals'); expect(await screen.findByText('Payout to bank account')).toBeVisible()
  tab('Operations'); expect(screen.queryByText('No operations yet')).not.toBeInTheDocument()
  denied = false
  fireEvent.click(screen.getByRole('button', { name: 'Retry payment history' }))
  expect(await screen.findByText('Sale Revenue')).toBeVisible()
  expect(mockRead.mock.calls.map(([table]) => table).sort()).toEqual(['credit_transactions', 'payments', 'payments', 'payout_requests'])
  expect(fetch).not.toHaveBeenCalled()
})

it.each(['site', 'account'])('discards a late ledger and an open payout draft on %s change', async change => {
  let finish!: (value: unknown) => void
  mockRead.mockImplementation((table: string) => table === 'payments' && mockSite === firstSite && mockActor === 'actor-a'
    ? new Promise(resolve => { finish = resolve }) : Promise.resolve({ data: [], error: null }))
  const view = render(ui())
  expect(screen.queryByTestId('wallet-chart')).not.toBeInTheDocument()
  act(() => window.dispatchEvent(new Event('payouts:request-open')))
  expect(screen.getByRole('dialog')).toBeVisible()
  if (change === 'site') mockSite = '22222222-2222-4222-8222-222222222222'
  else mockActor = 'actor-b'
  view.rerender(ui())
  await act(async () => finish(reply('payments')))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(JSON.parse((await screen.findByTestId('wallet-chart')).textContent!)).toMatchObject({ sales: 0, withdrawals: 0 })
  tab('Operations'); expect(await screen.findByText('No operations yet')).toBeVisible()
  expect(mockRead).toHaveBeenCalledTimes(6)
  expect(fetch).not.toHaveBeenCalled()
})

it('does not read for a hydrating or signed-out workspace and never turns unavailable billing into a zero balance', async () => {
  mockHydrating = true
  const view = render(ui()); expect(mockRead).not.toHaveBeenCalled()
  mockActor = null; mockHydrating = false
  view.rerender(ui()); expect(mockRead).not.toHaveBeenCalled()
  mockActor = 'actor-a'; mockBillingAvailable = false
  view.rerender(ui())
  fireEvent.click(await screen.findByRole('button', { name: 'Retry billing balance' }))
  expect(mockRetryBilling).toHaveBeenCalledWith(mockSite)
  expect(screen.queryByTestId('wallet-chart')).not.toBeInTheDocument()
  expect(screen.queryByText('$0.00')).not.toBeInTheDocument()
  act(() => window.dispatchEvent(new Event('payouts:request-open')))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  mockBillingAvailable = true; view.rerender(ui())
  expect(await screen.findByTestId('wallet-chart')).toBeVisible()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(mockRead).toHaveBeenCalledTimes(3)
})