/** @jest-environment node */

import { createClient } from '@/lib/supabase/client'
import { ordersDateRangeStorageKey } from '@/app/orders/date-range-cache'
import {
  inventoryMovementsPreview, inventoryPreview, inventoryTransfersPreview, ordersPreview,
  reservationsPreview, robotsPreview, shipmentsPreview,
} from '@/app/workspace-preview/loaders/operations'
import { PREVIEW_LIMIT, WorkspacePreviewError, type WorkspacePreviewLoader } from '@/app/workspace-preview/types'
import { operationsFixture, otherId, siteId } from './operations-fixture'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const fullSite = 'rpc/current_user_site_role', location = 'rpc/current_user_has_site_location_restrictions'
const select = 'rpc/user_can'
const readers: Array<{
  name: string; load: WorkspacePreviewLoader; liveAuth: boolean; gates: string[];
  reads: Array<[string, string, string, number]>;
}> = [
  { name: 'orders', load: ordersPreview, liveAuth: true, gates: [fullSite, location], reads: [
    ['sale_orders', 'id,order_number,status', 'created_at.desc,id.asc', 12],
  ] },
  { name: 'inventory', load: inventoryPreview, liveAuth: false, gates: [], reads: [
    ['inventory_levels', 'id,quantity,catalog_items!inner(name)', 'updated_at.desc,id.asc', 12],
  ] },
  { name: 'shipments', load: shipmentsPreview, liveAuth: false, gates: [], reads: [
    ['shipments', 'id,tracking_number,status', 'created_at.desc,id.asc', 12],
  ] },
  { name: 'transfers', load: inventoryTransfersPreview, liveAuth: true, gates: [select], reads: [
    ['inventory_transfer_orders', 'id,status', 'created_at.desc,id.asc', 12],
  ] },
  { name: 'ledger', load: inventoryMovementsPreview, liveAuth: true, gates: [select], reads: [
    ['inventory_movements', 'id,item_name,kind,created_at', 'created_at.desc,id.asc', 6],
    ['inventory_transfer_stock_events', 'id,item_name,kind:action,created_at', 'created_at.desc,id.asc', 6],
  ] },
  { name: 'reservations', load: reservationsPreview, liveAuth: true, gates: [fullSite], reads: [
    ['reservations', 'id,start_time,status', 'start_time.desc,id.asc', 12],
  ] },
  { name: 'workflow instances', load: robotsPreview, liveAuth: true, gates: ['site_members', 'rpc/get_my_site_capabilities'], reads: [
    ['remote_instances', 'id,name,status', 'updated_at.desc,id.asc', 12],
  ] },
]

// A read-only browser date preference, alongside Node's real Fetch API classes.
const getItem = jest.fn<(string | null), [string]>()
const root = { lang: 'en' }
beforeEach(() => {
  jest.clearAllMocks()
  getItem.mockReset().mockReturnValue(null)
  root.lang = 'en'
  Object.defineProperty(globalThis, 'window', { value: { localStorage: { getItem } }, configurable: true })
  Object.defineProperty(globalThis, 'document', { value: { documentElement: root }, configurable: true })
  jest.useFakeTimers().setSystemTime(new Date(2026, 6, 15, 12))
})
afterEach(() => {
  jest.useRealTimers()
  Reflect.deleteProperty(globalThis, 'window'); Reflect.deleteProperty(globalThis, 'document')
})

it.each(readers)('$name: actual SDK requests have fixed projections, scope, order, no count and a total bound of twelve', async r => {
  const f = operationsFixture()
  await expect(r.load(f.input)).resolves.toEqual([])
  expect(f.paths()).toEqual([...r.gates, ...r.reads.map(([table]) => table)])
  expect(f.getUser).toHaveBeenCalledTimes(r.liveAuth ? 1 : 0)
  for (const call of f.calls) {
    expect(call.init?.method).toBe('GET')
    expect(call.init?.signal).toBe(f.input.signal)
    expect(new Headers(call.init?.headers).get('Prefer') || '').not.toContain('count=')
    if (call.path.startsWith('rpc/')) expect(call.params.get('p_site_id')).toBe(siteId)
  }
  for (const [table, projection, ordering, limit] of r.reads) {
    const p = f.params(table)
    expect([p.get('site_id'), p.get('select'), p.get('order'), p.get('limit')]).toEqual([
      `eq.${siteId}`, projection, ordering, String(limit),
    ])
  }
  expect(r.reads.reduce((n, [, , , limit]) => n + limit, 0)).toBe(PREVIEW_LIMIT)
  if (r.gates.includes(select)) expect(f.params(select).get('p_command')).toBe('select')
})

it('restores the Orders default and a locale-specific relative week using local day boundaries', async () => {
  const f = operationsFixture()
  const atEnd = new Date(2026, 6, 15, 23, 59, 59, 999).toISOString()
  await ordersPreview(f.input)
  expect(f.params('sale_orders').getAll('created_at')).toEqual([
    `gte.${new Date(2026, 5, 16).toISOString()}`, `lte.${atEnd}`,
  ])
  root.lang = 'fr'
  getItem.mockReturnValue(JSON.stringify({ startDate: '2020-01-01', endDate: '2020-01-02', preset: 'thisWeek' }))
  f.calls.length = 0
  await ordersPreview(f.input)
  expect(f.params('sale_orders').getAll('created_at')).toEqual([
    `gte.${new Date(2026, 6, 13).toISOString()}`, `lte.${atEnd}`,
  ])
  expect(getItem.mock.calls).toEqual([[ordersDateRangeStorageKey(siteId)], [ordersDateRangeStorageKey(siteId)]])
})

