import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ScopedRuleDetail, ReplenishmentRuleDetail } from '@/app/purchases/procurement/replenishment/detail'
import { procurementRouteTitle } from '@/lib/navigation/procurement-route-title'
import type { RuleDetailData } from '@/app/purchases/procurement/replenishment/detail-data'

const mockSite = { id: '11111111-1111-4111-8111-111111111111' }
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock('@/app/purchases/procurement/components/reference-picker', () => ({ ReferencePicker: () => null }))

const siteId = mockSite.id
const ruleId = '22222222-2222-4222-8222-222222222222'
const detail: RuleDetailData = {
  rule: { id: ruleId, version: 2, name: 'Paper stock', catalog_item_id: '33333333-3333-4333-8333-333333333333',
    location_id: '44444444-4444-4444-8444-444444444444', catalog_item_name: 'Office paper', location_name: 'Warehouse',
    minimum: 10, target: 40, minimum_order: 1, order_multiple: 1, action: 'draft', enabled: true },
  queue: null, cases: [
    { id: 'open-case', rule_id: ruleId, request_id: null, status: 'open', rule_version: 1, observed_quantity: 8,
      quantity: 32, action: 'alert', created_at: '2026-11-03T12:00:00Z', closed_at: null, close_reason: null },
    { id: 'closed-case', rule_id: ruleId, request_id: 'request', status: 'closed', rule_version: 1, observed_quantity: 5,
      quantity: 35, action: 'draft', created_at: '2026-11-02T12:00:00Z', closed_at: '2026-11-03T12:00:00Z', close_reason: 'Stock reconciled' },
  ], case_count: 2, case_page: 1,
  requests: [{ id: 'request', title: 'Replenishment: Office paper', status: 'draft', currency: 'USD', net_amount_minor: 3500, revision: 1 }],
  request_count: 1, request_page: 1, page_size: 50,
}
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver })
beforeEach(() => { mockSite.id = siteId; jest.mocked(fetch).mockReset().mockResolvedValue(response(detail)) })

test('uses the rule identity, sidebar, scoped cases and requisition tabs with history', async () => {
  render(<ScopedRuleDetail siteId={siteId} ruleId={ruleId} />)
  expect(screen.getByRole('status', { name: 'Loading content' })).toHaveAttribute('aria-busy', 'true')
  await screen.findByRole('heading', { name: 'Paper stock' })
  expect(fetch).toHaveBeenCalledWith(`/api/procurement/replenishment/${ruleId}?site_id=${siteId}&case_page=1&request_page=1`, expect.objectContaining({ cache: 'no-store' }))
  expect(screen.getByRole('complementary')).toHaveTextContent('Office paper')
  expect(screen.getByRole('complementary')).toHaveTextContent('Warehouse')
  expect(screen.getByText('Stock reconciled', { exact: false })).toBeInTheDocument()
  expect(screen.getByText('Alert only · No linked requisition')).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'Resolve case' })).toHaveLength(1)
  const casesTable = screen.getByRole('table', { name: 'Replenishment cases' })
  expect(casesTable.parentElement).toHaveClass('overflow-auto')
  expect(casesTable.parentElement!.parentElement).toHaveClass('bg-card', 'rounded-xl')
  expect(within(casesTable).getByRole('columnheader', { name: 'Details' })).toHaveClass('uppercase')
  expect(within(casesTable).getAllByRole('row')).toHaveLength(3)
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Requisitions' }), { button: 0, ctrlKey: false })
  expect(screen.getByRole('link', { name: 'Replenishment: Office paper' })).toHaveAttribute('href', '/purchases/requests/request')
  expect(screen.getByText('$35.00')).toBeInTheDocument()
  const requestsTable = screen.getByRole('table', { name: 'Requisitions' })
  expect(within(requestsTable).getByRole('columnheader', { name: 'Net amount' })).toHaveClass('text-right', 'uppercase')
  expect(screen.getByText('$35.00')).toHaveClass('tabular-nums')
  expect(screen.queryByRole('link', { name: 'Back to replenishment rules' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  expect(procurementRouteTitle(`/inventory/minimums/${ruleId}`)).toBe('Replenishment rule')
})

test('paginates cases and linked requisitions independently', async () => {
  jest.mocked(fetch).mockImplementation(async url => {
    const params = new URL(String(url), 'https://example.test').searchParams
    return response({ ...detail, case_count: 201, request_count: 151, case_page: Number(params.get('case_page')), request_page: Number(params.get('request_page')) })
  })
  render(<ScopedRuleDetail siteId={siteId} ruleId={ruleId} />)
  await screen.findByRole('heading', { name: 'Paper stock' })
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Replenishment case pages' })).getByRole('button', { name: '5' }))
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('case_page=5&request_page=1'), expect.any(Object)))
  await screen.findByText('Stock reconciled', { exact: false })
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Requisitions' }), { button: 0, ctrlKey: false })
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Rule requisition pages' })).getByRole('button', { name: '4' }))
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('case_page=5&request_page=4'), expect.any(Object)))
  await screen.findByRole('link', { name: 'Replenishment: Office paper' })
  const calls = jest.mocked(fetch).mock.calls.length
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Rule requisition pages' })).getByRole('button', { name: '4' }))
  expect(screen.getByRole('link', { name: 'Replenishment: Office paper' })).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(calls)
})

