/** @jest-environment node */
import { describeWorkflowOperation } from '@/app/api/workflows/task-connector/descriptor'
jest.mock('@/app/api/workflows/task-connector/descriptor', () => ({ describeWorkflowOperation: jest.fn() }))
import { POST } from '@/app/api/workflows/task-connector/route'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { createServiceClient } from '@/lib/supabase/server'

jest.mock('server-only', () => ({}), { virtual: true })
jest.mock('@/lib/auth/api-site-access', () => ({ requireSiteAccess: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createServiceClient: jest.fn() }))

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const scope = { site_id: uuid(1), instance_id: uuid(2), node_id: uuid(3) }
const actor = uuid(4), digest = 'a'.repeat(64)
const review = { ...scope, digest, toolkit_version: '20261201_02', schema_hash: 'b'.repeat(64), toolkit_slug: 'observatory', operation: 'OBSERVATORY_LIST_STARS', arguments: { limit: 1 }, trigger_id: uuid(6),
  connector_id: uuid(5), principal_id: actor, cron: '0 9 * * *', timezone: 'UTC', published: false }
const choice = { tool_slug: review.operation, arguments: review.arguments }
const pin = { connector_id: uuid(5), ...choice, toolkit_version: review.toolkit_version, toolkit_slug: review.toolkit_slug, schema_hash: review.schema_hash }
const origin = 'https://example.test'
const request = (body: unknown, source = origin) => new Request(`${origin}/api/workflows/task-connector`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', origin: source }, body: JSON.stringify(body),
})
const query = { select: jest.fn(), eq: jest.fn(), abortSignal: jest.fn(), maybeSingle: jest.fn() }
const permit = jest.fn(), rpc = jest.fn(), receipt = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  for (const f of [query.select, query.eq, query.abortSignal]) f.mockReturnValue(query)
  query.maybeSingle.mockResolvedValue({ data: { id: scope.node_id, task_connector_id: pin.connector_id } })
  jest.mocked(describeWorkflowOperation).mockResolvedValue({ descriptor: { ...pin, input_schema: { type: 'object' } } })
  permit.mockResolvedValue({ data: [{ can_view: true, can_manage: true }] })
  jest.mocked(requireSiteAccess).mockResolvedValue({ userId: actor, role: 'owner', userEmail: null,
    supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: actor }, access_token: 'synthetic' } } }) }, from: () => query, rpc: () => ({ abortSignal: permit }) } as never })
  rpc.mockReturnValue({ abortSignal: receipt })
  jest.mocked(createServiceClient).mockResolvedValue({ rpc } as never)
})

it('binds the reviewed snapshot to the authenticated principal and projects only the published contract', async () => {
  receipt.mockResolvedValue({ data: { ...review, published: true, provider_payload: 'private' } })
  const response = await POST(request({ ...scope, ...choice, digest, action: 'publish' }))
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  const json = await response.json()
  expect(json).toMatchObject({ digest, published: true, instance_id: scope.instance_id })
  expect(json.provider_payload).toBeUndefined()
  expect(requireSiteAccess).toHaveBeenCalledWith(expect.anything(), scope.site_id, { requireManager: true })
  expect(query.eq.mock.calls).toEqual([['id', scope.node_id], ['type', 'wf-step'], ['instance_id', scope.instance_id], ['site_id', scope.site_id]])
  expect(rpc).toHaveBeenCalledWith('workflow_connector_publish', { p_instance: scope.instance_id, p_node: scope.node_id, p_actor: actor, p_digest: digest, p_operation: pin })
})

it.each([{ ...choice, action: 'publish', digest, schema_hash: digest }, { ...choice, action: 'review', toolkit_version: 'latest' }, { action: 'claim' }, { action: 'publish' }, { action: 'review', actor },
  { action: 'review', connector_id: uuid(7) }, { action: 'publish', digest, arguments: { limit: 10 } }])(
  'rejects client authority and scheduler operations %p', async fields => {
    expect((await POST(request({ ...scope, ...fields }))).status).toBe(400)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

it('does not call service RPCs across origins, on invisible nodes or for non-managers', async () => {
  const body = { ...scope, action: 'result' }
  expect((await POST(request(body, 'https://foreign.example'))).status).toBe(403)
  query.maybeSingle.mockResolvedValueOnce({ data: null })
  expect((await POST(request(body))).status).toBe(403)
  permit.mockResolvedValueOnce({ data: [{ can_view: true, can_manage: false }] })
  expect((await POST(request(body))).status).toBe(403)
  expect(createServiceClient).not.toHaveBeenCalled()
})

it('reports stale publication and rejects mismatched receipts without exposing upstream errors', async () => {
  receipt.mockResolvedValueOnce({ error: { code: '40001', message: 'private' } })
  expect((await POST(request({ ...scope, ...choice, action: 'publish', digest }))).status).toBe(409)
  receipt.mockResolvedValueOnce({ data: { ...review, principal_id: uuid(9) } })
  expect((await POST(request({ ...scope, ...choice, action: 'review' }))).status).toBe(503)
  const safe = { executed: true, report: { title: 'Result', note: 'Filtered', columns: ['Field','Value'], rows: [['$.name','Sirius']] } }
  receipt.mockResolvedValueOnce({ data: { ...safe, raw: ['private'] } })
  expect(await (await POST(request({ ...scope, action: 'result' }))).json()).toEqual(safe)
})