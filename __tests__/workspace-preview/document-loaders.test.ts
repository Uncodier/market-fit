/** @jest-environment node */
import { workspacePreviewRoute } from '@/app/workspace-preview/routes'
import { PREVIEW_LIMIT, WorkspacePreviewError } from '@/app/workspace-preview/types'
import { operationsFixture, otherId, siteId } from './operations-fixture'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const select = 'rpc/user_can', role = 'rpc/current_user_site_role'
const base = { id: 'doc', site_id: siteId, created_at: '2026-05-31T01:23:45.123456Z' }
const bill = { ...base, purchase_date: '2026-05-30', title: 'Replacement parts', status: 'draft' }
const sub = { ...base, plan: { site_id: siteId, name: 'Maintenance' }, status: 'paused' }
const routes = [
  { path: '/bills', table: 'purchases', gate: select, row: bill,
    columns: 'id,site_id,title,status,purchase_date,created_at', order: 'purchase_date.desc,created_at.desc',
    output: { id: bill.id, label: bill.title, detail: bill.status } },
  { path: '/subscriptions', table: 'subscriptions', gate: role, row: sub,
    columns: 'id,site_id,status,created_at,plan:catalog_items(name,site_id)', order: 'created_at.desc',
    output: { id: sub.id, label: sub.plan.name, detail: sub.status } },
]

it.each(routes)('$path uses its own admission and default list order; no count, money, customers or tokens', async r => {
  const f = operationsFixture()
  f.bodies[r.table] = [{ ...r.row, lead: { email: 'hidden' }, vendor: { name: 'hidden' }, amount_due: 567,
    payments: [], public_access_token: 'hidden', pendingInvoices: [{ title: 'hidden' }] }]
  await expect(workspacePreviewRoute(r.path, '')!.load(f.input)).resolves.toEqual([r.output])
  expect(f.getUser).toHaveBeenCalledTimes(1)
  expect(f.paths()).toEqual([r.gate, r.table])
  expect(Object.fromEntries(f.params(r.gate))).toEqual({ p_site_id: siteId, ...(r.gate === select && { p_command: 'select' }) })
  expect(Object.fromEntries(f.params(r.table))).toEqual({ site_id: `eq.${siteId}`, select: r.columns, order: r.order,
    limit: String(PREVIEW_LIMIT), ...(r.table === 'subscriptions' && { 'plan.site_id': `eq.${siteId}` }) })
  for (const { init } of f.calls) {
    expect(init?.method).toBe('GET'); expect(init?.signal).toBe(f.input.signal)
    expect(new Headers(init?.headers).get('Prefer') || '').not.toContain('count=')
  }
})

it('keeps a visible subscription with an RLS-hidden plan; never substitutes a lead, email, or foreign plan', async () => {
  const f = operationsFixture(), load = workspacePreviewRoute('/subscriptions', '')!.load
  f.bodies.subscriptions = [{ ...sub, plan: null, lead: { email: 'hidden' } }]
  await expect(load(f.input)).resolves.toEqual([{ id: sub.id, label: '—', detail: 'paused' }])
  for (const plan of [undefined, { name: 'Other site', site_id: otherId }, [{ name: 'Ambiguous', site_id: siteId }], { site_id: siteId }]) {
    f.bodies.subscriptions = [{ ...sub, plan }]
    await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError())
  }
})

it.each(routes)('$path withholds a tie that could straddle the full list page; never reports unknown as empty', async r => {
  const f = operationsFixture(), load = workspacePreviewRoute(r.path, '')!.load
  const tie = Array.from({ length: PREVIEW_LIMIT }, (_, i) => ({ ...r.row, id: `tied-${i}` }))
  f.bodies[r.table] = [{ ...r.row, created_at: '2026-06-02T00:00:00Z' }, ...tie.slice(1)]
  await expect(load(f.input)).resolves.toEqual([r.output])
  f.bodies[r.table] = tie
  await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError())
  f.bodies[r.table] = tie.slice(0, 2)
  await expect(load(f.input)).resolves.toEqual([0, 1].map(i => ({ ...r.output, id: `tied-${i}` })))
})

it('does not collapse separate bill dates just because the bills were created in one import', async () => {
  const f = operationsFixture()
  f.bodies.purchases = [bill, ...Array.from({ length: PREVIEW_LIMIT - 1 }, (_, i) => ({ ...bill, id: `old-${i}`, purchase_date: '2026-05-29' }))]
  await expect(workspacePreviewRoute('/bills', '')!.load(f.input)).resolves.toEqual([routes[0].output])
})

it.each(routes)('$path rejects a partial, malformed or off-site response instead of rendering valid-looking rows', async r => {
  const f = operationsFixture(), load = workspacePreviewRoute(r.path, '')!.load
  for (const entry of [null, { ...r.row, site_id: otherId }, { ...r.row, id: ' ' }, { ...r.row, status: { private: true } },
    { ...r.row, created_at: 'invalid' }, r.table === 'purchases' ? { ...bill, purchase_date: null } : { ...sub, plan: {} }]) {
    f.bodies[r.table] = [r.row, entry]
    await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError())
  }
})