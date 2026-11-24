/** @jest-environment node */

import { getNavKeyForPath } from '@/lib/auth/screen-access'
import { createClient } from '@/lib/supabase/client'
import { procurementTendersPreview, purchaseRequestsPreview, suppliersPreview } from '@/app/workspace-preview/loaders/buying'
import { PREVIEW_LIMIT, WorkspacePreviewError } from '@/app/workspace-preview/types'
import { actorId, operationsFixture, otherId, siteId } from './operations-fixture'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const supplier = 'rpc/procurement_supplier_can', tender = 'rpc/procurement_tender_access'
const role = 'rpc/current_user_site_role', location = 'rpc/current_user_has_site_location_restrictions', select = 'rpc/user_can'
const scopes = [
  { path: '/suppliers', key: 'suppliers', load: suppliersPreview, gates: [supplier], table: 'suppliers',
    label: 'name', order: 'status.asc,name.asc,id.asc', limit: 11 },
  { path: '/purchases/requests', key: 'purchaseRequests', load: purchaseRequestsPreview, gates: [role, location, select], table: 'procurement_requests',
    label: 'title', order: 'updated_at.desc,id.asc', limit: 9 },
  { path: '/purchases/tenders', key: 'procurementTenders', load: procurementTendersPreview, gates: [tender], table: 'procurement_tenders',
    label: 'title', order: 'updated_at.desc,id.asc', limit: 11 },
]

function fixture() {
  const f = operationsFixture()
  Object.assign(f.bodies, { [supplier]: true, [tender]: true, suppliers: [], procurement_requests: [], procurement_tenders: [] })
  return f
}

it.each(scopes)('$path ($key): the actor is verified and only a bounded GET for id and label follows admission', async r => {
  const f = fixture()
  expect(getNavKeyForPath(r.path, new URLSearchParams())).toBe(r.key)
  f.bodies[r.table] = [{ id: otherId, label: '  Sample  ', company_id: 'private', requester_id: 'private', requirements: ['private'] }]
  await expect(r.load(f.input)).resolves.toEqual([{ id: otherId, label: 'Sample' }])
  expect(f.getUser).toHaveBeenCalledTimes(1)
  expect(f.paths()).toEqual([...r.gates, r.table])
  for (const call of f.calls) {
    expect(call.init?.method).toBe('GET')
    expect(call.init?.signal).toBe(f.input.signal)
    expect(new Headers(call.init?.headers).get('Prefer') || '').not.toContain('count=')
    if (call.path !== r.table) expect(Object.fromEntries(call.params)).toEqual({
      [call.path === tender ? 'p_site' : 'p_site_id']: siteId,
      ...([supplier, tender, select].includes(call.path) && { p_command: 'select' }),
    })
  }
  expect(Object.fromEntries(f.params(r.table))).toEqual({ select: `id,label:${r.label}`, site_id: `eq.${siteId}`, order: r.order, limit: String(r.limit) })
  expect(r.limit + r.gates.length).toBeLessThanOrEqual(PREVIEW_LIMIT)
})

it.each(scopes)('$path never publishes a partial, oversized or malformed result, and does not retry denials or outages', async r => {
  const f = fixture()
  await expect(r.load(f.input)).resolves.toEqual([])
  for (const invalid of [Array.from({ length: r.limit + 1 }, () => ({ id: otherId, label: 'Too many' })),
    null, [null], [{ id: ' ', label: 'No id' }], [{ id: otherId, label: { private: true } }]]) {
    f.bodies[r.table] = invalid
    await expect(r.load(f.input)).rejects.toEqual(new WorkspacePreviewError())
  }
  for (const status of [403, 503]) {
    f.calls.length = 0
    f.failures[r.table] = status
    await expect(r.load(f.input)).rejects.toEqual(new WorkspacePreviewError(status === 403))
    expect(f.paths()).toEqual([...r.gates, r.table])
  }
})

it.each(scopes)('$path: invalid/retired scopes, simulated clients and a different Auth actor cannot start admission', async r => {
  const f = fixture()
  for (const input of [{ ...f.input, siteId: 'demo-site' }, { ...f.input, actorId: 'default' }, { ...f.input, signal: AbortSignal.abort() }]) {
    await expect(r.load(input)).rejects.toEqual(new WorkspacePreviewError())
  }
  for (const flags of [{ _isMock: true }, { _isDemo: true }]) {
    jest.mocked(createClient).mockReturnValueOnce(flags)
    await expect(r.load(f.input)).rejects.toEqual(new WorkspacePreviewError())
  }
  expect(f.getUser).not.toHaveBeenCalled()
  for (const user of [null, { id: otherId }, { id: actorId, is_anonymous: true }]) {
    f.getUser.mockResolvedValueOnce({ data: { user }, error: null })
    await expect(r.load(f.input)).rejects.toEqual(new WorkspacePreviewError(true))
  }
  expect(f.calls).toHaveLength(0)
})

it.each(scopes)('$path does not fall back to a directory read when any required database check fails', async r => {
  const cases = (gate: string) => gate === role ? [null, {}] : [gate === location, null, 'true']
  for (const [index, gate] of r.gates.entries()) {
    for (const value of cases(gate)) {
      const f = fixture()
      f.bodies[gate] = value
      const denied = gate === role ? value === null : typeof value === 'boolean'
      await expect(r.load(f.input)).rejects.toEqual(new WorkspacePreviewError(denied))
      expect(f.paths()).toEqual(r.gates.slice(0, index + 1))
    }
    const f = fixture()
    f.failures[gate] = 503
    await expect(r.load(f.input)).rejects.toEqual(new WorkspacePreviewError())
    expect(f.paths()).toEqual(r.gates.slice(0, index + 1))
  }
})

it('rejects even an empty demo cookie as the buying GETs do; stale real site IDs cannot start reads', async () => {
  const f = fixture()
  Object.defineProperty(globalThis, 'document', { value: { cookie: 'other=1; market_fit_demo_site_id=' }, configurable: true })
  try {
    for (const { load } of scopes) await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError())
    expect(f.getUser).not.toHaveBeenCalled()
    expect(f.calls).toHaveLength(0)
  } finally { Reflect.deleteProperty(globalThis, 'document') }
})

it('does not start a requisition query after cancellation or publish late supplier labels', async () => {
  const f = fixture()
  f.transport.mockImplementationOnce(async () => { f.controller.abort(); return Response.json('owner') })
  await expect(purchaseRequestsPreview(f.input)).rejects.toEqual(new WorkspacePreviewError())
  expect(f.transport).toHaveBeenCalledTimes(1)

  const g = fixture()
  g.transport.mockResolvedValueOnce(Response.json(true)).mockImplementationOnce(async () => {
    g.controller.abort()
    return Response.json([{ id: otherId, label: 'Old workspace' }])
  })
  await expect(suppliersPreview(g.input)).rejects.toEqual(new WorkspacePreviewError())
  expect(g.transport).toHaveBeenCalledTimes(2)
})