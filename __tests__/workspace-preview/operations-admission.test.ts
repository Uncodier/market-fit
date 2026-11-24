/** @jest-environment node */

import {
  inventoryMovementsPreview, inventoryTransfersPreview, ordersPreview, reservationsPreview,
  robotsPreview, shipmentsPreview,
} from '@/app/workspace-preview/loaders/operations'
import { WorkspacePreviewError } from '@/app/workspace-preview/types'
import { quotationsPreview } from '@/app/workspace-preview/loaders/finance'
import { operationsFixture, actorId, siteId, otherId } from './operations-fixture'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const role = 'rpc/current_user_site_role', location = 'rpc/current_user_has_site_location_restrictions'
const caps = 'rpc/get_my_site_capabilities'

it('serializes fresh preview Auth across scope changes, without replaying cancelled checks or trusting the prior user', async () => {
  const f = operationsFixture()
  let finish!: () => void
  f.getUser.mockImplementationOnce(() => new Promise(resolve => {
    finish = () => resolve({ data: { user: { id: actorId } }, error: null })
  }))
  const old = expect(ordersPreview(f.input)).rejects.toThrow(WorkspacePreviewError)
  f.controller.abort()
  const skipped = new AbortController()
  const abandoned = expect(quotationsPreview({ ...f.input, siteId: otherId, signal: skipped.signal })).rejects.toThrow(WorkspacePreviewError)
  skipped.abort(); await abandoned
  const current = expect(quotationsPreview({ siteId, actorId: otherId, signal: new AbortController().signal })).rejects.toMatchObject({ denied: true })
  expect(f.getUser).toHaveBeenCalledTimes(1)
  finish(); await Promise.all([old, current])
  expect(f.getUser).toHaveBeenCalledTimes(2); expect(f.calls).toHaveLength(0)
})

it.each([ordersPreview, reservationsPreview, inventoryMovementsPreview, inventoryTransfersPreview, robotsPreview])(
  '%p: a mismatched, signed-out or anonymous Auth user cannot start a module read', async load => {
    const f = operationsFixture()
    for (const user of [{ id: otherId }, null, { id: actorId, is_anonymous: true }]) {
      f.getUser.mockResolvedValueOnce({ data: { user }, error: null })
      await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError(true))
    }
    expect(f.calls).toHaveLength(0)
  },
)

it.each([ordersPreview, reservationsPreview])('%p: checks the actual per-site role; failures do not become rows', async load => {
  const f = operationsFixture()
  f.bodies[role] = null
  await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError(true))
  f.bodies[role] = 'no-role'
  await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError())
  f.failures[role] = 503
  await expect(load(f.input)).rejects.toEqual(new WorkspacePreviewError())
  expect(f.paths().every(name => name.startsWith('rpc/'))).toBe(true)
  expect(f.paths().filter(name => name === role)).toHaveLength(3)
})

it.each([true, null, 'false'])('does not fetch Orders if the site-specific location result is %j', async value => {
  const f = operationsFixture()
  f.bodies[location] = value
  await expect(ordersPreview(f.input)).rejects.toThrow(WorkspacePreviewError)
  expect(f.paths()).toEqual([role, location])
})

it.each([inventoryMovementsPreview, inventoryTransfersPreview])('%p requires explicit user_can(select), not a truthy/role default', async load => {
  const f = operationsFixture()
  for (const value of [false, 'true', null]) {
    f.bodies['rpc/user_can'] = value
    await expect(load(f.input)).rejects.toThrow(WorkspacePreviewError)
  }
  expect(f.paths()).toEqual(Array(3).fill('rpc/user_can'))
  expect(Object.fromEntries(f.params('rpc/user_can'))).toEqual({ p_site_id: siteId, p_command: 'select' })
})

const active = { status: 'active', role: 'collaborator', restrict_to_assigned_only: false }
it.each([
  ['no member', [], { role: 'collaborator', select: true, is_owner: false }],
  ['inactive member', [{ ...active, status: 'pending' }], { role: 'collaborator', select: true, is_owner: false }],
  ['unknown assignment', [{ ...active, restrict_to_assigned_only: null }], { role: 'collaborator', select: true, is_owner: false }],
  ['role mismatch', [active], { role: 'admin', select: true, is_owner: false }],
  ['owner with select denial', [], { role: 'owner', select: false, is_owner: true }],
  ['unknown select', [active], { role: 'collaborator', is_owner: false }],
  ['ambiguous owner', [], { role: 'owner', select: true, is_owner: false }],
  ['role wrapper instead of canonical result', [active], [{ role: 'collaborator', select: true, is_owner: false }]],
])('workflow instance rows stay hidden for %s', async (_why, member, capability) => {
  const f = operationsFixture()
  f.bodies.site_members = member
  f.bodies[caps] = capability
  await expect(robotsPreview(f.input)).rejects.toThrow(WorkspacePreviewError)
  expect(f.paths()).toEqual(['site_members', caps])
  expect(Object.fromEntries(f.params('site_members'))).toEqual({
    select: 'status,role,restrict_to_assigned_only', site_id: `eq.${siteId}`, user_id: `eq.${actorId}`,
  })
})

it.each(['owner', 'marketing', 'assigned'])('workflow preview honors %s visibility and excludes archived instances', async visibility => {
  const f = operationsFixture()
  const owner = visibility === 'owner', memberRole = visibility === 'marketing' ? 'marketing' : 'collaborator'
  f.bodies.site_members = owner ? [] : [{ ...active, role: memberRole, restrict_to_assigned_only: visibility === 'assigned' }]
  f.bodies[caps] = { role: owner ? 'owner' : memberRole, select: true, is_owner: owner }
  f.bodies.remote_instances = [{ id: 'inst', name: 'Label printer', status: 'active', cdp_url: 'private', provider_instance_id: 'private' }]
  await expect(robotsPreview(f.input)).resolves.toEqual([{ id: 'inst', label: 'Label printer', detail: 'Running' }])
  const p = f.params('remote_instances')
  expect(p.get('is_archived')).toBe('eq.false')
  expect(p.get('or')).toBe(visibility === 'assigned' ? `(user_id.eq.${actorId},created_by.eq.${actorId})` : null)
  expect(f.paths()).toEqual(['site_members', caps, 'remote_instances'])
})

it('does not release data or dispatch follow-ups when older auth or PostgREST work settles after cancellation', async () => {
  const f = operationsFixture()
  f.getUser.mockImplementationOnce(async () => {
    f.controller.abort()
    return { data: { user: { id: actorId } }, error: null }
  })
  await expect(robotsPreview(f.input)).rejects.toEqual(new WorkspacePreviewError())
  expect(f.calls).toHaveLength(0)
  const g = operationsFixture()
  g.transport.mockImplementationOnce(async () => {
    g.controller.abort()
    return Response.json([{ id: 'old', tracking_number: 'stale', status: 'shipped' }])
  })
  await expect(shipmentsPreview(g.input)).rejects.toEqual(new WorkspacePreviewError())
})