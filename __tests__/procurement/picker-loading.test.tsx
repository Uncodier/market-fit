import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProcurementPage } from '@/app/purchases/procurement/components/procurement-page'
import { defaultPolicyDocument, procurementRuleSchema } from '@/app/purchases/procurement/domain'
import { ReplenishmentRules } from '@/app/purchases/procurement/replenishment/rules'
import { TopBarPrimaryActionsSlot } from '@/app/components/navigation/topbar-primary-actions'
import { notifyScreenScopeChanged } from '@/lib/permissions/screen-scope-invalidation'

let mockSite: { id: string; name: string } | null = null
jest.mock('@/app/context/SiteContext', () => ({ useSite: () => ({ currentSite: mockSite }) }))
jest.mock('@/app/context/LocalizationContext', () => ({ useLocalization: () => ({ t: (key: string) => key, locale: 'en' }) }))
jest.mock('@/app/context/LayoutContext', () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))

const fetchMock = jest.mocked(fetch)
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body }) as Response
const choices = () => fetchMock.mock.calls.filter(([url]) => String(url).includes('/references?'))
const rule = { id: 'minimum', version: 1, name: 'Paper stock', catalog_item_id: 'item', location_id: 'warehouse', minimum: 2, target: 10,
  minimum_order: 1, order_multiple: 1, action: 'draft', enabled: true }
const waitForDebounce = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 225)) })

beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  global.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof IntersectionObserver
  Element.prototype.scrollIntoView = jest.fn()
})
beforeEach(() => { fetchMock.mockReset(); mockSite = null })

test('rules wait for the workspace and policy; only an open picker searches, cancelling obsolete queries and scopes', async () => {
  let resolveOld!: (value: Response) => void
  fetchMock.mockImplementation(async url => String(url).includes('/policy?') ? response({ revision: 1, document: defaultPolicyDocument() })
    : String(url).endsWith('q=Jo') ? response({ options: [{ id: 'person', label: 'Jo Smith' }], has_more: false })
    : new Promise(resolve => { resolveOld = resolve }))
  const view = render(<ProcurementPage screen="rules" />)
  expect(fetch).not.toHaveBeenCalled()
  mockSite = { id: 'buyer-a', name: 'First workspace' }
  view.rerender(<ProcurementPage screen="rules" />)
  await screen.findByRole('button', { name: 'Simulated requester' })
  await waitForDebounce()
  expect(fetch).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Simulated requester' }))
  await waitFor(() => expect(choices()).toHaveLength(1))
  const browse = choices()[0][1]!.signal!
  fireEvent.change(screen.getByRole('combobox', { name: 'Simulated requester' }), { target: { value: 'Jo' } })
  expect(browse.aborted).toBe(true)
  fireEvent.click(await screen.findByRole('option', { name: 'Jo Smith' }))
  expect(screen.getByRole('button', { name: /Remove Jo Smith/ })).toBeInTheDocument()
  await act(async () => resolveOld(response({ options: [{ id: 'other', label: 'Old result' }] })))
  expect(screen.queryByText('Old result')).not.toBeInTheDocument()
  expect(choices().map(([url]) => String(url))).toEqual(['/api/procurement/references?site_id=buyer-a&kind=people&q=', '/api/procurement/references?site_id=buyer-a&kind=people&q=Jo'])
  await waitFor(() => expect(screen.getByRole('button', { name: 'Simulated requester' })).toHaveFocus())
  fireEvent.click(screen.getByRole('button', { name: 'Simulated responsible person' }))
  await waitFor(() => expect(choices()).toHaveLength(3))
  const signal = choices()[2][1]!.signal!
  mockSite = { id: 'buyer-b', name: 'Next workspace' }
  view.rerender(<ProcurementPage screen="rules" />)
  expect(signal.aborted).toBe(true)
  await act(async () => resolveOld(response({ options: [{ id: 'other', label: 'Late private result' }] })))
  await screen.findByRole('button', { name: 'Simulated requester' })
  expect(screen.queryByRole('button', { name: /Remove Jo Smith/ })).not.toBeInTheDocument()
  expect(screen.queryByText('Late private result')).not.toBeInTheDocument()
  expect(choices()).toHaveLength(3)
})

