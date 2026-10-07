/** @jest-environment node */
import { readFileSync } from 'fs'
import path from 'path'
import { checkSiteSetup, startSiteSetup, SETUP_UNCONFIRMED_MESSAGE } from '@/app/create-site/start-site-setup'

const siteId = '00000000-0000-4000-8000-000000000001'
const workflowId = `site-setup-${siteId}-1791331200000`
const response = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => body }) as Response

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(fetch).mockReset()
})
afterEach(() => jest.restoreAllMocks())

it('starts optional setup with the user session, not browser API keys', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ success: true, data: { workflow_id: workflowId, setup_status: 'pending' } }))
  expect((await startSiteSetup(siteId)).status).toBe('pending')
  expect(fetch).toHaveBeenCalledWith('/api/site/setup', expect.objectContaining({
    method: 'POST', credentials: 'same-origin', body: JSON.stringify({ site_id: siteId }), signal: expect.any(AbortSignal),
  }))
  const source = readFileSync(path.join(process.cwd(), 'app/create-site/page.tsx'), 'utf8')
  expect(source).toContain('void siteSetupStore.launch(user.id, newSite.id)')
  expect(source).not.toMatch(/NEXT_PUBLIC_API_KEY|NEXT_PUBLIC_API_SECRET|postWithApiKeys/)
})

it('does not block successful site creation or replay failed setup', async () => {
  jest.mocked(fetch).mockRejectedValueOnce(new Error('private backend details'))
  await expect(startSiteSetup(siteId)).resolves.toMatchObject({ status: 'unconfirmed', message: SETUP_UNCONFIRMED_MESSAGE })
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('retains a safe workflow identifier for manually checking ambiguous launch', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ success: false, error: { message: 'private backend details' },
    data: { workflow_id: workflowId, setup_status: 'unconfirmed' } }, false))
  expect(await startSiteSetup(siteId)).toMatchObject({ status: 'unconfirmed', workflowId, message: SETUP_UNCONFIRMED_MESSAGE })
  expect(fetch).toHaveBeenCalledTimes(1)
  jest.mocked(fetch).mockResolvedValue(response({ success: true, data: { workflow_id: workflowId, setup_status: 'partial' } }))
  expect((await checkSiteSetup(siteId, workflowId)).status).toBe('partial')
  expect(jest.mocked(fetch).mock.calls[1][1]?.method).toBe('GET')
})

it('rejects ambiguous success without valid execution identity and exposes no raw detail', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ success: true, data: { secret: 'private' } }))
  expect(await startSiteSetup(siteId)).toMatchObject({ status: 'unconfirmed', message: SETUP_UNCONFIRMED_MESSAGE })
})

it('retains a separately valid workflow ID when the launch DTO cannot be parsed', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ success: true,
    data: { workflow_id: workflowId, setup_status: 'private unknown value', step_causes: null } }))
  expect(await startSiteSetup(siteId)).toMatchObject({ status: 'unconfirmed', workflowId, message: SETUP_UNCONFIRMED_MESSAGE })
})

it('retains the known workflow ID through malformed status JSON and request errors', async () => {
  jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('private') } } as unknown as Response)
  expect(await checkSiteSetup(siteId, workflowId)).toMatchObject({ status: 'unconfirmed', workflowId })
  jest.mocked(fetch).mockRejectedValueOnce(new Error('private'))
  expect(await checkSiteSetup(siteId, workflowId)).toMatchObject({ status: 'unconfirmed', workflowId })
  expect(jest.mocked(fetch).mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true)
})

it('does not fetch for invalid IDs or a workflow belonging to another site', async () => {
  await startSiteSetup('not-a-site')
  await checkSiteSetup('00000000-0000-4000-8000-000000000002', workflowId)
  await checkSiteSetup(siteId, 'site-setup--------------------------------------1')
  expect(fetch).not.toHaveBeenCalled()
})

it('keeps a known ID and reports unconfirmed for a mismatched status response', async () => {
  jest.mocked(fetch).mockResolvedValue(response({ success: true,
    data: { workflow_id: `${workflowId}1`, setup_status: 'complete' } }))
  expect(await checkSiteSetup(siteId, workflowId)).toMatchObject({ status: 'unconfirmed', workflowId })
})

it.each(['setup_email_delivery_unconfirmed', 'setup_email_service_unconfigured'])(
  'maps allowlisted setup email cause %s to safe feedback', async cause => {
    jest.mocked(fetch).mockResolvedValue(response({ success: true, data: {
      workflow_id: workflowId, setup_status: 'partial', step_causes: { follow_up_email: cause },
    } }))
    expect(await checkSiteSetup(siteId, workflowId)).toMatchObject({ status: 'partial', workflowId, detail: cause })
  })