test('resolves only an open case with an explicit reason, without cancelling the requisition', async () => {
  render(<ScopedRuleDetail siteId={siteId} ruleId={ruleId} />)
  await screen.findByRole('heading', { name: 'Paper stock' })
  fireEvent.click(screen.getByRole('button', { name: 'Resolve case' }))
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveTextContent('The existing requisition is not cancelled')
  const submit = within(dialog).getByRole('button', { name: 'Resolve case' })
  expect(submit).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Resolution reason'), { target: { value: 'Stock counted' } })
  fireEvent.click(submit)
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/procurement/replenishment/cases/open-case/close?site_id=${siteId}`,
    expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: 'Stock counted' }) })))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(jest.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
})

test('checks stock through the existing endpoint and opens inline editing without a dialog', async () => {
  jest.mocked(fetch).mockImplementation(async (_url, init) => response(init?.method === 'POST' ? { status: 'draft_created', request_id: 'new-request' } : detail))
  render(<ScopedRuleDetail siteId={siteId} ruleId={ruleId} />)
  await screen.findByRole('heading', { name: 'Paper stock' })
  fireEvent.click(screen.getByRole('button', { name: 'Check stock' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/procurement/replenishment/${ruleId}/evaluate?site_id=${siteId}`, expect.objectContaining({ method: 'POST', body: '{}' })))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Edit Rule name' })).toBeEnabled())
  fireEvent.click(screen.getByRole('button', { name: 'Edit Rule name' }))
  expect(screen.getByLabelText('Rule name')).toHaveValue('Paper stock')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('saves one inline field with the complete versioned document and reloads server values', async () => {
  let saved = false
  jest.mocked(fetch).mockImplementation(async (_url, init) => {
    if (init?.method === 'POST') { saved = true; return response({ id: ruleId }) }
    return response(saved ? { ...detail, rule: { ...detail.rule, name: 'Printer paper', version: 3 } } : detail)
  })
  render(<ScopedRuleDetail siteId={siteId} ruleId={ruleId} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Rule name' }))
  fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Printer paper' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Rule name' }))
  await screen.findByRole('heading', { name: 'Printer paper' })
  const writes = jest.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')
  expect(writes).toHaveLength(1)
  expect(writes[0][0]).toBe(`/api/procurement/replenishment?site_id=${siteId}`)
  expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ id: ruleId, expected_version: 2, document: {
    name: 'Printer paper', catalog_item_id: detail.rule.catalog_item_id, location_id: detail.rule.location_id,
    minimum: 10, target: 40, minimum_order: 1, order_multiple: 1, action: 'draft', enabled: true,
  } })
})

test('validates target stock and cancels without a write; SKU and location remain immutable', async () => {
  render(<ScopedRuleDetail siteId={siteId} ruleId={ruleId} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Target stock' }))
  fireEvent.change(screen.getByLabelText('Target stock'), { target: { value: '2' } })
  expect(screen.getByRole('button', { name: 'Save Target stock' })).toBeDisabled()
  expect(screen.getByRole('alert')).toHaveTextContent('Target must exceed the minimum')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Target stock edit' }))
  expect(screen.queryByLabelText('Target stock')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit Stock SKU' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Edit Stock location' })).not.toBeInTheDocument()
  expect(jest.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0)
})