test('expanded rules share label reads for saved references; collapsing one consumer does not cancel the other', async () => {
  let finish!: (value: Response) => void
  const policy = defaultPolicyDocument()
  policy.rules = ['A', 'B'].map(name => procurementRuleSchema.parse({ id: name, name, type: 'approval', event: 'order',
    scope: { requesterIds: ['11111111-1111-4111-8111-111111111111'] } }))
  mockSite = { id: 'buyer-a', name: 'Workspace' }
  fetchMock.mockImplementation(async url => String(url).includes('/policy?') ? response({ revision: 1, document: policy }) : new Promise(resolve => { finish = resolve }))
  render(<ProcurementPage screen="rules" />)
  await screen.findByRole('button', { name: 'Edit A' })
  expect(choices()).toHaveLength(0)
  const toggle = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Edit ${name}` }))
  toggle('A'); toggle('B')
  await waitForDebounce()
  expect(choices()).toHaveLength(1)
  toggle('A')
  const signal = choices()[0][1]!.signal!
  expect(signal.aborted).toBe(false)
  await act(async () => finish(response({ options: [{ id: '11111111-1111-4111-8111-111111111111', label: 'Saved requester' }] })))
  expect(screen.getByRole('button', { name: 'Remove Saved requester from Requesters' })).toBeInTheDocument()
  toggle('B')
  expect(signal.aborted).toBe(true)
  toggle('A')
  await waitFor(() => expect(choices()).toHaveLength(2))
  act(() => notifyScreenScopeChanged('buyer-a'))
  expect(choices()[1][1]?.signal?.aborted).toBe(true)
  await act(async () => finish(response({ options: [{ id: '11111111-1111-4111-8111-111111111111', label: 'Revoked name' }] })))
  expect(screen.queryByText(/Revoked name/)).not.toBeInTheDocument()
})

test('minimums resolve only saved labels in Edit, defer new choices to open, and revoke closes active choices', async () => {
  let denied = false
  let finish!: (value: Response) => void
  fetchMock.mockImplementation(async url => String(url).includes('/references?') ? choices().length <= 2
    ? response({ options: [{ id: 'item', label: 'Paper A4' }, { id: 'warehouse', label: 'Warehouse A' }] }) : new Promise(resolve => { finish = resolve })
    : denied ? response({ error: 'Forbidden' }, 403) : response({ rules: [rule], queue: [], rule_count: 1 }))
  render(<><TopBarPrimaryActionsSlot /><ReplenishmentRules siteId="buyer" /></>)
  await screen.findByText('Paper stock')
  expect(fetch).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
  expect(screen.getByRole('button', { name: 'Stock SKU' })).toBeDisabled()
  expect(await screen.findByRole('button', { name: 'Remove Paper A4 from Stock SKU' })).toBeDisabled()
  expect(await screen.findByRole('button', { name: 'Remove Warehouse A from Stock location' })).toBeDisabled()
  expect(choices()).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  fireEvent.click(screen.getByRole('button', { name: 'Create replenishment rule' }))
  await waitForDebounce()
  expect(choices()).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Stock SKU' }))
  await waitFor(() => expect(choices()).toHaveLength(3))
  expect(choices()[2][0]).toBe('/api/procurement/references?site_id=buyer&kind=products&q=')
  const signal = choices()[2][1]!.signal!
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Stock SKU' }), { key: 'Escape' })
  expect(signal.aborted).toBe(true)
  await act(async () => finish(response({ options: [{ id: 'old', label: 'Old SKU' }] })))
  expect(screen.queryByText('Old SKU')).not.toBeInTheDocument()
  // Wait for the nested popover to restore focus before activating another trigger.
  await waitFor(() => expect(screen.getByRole('button', { name: 'Stock SKU' })).toHaveFocus())
  fireEvent.click(screen.getByRole('button', { name: 'Stock location' }))
  await waitFor(() => expect(choices()).toHaveLength(4))
  const locationSignal = choices()[3][1]!.signal!
  denied = true
  act(() => notifyScreenScopeChanged('buyer'))
  expect(locationSignal.aborted).toBe(true)
  await act(async () => finish(response({ options: [{ id: 'old', label: 'Old location' }] })))
  expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden')
  expect(screen.getByRole('button', { name: 'Create replenishment rule' })).toBeDisabled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('Old location')).not.toBeInTheDocument()
  expect(choices()).toHaveLength(4)
})