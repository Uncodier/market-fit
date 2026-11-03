import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { ReplenishmentRules } from '@/app/purchases/procurement/replenishment/rules'
import { ReplenishmentRuleDialog } from '@/app/purchases/procurement/replenishment/rule-dialog'
import type { ReplenishmentRule } from '@/app/purchases/procurement/replenishment/schema'
import { policyNavigation } from '@/app/purchases/procurement/components/policy-navigation'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/purchases/procurement/components/reference-picker', () => ({
  ReferencePicker: ({ label, disabled, ids, onChange }: { label: string; disabled: boolean; ids: string[]; onChange: (ids: string[]) => void }) =>
    <input aria-label={label} disabled={disabled} value={ids[0] ?? ''} onChange={event => onChange([event.target.value])} />,
}))
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as typeof ResizeObserver })
beforeEach(() => { jest.mocked(fetch).mockReset() })
const rule: ReplenishmentRule = { id: 'rule', version: 1, name: 'Paper stock', catalog_item_id: '11111111-1111-4111-8111-111111111111', location_id: '22222222-2222-4222-8222-222222222222', minimum: 10, target: 40, minimum_order: 1, order_multiple: 1, action: 'draft', enabled: true }
test('creates inventory rules from the global TopBar, without duplicating the card action', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ rules: [], cases: [], rule_count: 0, case_count: 0 }) } as Response)
  render(<><TopBarPrimaryActionsSlot /><ReplenishmentRules siteId="site" /></>)
  const heading = screen.getByRole('heading', { name: 'Inventory replenishment', level: 2 })
  const header = heading.parentElement!
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
  expect(screen.getByRole('link', { name: 'Paper stock' })).toHaveAttribute('href', '/inventory/minimums/rule')
  const table = screen.getByRole('table', { name: 'Inventory replenishment' })
  expect(table).toHaveClass('min-w-[1000px]')
  expect(table.parentElement).toHaveClass('overflow-auto')
  expect(table.parentElement!.parentElement).toHaveClass('bg-card', 'rounded-xl')
  expect(within(table).getByRole('columnheader', { name: 'Rule' })).toHaveClass('uppercase')
  expect(within(table).getByText('Enabled').parentElement?.querySelector('.rounded-full')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByLabelText('Rule name')).toHaveValue('Paper stock')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  fireEvent.click(screen.getByRole('button', { name: 'Check stock' }))
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/procurement/replenishment/rule/evaluate?site_id=site', expect.objectContaining({ method: 'POST', body: '{}' })))
  expect(await screen.findByRole('link', { name: 'Open requisition' })).toHaveAttribute('href', '/purchases/requests/request')
})

test('paginates rules beyond 200 without displaying global cases or requesting case pages', async () => {
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
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/procurement/replenishment?site_id=site&page=5', expect.any(Object)))
  expect(screen.queryByRole('navigation', { name: 'Replenishment case pages' })).not.toBeInTheDocument()
  expect(screen.queryByText('Older warehouse rule · Alert')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Resolve case' })).not.toBeInTheDocument()
  expect(document.getElementById('procurement-replenishment-cases')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Rule 201' })).toHaveAttribute('href', '/inventory/minimums/rule')
})

test('minimums QuickNav contains only the inventory section', () => {
  expect(policyNavigation('rules', 'replenishment', [], key => key)).toEqual([
    { id: 'procurement-replenishment-minimums', title: 'procurement.workflow.replenishment.inventory' },
  ])
})

test('shared dialog validates drafts before posting and resets when reopened', () => {
  const props = { siteId: 'site', onClose: jest.fn(), onSaved: jest.fn() }
  const { rerender } = render(<ReplenishmentRuleDialog {...props} rule={rule} />)
  fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save replenishment rule' }))
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(props.onSaved).not.toHaveBeenCalled()
  rerender(<ReplenishmentRuleDialog {...props} rule={null} />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  rerender(<ReplenishmentRuleDialog {...props} rule={rule} />)
  expect(screen.getByLabelText('Rule name')).toHaveValue('Paper stock')
})

test('shared dialog prevents duplicate submissions and sends versioned edits', async () => {
  let finish!: (response: Response) => void
  jest.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const onClose = jest.fn(), onSaved = jest.fn()
  render(<ReplenishmentRuleDialog siteId="site" rule={rule} onClose={onClose} onSaved={onSaved} />)
  fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Updated paper' } })
  const form = screen.getByRole('button', { name: 'Save replenishment rule' }).closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('/api/procurement/replenishment?site_id=site', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ id: rule.id, expected_version: rule.version, document: {
      name: 'Updated paper', catalog_item_id: rule.catalog_item_id, location_id: rule.location_id,
      minimum: 10, target: 40, minimum_order: 1, order_multiple: 1, action: 'draft', enabled: true,
    } }),
  }))
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Save replenishment rule' })).toBeDisabled()
  await act(async () => finish({ ok: true, json: async () => ({ rule }) } as Response))
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(onSaved).toHaveBeenCalledTimes(1)
})

test('creates a rule through the shared dialog and refreshes the list after saving', async () => {
  jest.mocked(fetch).mockImplementation(async (_url, init) => ({ ok: true, json: async () => init?.method === 'POST'
    ? { rule } : { rules: [], rule_count: 0 } }) as Response)
  render(<><TopBarPrimaryActionsSlot /><ReplenishmentRules siteId="site" /></>)
  const create = screen.getByRole('button', { name: 'Create replenishment rule' })
  await waitFor(() => expect(create).toBeEnabled())
  fireEvent.click(create)
  fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'New paper rule' } })
  fireEvent.change(screen.getByRole('textbox', { name: /SKU/i }), { target: { value: rule.catalog_item_id } })
  fireEvent.change(screen.getByRole('textbox', { name: /location/i }), { target: { value: rule.location_id } })
  fireEvent.click(screen.getByRole('button', { name: 'Save replenishment rule' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const post = jest.mocked(fetch).mock.calls.find(([, init]) => init?.method === 'POST')!
  expect(JSON.parse(String(post[1]!.body))).toMatchObject({ id: null, expected_version: 0,
    document: { name: 'New paper rule', catalog_item_id: rule.catalog_item_id, location_id: rule.location_id, enabled: false },
  })
  expect(fetch).toHaveBeenCalledTimes(3)
})

test('shared dialog retains draft and supports retry after failed save', async () => {
  jest.mocked(fetch).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Unable to save' }) } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ rule }) } as Response)
  const onSaved = jest.fn()
  render(<ReplenishmentRuleDialog siteId="site" rule={rule} onClose={jest.fn()} onSaved={onSaved} />)
  fireEvent.change(screen.getByLabelText('Rule name'), { target: { value: 'Keep this draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save replenishment rule' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save')
  expect(screen.getByLabelText('Rule name')).toHaveValue('Keep this draft')
  expect(onSaved).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Save replenishment rule' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
  expect(fetch).toHaveBeenCalledTimes(2)
})

test('shared dialog blocks demo saves even when the form is submitted directly', () => {
  render(<ReplenishmentRuleDialog siteId="site" rule={rule} demo onClose={jest.fn()} onSaved={jest.fn()} />)
  const save = screen.getByRole('button', { name: 'Save replenishment rule' })
  expect(save).toBeDisabled()
  fireEvent.submit(save.closest('form')!)
  expect(fetch).not.toHaveBeenCalled()
})