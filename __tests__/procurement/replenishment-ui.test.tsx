import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ReplenishmentRules } from '@/app/purchases/procurement/replenishment/rules'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/purchases/procurement/components/reference-picker', () => ({ ReferencePicker: () => null }))
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver })
const rule = { id: 'rule', version: 1, name: 'Paper stock', catalog_item_id: '11111111-1111-4111-8111-111111111111', location_id: '22222222-2222-4222-8222-222222222222', minimum: 10, target: 40, minimum_order: 1, order_multiple: 1, action: 'draft', enabled: true }
test('creates inventory rules from the global TopBar, without duplicating the card action', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ rules: [], cases: [], rule_count: 0, case_count: 0 }) } as Response)
  render(<><TopBarPrimaryActionsSlot /><ReplenishmentRules siteId="site" /></>)
  const heading = screen.getByRole('heading', { name: 'Inventory replenishment', level: 3 })
  const header = heading.parentElement!.parentElement!
  const create = within(document.getElementById('page-primary-actions')!).getByRole('button', { name: 'Create replenishment rule' })
  expect(header).not.toContainElement(create)
  expect(create).toBeDisabled()
  await waitFor(() => expect(create).toBeEnabled())
  expect(document.getElementById('page-primary-actions')).toContainElement(create)
  expect(create).toHaveClass('btn-primary')
  expect(screen.getAllByRole('button', { name: 'Create replenishment rule' })).toHaveLength(1)
  expect(create.querySelector('svg')).toBeInTheDocument()
  fireEvent.click(create)
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText('Rule name')).toHaveValue('')
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save replenishment rule' })).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(1)
})
test('uses a dialog for configuration and checks stock without sending client quantities', async () => {
  jest.mocked(fetch).mockImplementation(async (_url, init) => ({ ok: true, json: async () => init?.method === 'POST'
    ? { status: 'draft_created', request_id: 'request', message: 'Draft requisition created' }
    : { rules: [rule], cases: [], rule_count: 1, case_count: 0 } }) as Response)
  render(<><TopBarPrimaryActionsSlot /><ReplenishmentRules siteId="site" /></>)
  await screen.findByText('Paper stock')
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText('Rule name')).toHaveValue('Paper stock')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  fireEvent.click(screen.getByRole('button', { name: 'Check stock' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/procurement/replenishment/rule/evaluate?site_id=site', expect.objectContaining({ method: 'POST', body: '{}' })))
  expect(await screen.findByRole('link', { name: 'Open requisition' })).toHaveAttribute('href', '/purchases/requests/request')
})

test('paginates rules and cases independently beyond 200 without losing rule labels', async () => {
  jest.mocked(fetch).mockImplementation(async url => {
    const params = new URL(String(url), 'https://example.test').searchParams
    return { ok: true, json: async () => ({ rules: [{ ...rule, name: params.get('page') === '5' ? 'Rule 201' : rule.name }],
      cases: [{ id: 'case', rule_id: 'old-rule', rule_name: 'Older warehouse rule', action: 'alert', quantity: 3, observed_quantity: 1, request_id: null }],
      rule_count: 201, case_count: 201, queue: [] }) } as Response
  })
  render(<><TopBarPrimaryActionsSlot /><ReplenishmentRules siteId="site" /></>)
  await screen.findByText('Paper stock')
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Replenishment rule pages' })).getByRole('button', { name: '5' }))
  await screen.findByText('Rule 201')
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Replenishment case pages' })).getByRole('button', { name: '5' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/procurement/replenishment?site_id=site&page=5&case_page=5', expect.any(Object)))
  expect(await screen.findByText('Older warehouse rule · Alert')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Resolve case' })).toBeEnabled()
})