it('preserves fixed and explicitly cleared Orders filters, and never emits customer or payment fields', async () => {
  const f = operationsFixture()
  const range = { startDate: '2020-05-05T14:30:00.000Z', endDate: '2020-05-06T18:10:00.000Z', preset: 'custom' }
  getItem.mockReturnValueOnce(JSON.stringify(range)).mockReturnValueOnce('null')
  f.bodies.sale_orders = [{ id: 'o1', order_number: 'SO-1', status: 'pending', payments: [{ customer: 'Private' }] }]
  await expect(ordersPreview(f.input)).resolves.toEqual([{ id: 'o1', label: 'SO-1', detail: 'pending' }])
  expect(f.params('sale_orders').getAll('created_at')).toEqual([`gte.${range.startDate}`, `lte.${range.endDate}`])
  f.calls.length = 0
  await ordersPreview(f.input)
  expect(f.params('sale_orders').has('created_at')).toBe(false)
})

it('restricts the bare Reservations preview to active rows overlapping this local calendar month, including open ends', async () => {
  const f = operationsFixture()
  const start = new Date(2026, 6, 1).toISOString(), end = new Date(2026, 7, 1).toISOString()
  f.bodies.reservations = [{ id: 'r1', start_time: start, status: 'confirmed', notes: 'private', signature_url: 'private' }]
  await expect(reservationsPreview(f.input)).resolves.toEqual([{ id: 'r1', label: start, detail: 'confirmed' }])
  const p = f.params('reservations')
  expect([p.get('start_time'), p.get('or'), p.get('status')]).toEqual([
    `lt.${end}`, `(end_time.is.null,end_time.gt.${start})`, 'neq.cancelled',
  ])
  expect(f.paths()).toEqual([fullSite, 'reservations'])
})

it('requires a visible same-site catalog item for a stock level; does not read locations or settings', async () => {
  const f = operationsFixture()
  f.bodies.inventory_levels = [
    { id: 'l1', quantity: 0, catalog_items: { name: 'Sprocket' }, notes: 'private' },
    { id: 'l2', quantity: 5, catalog_items: [{ name: 'Washer' }] },
  ]
  await expect(inventoryPreview(f.input)).resolves.toEqual([
    { id: 'l1', label: 'Sprocket', detail: 'On hand: 0' }, { id: 'l2', label: 'Washer', detail: 'On hand: 5' },
  ])
  expect(f.paths()).toEqual(['inventory_levels'])
  expect(f.params('inventory_levels').get('catalog_items.site_id')).toBe(`eq.${siteId}`)
})

it('combines both bounded stock sources, sorting real dates with an ID tie-break, without notes, people or lines', async () => {
  const f = operationsFixture()
  const a = { id: 'a', item_name: 'Caster', kind: 'receipt', created_at: '2026-05-06T10:00:00Z' }
  const b = { ...a, id: 'b', kind: 'receive', actor_id: 'private' }
  const c = { ...a, id: 'c', kind: 'dispatch', created_at: '2026-05-06T09:30:00-02:00' }
  f.bodies.inventory_movements = [a]
  f.bodies.inventory_transfer_stock_events = [c, b]
  await expect(inventoryMovementsPreview(f.input)).resolves.toEqual([
    { id: 'c', label: 'Caster', detail: 'dispatch' }, { id: 'a', label: 'Caster', detail: 'receipt' },
    { id: 'b', label: 'Caster', detail: 'receive' },
  ])
  f.failures.inventory_transfer_stock_events = 503
  await expect(inventoryMovementsPreview(f.input)).rejects.toThrow(WorkspacePreviewError)
})

it('returns identities and status, not private shipment destinations or transfer data', async () => {
  const f = operationsFixture()
  f.bodies.shipments = [{ id: 's1', tracking_number: 'TEST-1', status: 'shipped', address: 'private', lead: { email: 'private' } }]
  f.bodies.inventory_transfer_orders = [{ id: 'a1234567-xxxx', status: 'in_transit', notes: 'private revision' }]
  await expect(shipmentsPreview(f.input)).resolves.toEqual([{ id: 's1', label: 'TEST-1', detail: 'shipped' }])
  await expect(inventoryTransfersPreview(f.input)).resolves.toEqual([{ id: 'a1234567-xxxx', label: 'Transfer a1234567', detail: 'In transit' }])
})

it.each(readers)('$name rejects invalid input, mock/demo clients, cancelled reads and out-of-budget data', async r => {
  const f = operationsFixture()
  await expect(r.load({ ...f.input, siteId: 'demo-example' })).rejects.toThrow(WorkspacePreviewError)
  await expect(r.load({ ...f.input, actorId: 'default' })).rejects.toThrow(WorkspacePreviewError)
  jest.mocked(createClient).mockReturnValueOnce({ _isMock: true })
  await expect(r.load(f.input)).rejects.toThrow(WorkspacePreviewError)
  const aborted = new AbortController(); aborted.abort()
  await expect(r.load({ ...f.input, signal: aborted.signal })).rejects.toThrow(WorkspacePreviewError)
  expect(f.getUser).not.toHaveBeenCalled(); expect(f.calls).toHaveLength(0)
  const [[table, , , limit]] = r.reads
  f.bodies[table] = Array.from({ length: limit + 1 }, () => ({ id: otherId }))
  await expect(r.load(f.input)).rejects.toEqual(new WorkspacePreviewError())
})