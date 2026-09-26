const getSession = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getSession: () => getSession() } }) }))

function jsonResponse() {
  return { ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => '{"success":true}' }
}

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  getSession.mockResolvedValue({ data: { session: { access_token: 'test-token' } } })
  ;(fetch as jest.Mock).mockResolvedValue(jsonResponse())
})

it('uses the existing same-origin assistant proxy even with a localhost API configured', async () => {
  const previous = process.env.NEXT_PUBLIC_API_SERVER_URL
  process.env.NEXT_PUBLIC_API_SERVER_URL = 'http://localhost:3001'
  try {
    const { apiClient } = await import('@/app/services/api-client-service')
    await apiClient.post('/api/robots/instance/assistant', { site_id: 'site' })
    expect(fetch).toHaveBeenCalledWith('/api/robots/instance/assistant', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }))
    await apiClient.post('/api/workflow/promptRobot', {})
    expect(fetch).toHaveBeenLastCalledWith('http://localhost:3001/api/workflow/promptRobot', expect.anything())
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
    else process.env.NEXT_PUBLIC_API_SERVER_URL = previous
  }
})

it('bounds stalled auth and returns a visible failure without issuing a request', async () => {
  jest.useFakeTimers()
  try {
    getSession.mockImplementation(() => new Promise(() => {}))
    const { apiClient } = await import('@/app/services/api-client-service')
    const pending = apiClient.post('/api/robots/instance/assistant', {})
    await jest.advanceTimersByTimeAsync(10_000)
    await expect(pending).resolves.toMatchObject({ success: false, retryable: false, error: { message: expect.stringContaining('session timed out') } })
    expect(fetch).not.toHaveBeenCalled()
  } finally { jest.useRealTimers() }
})

it('never retries an ambiguous assistant network failure', async () => {
  ;(fetch as jest.Mock).mockRejectedValue(new TypeError('Failed to fetch'))
  const { apiClient } = await import('@/app/services/api-client-service')
  await expect(apiClient.post('/api/robots/instance/assistant', {})).resolves.toMatchObject({ success: false, retryable: false })
})

it.each([
  [409, 'ASSISTANT_EXECUTION_BUSY'],
  [503, 'ASSISTANT_CAPACITY_FULL'],
  [503, 'ASSISTANT_ADMISSION_UNAVAILABLE'],
])('preserves the admission error contract for HTTP %s / %s', async (status, code) => {
  const error = { code, message: 'The request was not admitted.' }
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: false, status, headers: { get: () => 'application/json' },
    text: async () => JSON.stringify({ success: false, error, execution_started: false }),
  })
  const { apiClient } = await import('@/app/services/api-client-service')
  await expect(apiClient.post('/api/robots/instance/assistant', {})).resolves.toMatchObject({
    success: false, status, error, execution_started: false,
  })
})

it.each([false, true, 'false', undefined])('preserves only boolean execution_started values: %s', async execution_started => {
  const { handleApiResponse } = await import('@/app/services/api-client-response')
  const response = {
    ...jsonResponse(),
    text: async () => JSON.stringify({ success: false, error: { code: 'ASSISTANT_CAPACITY_FULL', message: 'Full' }, execution_started }),
  }
  const result = await handleApiResponse(response as unknown as Response)
  expect(result.execution_started).toBe(typeof execution_started === 'boolean' ? execution_started : undefined)
})