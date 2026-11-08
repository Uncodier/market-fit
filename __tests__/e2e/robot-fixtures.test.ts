/** @jest-environment node */
import { cleanup, createdId, prepare, validateCreation } from '../../tests/support/robot-fixtures'
import type { Page, Route } from '@playwright/test'

jest.mock('../../tests/support/mutation-fixtures', () => ({
  bindBrowserFixture: jest.fn().mockResolvedValue(undefined),
  fixtureClient: jest.fn(async () => ({ client: mockClient, siteId: 'site', userId: 'user' })),
}))
jest.mock('../../tests/support/mutation-safety', () => ({
  fixtureConnection: () => ({ url: 'http://localhost:54321' }),
  requireUuid: jest.requireActual('../../tests/support/mutation-safety').requireUuid,
}))
const id = '12345678-1234-4234-8234-123456789abc'
const row = { id, site_id: 'site', user_id: 'user', created_by: 'user', name: 'Assistant Session', status: 'pending', instance_type: 'ubuntu' }
let data: unknown[] = []
let error: unknown = null
const mockClient = { from: jest.fn(() => {
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve) }
  return query
}) }
function setup() {
  const store = new Map<string, unknown>()
  const context = { get: (key: string) => store.get(key), set: (key: string, value: unknown) => { store.set(key, value) } }
  let handler!: (route: Route) => Promise<void>
  const post = jest.fn(async () => {
    data = []
    return { ok: () => true, json: async () => ({ success: true, instance_id: id, deleted_requirement_ids: [] }) }
  })
  const page = { route: jest.fn(async (_: string, fn: typeof handler) => { handler = fn }),
    unroute: jest.fn(), goto: jest.fn(), url: () => 'http://localhost:3000/projects?manage=1', request: { post } } as unknown as Page
  const forward = jest.fn(async () => { expect(createdId(context, 0)).toBe(id) })
  const abort = jest.fn()
  const route = { request: () => ({ method: () => 'POST', postDataJSON: () => [row] }), continue: forward, abort } as unknown as Route
  return { context, page, post, forward, abort, send: () => handler(route) }
}
beforeEach(() => { data = []; error = null; jest.clearAllMocks() })

test.each([{ id: undefined }, { id: 'invalid' }, { site_id: 'foreign' }, { user_id: 'foreign' }, { created_by: 'foreign' }, { status: 'running' }])('rejects unsafe insertion %j', patch => {
  expect(() => validateCreation([{ ...row, ...patch }], 'site', 'user')).toThrow()
})
test('journals before forwarding unchanged, then cleans only the exact owned ID via API', async () => {
  const f = setup()
  await prepare(f.page, f.context)
  await f.send()
  expect(f.forward).toHaveBeenCalledTimes(1)
  data = [row]
  await cleanup(f.page, f.context)
  expect(f.post).toHaveBeenCalledWith('/api/robots/instance/delete', expect.objectContaining({ data: { instance_id: id, delete_requirements: true } }))
})
test.each(['existing', 'read-error'])('refuses %s IDs before forwarding', async mode => {
  const f = setup()
  await prepare(f.page, f.context)
  if (mode === 'existing') data = [row]
  else error = new Error('unavailable')
  await f.send()
  expect(f.forward).not.toHaveBeenCalled()
  expect(f.abort).toHaveBeenCalled()
  await expect(cleanup(f.page, f.context)).rejects.toThrow('correlation failed')
  expect(f.post).not.toHaveBeenCalled()
})
test('retains an ambiguous forwarded insert for cleanup', async () => {
  const f = setup()
  await prepare(f.page, f.context)
  f.forward.mockRejectedValueOnce(new Error('connection lost'))
  await f.send()
  data = [row]
  await expect(cleanup(f.page, f.context)).rejects.toThrow('correlation failed')
  expect(f.post).toHaveBeenCalledTimes(1)
})
test('refuses changed ownership and never deletes by name', async () => {
  const f = setup()
  await prepare(f.page, f.context)
  await f.send()
  data = [{ ...row, created_by: 'foreign' }]
  await expect(cleanup(f.page, f.context)).rejects.toThrow('cleanup failed')
  expect(f.post).not.toHaveBeenCalled()
})
test('already absent exact ID requires no deletion', async () => {
  const f = setup()
  await prepare(f.page, f.context)
  await f.send()
  await cleanup(f.page, f.context)
  expect(f.post).not.toHaveBeenCalled()
})


test('rejects a successful-looking API response when the exact row remains', async () => {
  const f = setup()
  await prepare(f.page, f.context)
  await f.send()
  data = [row]
  f.post.mockImplementationOnce(async () => ({
    ok: () => true, json: async () => ({ success: true, instance_id: id, deleted_requirement_ids: [] }),
  }))
  await expect(cleanup(f.page, f.context)).rejects.toThrow('cleanup failed')
})
