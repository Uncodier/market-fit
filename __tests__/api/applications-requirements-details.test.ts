/** @jest-environment node */
import { POST } from '@/app/api/applications/requirements-details/route'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isValidApiKey } from '@/app/lib/api-keys-config'

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn(), createServiceClient: jest.fn() }))
jest.mock('@/app/lib/api-keys-config', () => ({ getApiKeyFromRequest: jest.fn(), isValidApiKey: jest.fn() }))

const reqId = '00000000-0000-4000-8000-000000000001'
const req2 = '00000000-0000-4000-8000-000000000002'
const rows = [
  { requirement_id: reqId, repo_url: 'new-repo', preview_url: null, source_code: 'source', instance_id: null },
  { requirement_id: reqId, repo_url: 'old-repo', preview_url: 'preview', source_code: null, instance_id: 'instance-1' },
  { requirement_id: req2, repo_url: 'another-repo', preview_url: null, source_code: null, instance_id: 'instance-2' },
]
function setup(user: { id: string } | null = { id: 'actor' }) {
  const statuses = { select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: rows }) }
  const logs = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue({ data: [{ message: 'Latest', created_at: '2026-01-01' }] }) }
  const client = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) },
    from: jest.fn((table: string) => table === 'requirement_status' ? statuses : logs) }
  jest.mocked(createClient).mockResolvedValue(client as never)
  return { client, logs, statuses }
}
const request = (body: unknown) => new Request('https://example.test/api/applications/requirements-details', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})
beforeEach(() => { jest.clearAllMocks(); jest.mocked(isValidApiKey).mockReturnValue(false) })

it.each([true, false])('preserves status history and fetches latest logs only if consumed (include=%s)', async include => {
  const { client, logs, statuses } = setup()
  const res = await POST(request({ requirementIds: [reqId, req2, reqId], ...(include ? {} : { includeLatestLog: false }) }))
  expect(res.status).toBe(200)
  expect(client.auth.getUser).toHaveBeenCalledTimes(1)
  expect(createServiceClient).not.toHaveBeenCalled()
  expect(statuses.in).toHaveBeenCalledWith('requirement_id', [reqId, req2])
  expect(statuses.order).toHaveBeenCalledWith('created_at', { ascending: false })
  expect(client.from.mock.calls.filter(([table]) => table === 'instance_logs')).toHaveLength(include ? 2 : 0)
  if (include) {
    expect(logs.eq.mock.calls).toEqual([['instance_id', 'instance-1'], ['instance_id', 'instance-2']])
    expect(logs.limit).toHaveBeenCalledWith(1)
  }
  const { details } = await res.json()
  expect(details[reqId]).toEqual({ repo_url: 'new-repo', source_code: 'source', preview_url: 'preview', instance_id: 'instance-1',
    last_instance_log: include ? { message: 'Latest', created_at: '2026-01-01' } : null })
})

it('the link-only projection cannot bypass auth or broaden a hidden RLS result', async () => {
  const denied = setup(null)
  expect((await POST(request({ requirementIds: [reqId], includeLatestLog: false }))).status).toBe(401)
  expect(denied.client.from).not.toHaveBeenCalled()
  const { statuses } = setup()
  statuses.order.mockResolvedValue({ data: [], error: null })
  const res = await POST(request({ requirementIds: [reqId], includeLatestLog: false }))
  expect((await res.json()).details[reqId]).toEqual({ repo_url: null, source_code: null, preview_url: null, instance_id: null, last_instance_log: null })
  expect(createServiceClient).not.toHaveBeenCalled()
})

it.each([{ requirementIds: ['not-an-id'] }, { requirementIds: [reqId], includeLatestLog: 'false' }])('rejects malformed requests without reading tables', async body => {
  const { client } = setup()
  expect((await POST(request(body))).status).toBe(400)
  expect(client.from).not.toHaveBeenCalled()
})