/** @jest-environment node */
import { workspacePreviewRoute } from '@/app/workspace-preview/routes'
import { PREVIEW_LIMIT, WorkspacePreviewError } from '@/app/workspace-preview/types'
import { operationsFixture, otherId, siteId } from './operations-fixture'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const role = 'rpc/current_user_site_role', restriction = 'rpc/current_user_has_site_location_restrictions'
const units = 'sale_order_item_units'
const order = { site_id: siteId, order_number: 'SO-134' }
const item = { name: 'Custom assembly', site_id: siteId, sale_orders: order }
const unit = { id: 'unit', site_id: siteId, sale_order_items: item }
const load = workspacePreviewRoute('/order-lines', '')!.load

it('reads a slice of the normal, date-filtered unit page in one data GET after both admission checks', async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 2, 17, 12))
  try {
    const f = operationsFixture()
    f.bodies[units] = [{ ...unit, assigned_to: 'private', amount_due: 200, status: 'preparing' }, { ...unit, id: 'another-unit' }]
    await expect(load(f.input)).resolves.toEqual([
      { id: 'unit', label: item.name, detail: '#SO-134' }, { id: 'another-unit', label: item.name, detail: '#SO-134' },
    ])
    expect(f.getUser).toHaveBeenCalledTimes(1)
    expect(f.paths()).toEqual([role, restriction, units])
    for (const gate of [role, restriction]) expect(Object.fromEntries(f.params(gate))).toEqual({ p_site_id: siteId })
    const p = f.params(units)
    // March crosses a DST boundary in several time zones; these are whole local days.
    expect(p.getAll('created_at')).toEqual([
      `gte.${new Date(2026, 1, 15).toISOString()}`, `lte.${new Date(2026, 2, 17, 23, 59, 59, 999).toISOString()}`,
    ])
    expect(Object.fromEntries(p)).toEqual({
      select: 'id,site_id,sale_order_items!inner(name,site_id,sale_orders!inner(order_number,site_id))',
      site_id: `eq.${siteId}`, 'sale_order_items.site_id': `eq.${siteId}`, 'sale_order_items.sale_orders.site_id': `eq.${siteId}`,
      'sale_order_items.parent_sale_order_item_id': 'is.null', created_at: p.getAll('created_at')[1],
      order: 'created_at.desc,sale_order_item_id.asc,unit_index.asc,id.asc', limit: String(PREVIEW_LIMIT),
    })
    for (const { init } of f.calls) {
      expect(init?.method).toBe('GET'); expect(init?.signal).toBe(f.input.signal)
      expect(new Headers(init?.headers).get('Prefer') || '').not.toContain('count=')
    }
  } finally { jest.useRealTimers() }
})

it('never shows a partial page when a unit or either required parent is missing, ambiguous, malformed or off-site', async () => {
  const f = operationsFixture()
  for (const broken of [null, { ...unit, site_id: otherId }, { ...unit, id: ' ' }, { ...unit, sale_order_items: null },
    { ...unit, sale_order_items: [item] }, { ...unit, sale_order_items: { ...item, site_id: otherId } },
    { ...unit, sale_order_items: { ...item, sale_orders: null } }, { ...unit, sale_order_items: { ...item, sale_orders: [order] } },
    { ...unit, sale_order_items: { ...item, sale_orders: { ...order, site_id: otherId } } },
    { ...unit, sale_order_items: { ...item, sale_orders: { ...order, order_number: {} } } }]) {
    f.bodies[units] = [unit, broken]
    await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError())
  }
})