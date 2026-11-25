/** @jest-environment node */
import { describeWorkflowOperation } from '@/app/api/workflows/task-connector/descriptor'
jest.mock('server-only', () => ({}), { virtual: true })
const input = { site_id: '00000000-0000-4000-8000-000000000001', connector_id: '00000000-0000-4000-8000-000000000002', tool_slug: 'NATIVE_LIST', arguments: { limit: 2 } }
const dto = { ...input, toolkit_slug: 'native', toolkit_version: '20270101_01', schema_hash: '1'.repeat(64), input_schema: { type: 'object' } }
const req = new Request('https://web.example.test/api/workflows/task-connector')
const originalUrl = process.env.API_SERVER_URL
const originalFetch = global.fetch
beforeEach(() => { process.env.API_SERVER_URL = 'https://orchestrator.example.test'; global.fetch = jest.fn() })
afterEach(() => { global.fetch = originalFetch; if (!originalUrl) delete process.env.API_SERVER_URL; else process.env.API_SERVER_URL = originalUrl })
it('sends the requested arguments to the configured server, never a client URL; projects only pinned metadata', async () => {
  jest.mocked(fetch).mockResolvedValue(Response.json({ ...dto, credential: 'ignored' }))
  const result = await describeWorkflowOperation(req, 'synthetic', input)
  expect(fetch).toHaveBeenCalledWith(new URL('/api/connectors/workflow-operation', process.env.API_SERVER_URL), expect.objectContaining({
    method: 'POST', redirect: 'error', cache: 'no-store', headers: { authorization: 'Bearer synthetic', 'content-type': 'application/json' }, body: JSON.stringify(input),
  }))
  expect(result).toEqual({ descriptor: { connector_id: input.connector_id, tool_slug: input.tool_slug, toolkit_slug: 'native', toolkit_version: dto.toolkit_version, schema_hash: dto.schema_hash, input_schema: dto.input_schema } })
})
it.each([{connector_id:input.site_id},{tool_slug:'NATIVE_OTHER'}, {toolkit_version:'latest'}, {schema_hash:'invalid'}])('rejects mismatched or unpinned descriptors %j',async patch => {
  jest.mocked(fetch).mockResolvedValue(Response.json({...dto,...patch})); expect(await describeWorkflowOperation(req,'synthetic',input)).toEqual({status:503})
})
it('does not expose provider errors and does not fall back to a different connection',async () => {
  jest.mocked(fetch).mockResolvedValue(Response.json({error:'private details'}, {status:403})); expect(await describeWorkflowOperation(req,'synthetic',input)).toEqual({status:403}); expect(fetch).toHaveBeenCalledTimes(1)
})
