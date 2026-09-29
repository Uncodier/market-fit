export {}

const getSession = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: () => getSession() } }),
}))

const apiUrl = 'https://api.example.com'
const previousApiUrl = process.env.NEXT_PUBLIC_API_SERVER_URL
const payload = { site_id: 'test-site', organization_industries: [42], page: 0 }
const finderRequests = [
  { method: 'get', endpoint: '/api/finder/autocomplete/industries?q=Marketing&page=0' },
  { method: 'get', endpoint: '/api/finder/icp?icp_id=test-query&site_id=test-site' },
  { method: 'post', endpoint: '/api/finder/person_role_search' },
  { method: 'post', endpoint: '/api/finder/person_role_search/totals' },
  { method: 'post', endpoint: '/api/finder/person_role_search/createQuery' },
] as const

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_API_SERVER_URL = apiUrl
  getSession.mockResolvedValue({ data: { session: { access_token: 'user-session-token' } } })
  ;(fetch as jest.Mock).mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify({ search_results: [], total_persons: 0 }),
  })
})

afterEach(() => {
  jest.restoreAllMocks()
  if (previousApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
  else process.env.NEXT_PUBLIC_API_SERVER_URL = previousApiUrl
})

it.each(finderRequests)('authenticates legacy $method $endpoint calls', async ({ method, endpoint }) => {
  const { apiClient } = await import('@/app/services/api-client-service')
  const options = { includeAuth: false }
  const result = method === 'get'
    ? await apiClient.get(endpoint, options)
    : await apiClient.post(endpoint, payload, options)

  expect(getSession).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith(`${apiUrl}${endpoint}`, expect.objectContaining({
    method: method.toUpperCase(),
    headers: expect.objectContaining({ Authorization: 'Bearer user-session-token' }),
    ...(method === 'post' ? { body: JSON.stringify(payload) } : {}),
  }))
  expect(result).toMatchObject({ success: true, data: { search_results: [], total_persons: 0 } })
})

it.each(finderRequests)('does not send anonymous $method $endpoint requests', async ({ method, endpoint }) => {
  getSession.mockResolvedValue({ data: { session: null } })
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const { apiClient } = await import('@/app/services/api-client-service')
  const result = method === 'get'
    ? await apiClient.get(endpoint, { includeAuth: false })
    : await apiClient.post(endpoint, payload, { includeAuth: false })

  expect(fetch).not.toHaveBeenCalled()
  expect(result).toMatchObject({
    success: false,
    error: { message: expect.stringContaining('Please sign in') },
  })
})

it('authenticates absolute Finder URLs on the configured API origin', async () => {
  const { apiClient } = await import('@/app/services/api-client-service')
  const endpoint = `${apiUrl}/api/finder/person_role_search`
  await apiClient.post(endpoint, payload, { includeAuth: false })

  expect(fetch).toHaveBeenCalledWith(endpoint, expect.objectContaining({
    headers: expect.objectContaining({ Authorization: 'Bearer user-session-token' }),
  }))
})

it('authenticates same-origin Finder requests without an external API configured', async () => {
  process.env.NEXT_PUBLIC_API_SERVER_URL = ''
  const previousServerUrl = process.env.API_SERVER_URL
  delete process.env.API_SERVER_URL
  try {
    const { apiClient } = await import('@/app/services/api-client-service')
    await apiClient.post('/api/finder/person_role_search', payload, { includeAuth: false })
    expect(fetch).toHaveBeenCalledWith('/api/finder/person_role_search', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer user-session-token' }),
    }))
  } finally {
    if (previousServerUrl === undefined) delete process.env.API_SERVER_URL
    else process.env.API_SERVER_URL = previousServerUrl
  }
})

it.each([
  '/api/public/posts',
  '/api/finder-other/search',
  'https://third-party.example/api/finder/person_role_search',
])('preserves explicit anonymous requests outside Finder: %s', async endpoint => {
  const { apiClient } = await import('@/app/services/api-client-service')
  await apiClient.get(endpoint, { includeAuth: false })

  expect(getSession).not.toHaveBeenCalled()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect((fetch as jest.Mock).mock.calls[0][1].headers).not.toHaveProperty('Authorization')
})

it.each(['get', 'post', 'put', 'patch', 'delete'] as const)(
  'preserves default authentication and explicit opt-out for non-Finder %s requests',
  async method => {
    const { apiClient } = await import('@/app/services/api-client-service')
    const endpoint = '/api/example'
    const send = (includeAuth?: boolean) => method === 'get' || method === 'delete'
      ? apiClient[method](endpoint, { includeAuth })
      : apiClient[method](endpoint, payload, { includeAuth })

    await send()
    expect(getSession).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenLastCalledWith(`${apiUrl}${endpoint}`, expect.objectContaining({
      method: method.toUpperCase(),
      headers: expect.objectContaining({ Authorization: 'Bearer user-session-token' }),
    }))

    await send(false)
    expect(getSession).toHaveBeenCalledTimes(1)
    expect((fetch as jest.Mock).mock.calls[1][1].headers).not.toHaveProperty('Authorization')
  },
)

it('preserves backend authentication errors without retrying the search', async () => {
  const error = { code: 'UNAUTHORIZED', message: 'Invalid or expired user token' }
  ;(fetch as jest.Mock).mockResolvedValue({
    ok: false,
    status: 401,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify({ success: false, error }),
  })
  const { apiClient } = await import('@/app/services/api-client-service')
  const result = await apiClient.post('/api/finder/person_role_search', payload)

  expect(result).toMatchObject({ success: false, status: 401, error })
  expect(fetch).toHaveBeenCalledTimes(1)
})