test('retains a failed inline draft and does not silently retry the write', async () => {
  jest.mocked(fetch).mockImplementation(async (_url, init) => response(init?.method === 'POST' ? { error: 'Version conflict' } : detail, init?.method === 'POST' ? 409 : 200))
  render(<ScopedRuleDetail siteId={siteId} ruleId={ruleId} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Rule name' }))
  fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Keep draft' } })
  fireEvent.keyDown(screen.getByLabelText('Rule name'), { key: 'Enter' })
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Rule name')).toHaveValue('Keep draft')
  expect(jest.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
})

test.each([404, 403, 503])('does not render empty success on HTTP %s', async status => {
  jest.mocked(fetch).mockResolvedValue(response({ error: 'Unable to load replenishment rule' }, status))
  render(<ScopedRuleDetail siteId={siteId} ruleId={ruleId} />)
  if (status === 404) await screen.findByRole('heading', { name: 'Replenishment rule not found in this workspace.' })
  else await screen.findByRole('alert')
  expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  expect(screen.queryByText('No replenishment cases for this rule.')).not.toBeInTheDocument()
})

test('site changes immediately clear the previous rule', async () => {
  const view = render(<ReplenishmentRuleDetail ruleId={ruleId} />)
  await screen.findByRole('heading', { name: 'Paper stock' })
  let resolve!: (response: Response) => void
  jest.mocked(fetch).mockReturnValueOnce(new Promise(done => { resolve = done }))
  mockSite.id = '55555555-5555-4555-8555-555555555555'
  view.rerender(<ReplenishmentRuleDetail ruleId={ruleId} />)
  expect(screen.queryByRole('heading', { name: 'Paper stock' })).not.toBeInTheDocument()
  resolve(response({ error: 'Not found' }, 404))
  await screen.findByRole('heading', { name: 'Replenishment rule not found in this workspace.' })
})

test('ignores a delayed response for the previous workspace', async () => {
  let finishOld!: (response: Response) => void
  jest.mocked(fetch).mockReturnValueOnce(new Promise(done => { finishOld = done }))
  const view = render(<ReplenishmentRuleDetail ruleId={ruleId} />)
  jest.mocked(fetch).mockResolvedValueOnce(response({ error: 'Not found' }, 404))
  mockSite.id = '55555555-5555-4555-8555-555555555555'
  view.rerender(<ReplenishmentRuleDetail ruleId={ruleId} />)
  await screen.findByRole('heading', { name: 'Replenishment rule not found in this workspace.' })
  await act(async () => { finishOld(response(detail)) })
  expect(screen.queryByRole('heading', { name: 'Paper stock' })).not.toBeInTheDocument()
})

test('failed case resolution retains the dialog and reason without reporting success', async () => {
  jest.mocked(fetch).mockImplementation(async (_url, init) => init?.method === 'POST'
    ? response({ error: 'Unable to close replenishment case' }, 503) : response(detail))
  render(<ScopedRuleDetail siteId={siteId} ruleId={ruleId} />)
  await screen.findByRole('heading', { name: 'Paper stock' })
  fireEvent.click(screen.getByRole('button', { name: 'Resolve case' }))
  fireEvent.change(screen.getByLabelText('Resolution reason'), { target: { value: 'Stock counted' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Resolve case' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Resolution reason')).toHaveValue('Stock counted')
  expect(jest.mocked(fetch).mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1)
})

test('rejects a detail response for another rule instead of showing it', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ ...detail, rule: { ...detail.rule, id: 'wrong-rule' } }))
  render(<ScopedRuleDetail siteId={siteId} ruleId={ruleId} />)
  await screen.findByRole('alert')
  expect(screen.queryByRole('heading', { name: 'Paper stock' })).not.toBeInTheDocument()
})

test.each([{ cases: [null] }, { requests: [null] }, { queue: {} }, { case_page: 99 }])('rejects malformed detail payload %j', async patch => {
  jest.mocked(fetch).mockResolvedValue(response({ ...detail, ...patch }))
  render(<ScopedRuleDetail siteId={siteId} ruleId={ruleId} />)
  await screen.findByRole('alert')
  expect(screen.queryByRole('heading', { name: 'Paper stock' })).not.toBeInTheDocument()
})

test('unknown demo rules never show another rule or make authenticated API calls', async () => {
  render(<ScopedRuleDetail siteId="demo-workspace" ruleId="missing-demo-rule" />)
  expect(screen.getByRole('heading', { name: 'Replenishment rule not found in this workspace.' })).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
})