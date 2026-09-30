export {}

const getSession = jest.fn()
jest.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getSession } }) }))

const originalApi = process.env.NEXT_PUBLIC_API_SERVER_URL
const apiUrl = 'https://api.example.test'

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_API_SERVER_URL = apiUrl
  getSession.mockResolvedValue({ data: { session: { access_token: 'user-token' } }, error: null })
  jest.mocked(fetch).mockReset().mockResolvedValue({
    ok: true, status: 200, headers: { get: () => 'application/json' }, text: async () => '{"success":true}',
  } as unknown as Response)
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
  if (originalApi === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
  else process.env.NEXT_PUBLIC_API_SERVER_URL = originalApi
})

it.each(['get', 'post', 'put', 'patch', 'delete'] as const)(
  'never sends an anonymous private %s request, even with a legacy opt-out', async method => {
    getSession.mockResolvedValue({ data: { session: null }, error: null })
    const { apiClient } = await import('@/app/services/api-client-service')
    const result = method === 'get' || method === 'delete'
      ? await apiClient[method]('/api/workflow/example', { includeAuth: false })
      : await apiClient[method]('/api/workflow/example', {}, { includeAuth: false })
    expect(result).toMatchObject({ success: false, error: { message: expect.stringContaining('Please sign in') } })
    expect(fetch).not.toHaveBeenCalled()
  },
)

it('rejects a session result accompanied by an auth error', async () => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'stale-token' } }, error: { message: 'expired' } })
  const { apiClient } = await import('@/app/services/api-client-service')
  expect(await apiClient.post('/api/workflow/analyzeSite', {})).toMatchObject({ success: false })
  expect(fetch).not.toHaveBeenCalled()
})

it.each([
  'https://third-party.example/api/workflow/run',
  '//third-party.example/api/workflow/run',
  'http://api.example.test/api/workflow/run',
  'https://user:secret@api.example.test/api/workflow/run',
])('never leaks the session token to an untrusted destination: %s', async endpoint => {
  const { apiClient } = await import('@/app/services/api-client-service')
  expect(await apiClient.post(endpoint, {})).toMatchObject({ success: false })
  expect(getSession).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})

it('does not follow redirects with the user credentials', async () => {
  const { apiClient } = await import('@/app/services/api-client-service')
  await apiClient.post('/api/workflow/analyzeSite', {})
  expect(fetch).toHaveBeenCalledWith(`${apiUrl}/api/workflow/analyzeSite`, expect.objectContaining({
    redirect: 'error', headers: expect.objectContaining({ Authorization: 'Bearer user-token' }),
  }))
})

it('keeps site setup on the app origin and ignores a forged authorization header', async () => {
  const { apiClient } = await import('@/app/services/api-client-service')
  await apiClient.post('/api/site/setup', { site_id: 'site-1' }, {
    headers: { authorization: 'Bearer forged' }, includeAuth: false,
  })
  expect(fetch).toHaveBeenCalledWith('/api/site/setup', expect.objectContaining({
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer user-token' },
  }))
})

it('keeps explicit public status and third-party reads anonymous', async () => {
  const { apiClient } = await import('@/app/services/api-client-service')
  for (const endpoint of ['/api/status', '/api/public/posts', 'https://third-party.example/api/public/data']) {
    expect(await apiClient.get(endpoint, { includeAuth: false })).toMatchObject({ success: true })
  }
  expect(getSession).not.toHaveBeenCalled()
  for (const [, options] of jest.mocked(fetch).mock.calls) expect(options?.headers).not.toHaveProperty('Authorization')
})

it('rejects anonymous third-party requests carrying caller-supplied credentials', async () => {
  const { apiClient } = await import('@/app/services/api-client-service')
  expect(await apiClient.get('https://third-party.example/api/data', {
    includeAuth: false, headers: { authorization: 'Bearer private' },
  })).toMatchObject({ success: false })
  expect(fetch).not.toHaveBeenCalled()
})

it('does not treat a public-sounding generation endpoint as anonymous', async () => {
  getSession.mockResolvedValue({ data: { session: null }, error: null })
  const { apiClient } = await import('@/app/services/api-client-service')
  expect(await apiClient.post('/api/public/image/sign', {}, { includeAuth: false })).toMatchObject({ success: false })
  expect(fetch).not.toHaveBeenCalled()
})

it('does not send a token even when an insecure external API origin is configured', async () => {
  process.env.NEXT_PUBLIC_API_SERVER_URL = 'http://api.example.test'
  const { apiClient } = await import('@/app/services/api-client-service')
  expect(await apiClient.post('/api/workflow/analyzeSite', {})).toMatchObject({ success: false })
  expect(getSession).not.toHaveBeenCalled()
  expect(fetch).not.toHaveBeenCalled()
})