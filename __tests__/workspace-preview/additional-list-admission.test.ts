/** @jest-environment node */
import { createClient } from '@/lib/supabase/client'
import { workspacePreviewRoute } from '@/app/workspace-preview/routes'
import { PREVIEW_LIMIT, WorkspacePreviewError } from '@/app/workspace-preview/types'
import { actorId, operationsFixture, otherId } from './operations-fixture'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const select = 'rpc/user_can', role = 'rpc/current_user_site_role', location = 'rpc/current_user_has_site_location_restrictions'
const routes = [
  { path: '/order-lines', table: 'sale_order_item_units', gates: [role, location] },
  { path: '/bills', table: 'purchases', gates: [select] },
  { path: '/subscriptions', table: 'subscriptions', gates: [role] },
]

it.each(routes)('$path does not query with a demo/mock client, invalid scope, signed-out or changed identity', async r => {
  const f = operationsFixture(), load = workspacePreviewRoute(r.path, '')!.load
  for (const scope of [{ ...f.input, siteId: 'demo-test' }, { ...f.input, actorId: 'default' }, { ...f.input, signal: AbortSignal.abort() }]) {
    await expect(load(scope)).rejects.toEqual(new WorkspacePreviewError())
  }
  for (const client of [{ _isDemo: true }, { _isMock: true }]) {
    jest.mocked(createClient).mockReturnValueOnce(client)
    await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError())
  }
  expect(f.getUser).not.toHaveBeenCalled()
  for (const user of [null, { id: otherId }, { id: actorId, is_anonymous: true }]) {
    f.getUser.mockResolvedValueOnce({ data: { user }, error: null })
    await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError(true))
  }
  for (const status of [401, 503]) {
    f.getUser.mockResolvedValueOnce({ data: { user: { id: actorId } }, error: { status } })
    await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError(status === 401))
  }
  expect(f.calls).toEqual([])
})

it.each(routes)('$path exposes no rows on denied, unknown, or unavailable admission; no retries or fallback', async r => {
  const load = workspacePreviewRoute(r.path, '')!.load
  for (const [i, gate] of r.gates.entries()) {
    const f = operationsFixture()
    const denial = gate === role ? null : gate === location
    for (const bad of [denial, 'unknown', ...(gate !== role ? [null] : [])]) {
      f.bodies[gate] = bad
      await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError(bad === denial))
      expect(f.paths()).toEqual(r.gates.slice(0, i + 1))
      f.calls.length = 0
    }
    f.failures[gate] = 503
    await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError())
    expect(f.paths()).toEqual(r.gates.slice(0, i + 1))
  }
})

it.each(routes)('$path distinguishes authorized empty, denial, outage and oversized responses', async r => {
  const f = operationsFixture(), load = workspacePreviewRoute(r.path, '')!.load
  f.bodies[r.table] = []
  await expect(load(f.input)).resolves.toEqual([])
  f.bodies[r.table] = Array(PREVIEW_LIMIT + 1).fill({ id: 'unexpected' })
  await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError())
  for (const status of [403, 503]) {
    f.calls.length = 0
    f.failures[r.table] = status
    await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError(status === 403))
    expect(f.paths()).toEqual([...r.gates, r.table])
  }
})

it.each(routes)('$path aborts between admission checks and discards an HTTP response that completes late', async r => {
  const f = operationsFixture(), load = workspacePreviewRoute(r.path, '')!.load
  f.transport.mockImplementationOnce(async () => {
    f.controller.abort()
    return Response.json(r.gates[0] === select ? true : 'owner')
  })
  await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError())
  expect(f.transport).toHaveBeenCalledTimes(1)

  const g = operationsFixture()
  for (const gate of r.gates) g.transport.mockResolvedValueOnce(Response.json(g.bodies[gate]))
  g.transport.mockImplementationOnce(async () => { g.controller.abort(); return Response.json([]) })
  await expect(load(g.input)).rejects.toEqual(new WorkspacePreviewError())
  expect(g.transport).toHaveBeenCalledTimes(r.gates.length + 1)
})