import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const getSession = jest.fn()
jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession: () => getSession() } })
}))

const apiUrl = 'https://backend.example.test'
const originalApiUrl = process.env.NEXT_PUBLIC_API_SERVER_URL

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(body)
  }
}

beforeEach(() => {
  jest.resetModules()
  jest.clearAllMocks()
  process.env.NEXT_PUBLIC_API_SERVER_URL = apiUrl
  getSession.mockResolvedValue({ data: { session: { access_token: 'test-user-token' } } })
  ;(fetch as jest.Mock).mockResolvedValue(jsonResponse({ success: true }))
})

afterAll(() => {
  if (originalApiUrl === undefined) delete process.env.NEXT_PUBLIC_API_SERVER_URL
  else process.env.NEXT_PUBLIC_API_SERVER_URL = originalApiUrl
})

describe('Finder screen API authentication', () => {
  it('sends the user session and unchanged filters for both search and totals', async () => {
    const { searchFinderPeople } = await import('@/app/people/finder-api')
    const payload = { site_id: 'site-a', page: 0, person_industries: [42], role_title: ['Founder'] }
    const searchResults = { search_results: [{ id: 'person-a' }], total_search_results: 1 }
    const totals = { total_persons: 1, total_organizations: 1, total_search_results: 1 }
    ;(fetch as jest.Mock).mockImplementation(async (url: string) =>
      jsonResponse(url.endsWith('/totals') ? totals : searchResults)
    )

    const [search, count] = await searchFinderPeople(payload)

    expect(search.data).toEqual(searchResults)
    expect(count.data).toEqual(totals)
    expect(fetch).toHaveBeenCalledTimes(2)
    for (const suffix of ['', '/totals']) {
      expect(fetch).toHaveBeenCalledWith(`${apiUrl}/api/finder/person_role_search${suffix}`, expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-user-token' }),
        body: JSON.stringify(payload)
      }))
    }
    expect(getSession).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['industries', 'industries'],
    ['organizations', 'organizations'],
    ['org_keywords', 'organization_keywords'],
    ['locations', 'locations'],
    ['skills', 'person_skills'],
    ['web_technologies', 'web_technologies']
  ])('authenticates autocomplete for %s and keeps provider IDs', async (type, category) => {
    const { lookupFetcher } = await import('@/app/people/finder-api')
    ;(fetch as jest.Mock).mockResolvedValue(jsonResponse({ results: [
      { id: 42, text: 'Sales & Marketing' }, { id: 99, text: '' }, { id: 100 }
    ] }))

    await expect(lookupFetcher(type, 'Sales & Marketing', 'site-a')).resolves.toEqual([
      { id: 42, text: 'Sales & Marketing' }
    ])
    expect(fetch).toHaveBeenCalledWith(
      `${apiUrl}/api/finder/autocomplete/${category}?q=Sales%20%26%20Marketing&page=0&site_id=site-a`,
      expect.objectContaining({
        method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer test-user-token' })
      })
    )
  })

  it('authenticates query creation without losing enrichment parameters', async () => {
    const { createFinderQuery } = await import('@/app/people/finder-api')
    const payload = { site_id: 'site-a', segment_id: 'segment-a', campaign_name: 'Founders', total_targets: 10 }
    await createFinderQuery(payload)

    expect(fetch).toHaveBeenCalledWith(`${apiUrl}/api/finder/person_role_search/createQuery`, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-user-token' }),
      body: JSON.stringify(payload)
    }))
  })

  it('reads the current session on subsequent searches instead of caching an old token', async () => {
    const { searchFinderPeople } = await import('@/app/people/finder-api')
    await searchFinderPeople({ page: 0 })
    getSession.mockResolvedValue({ data: { session: { access_token: 'refreshed-user-token' } } })
    await searchFinderPeople({ page: 1 })

    for (const [, options] of (fetch as jest.Mock).mock.calls.slice(2)) {
      expect(options.headers.Authorization).toBe('Bearer refreshed-user-token')
    }
  })

  it('preserves backend authentication failures without retrying with a privileged key', async () => {
    const { searchFinderPeople, createFinderQuery } = await import('@/app/people/finder-api')
    const error = { code: 'UNAUTHORIZED', message: 'Authentication required' }
    ;(fetch as jest.Mock).mockResolvedValue(jsonResponse({ success: false, error }, 401))

    const responses = [...await searchFinderPeople({}), await createFinderQuery({})]
    for (const response of responses) {
      expect(response).toMatchObject({ success: false, status: 401, error })
    }
    for (const [, options] of (fetch as jest.Mock).mock.calls) {
      expect(options.headers.Authorization).toBe('Bearer test-user-token')
      expect(options.headers['x-api-key']).toBeUndefined()
    }
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('does not replace a failed autocomplete request with fabricated suggestions', async () => {
    const { lookupFetcher } = await import('@/app/people/finder-api')
    ;(fetch as jest.Mock).mockResolvedValue(jsonResponse({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired user token' }
    }, 401))

    await expect(lookupFetcher('industries', 'Health')).rejects.toThrow('Invalid or expired user token')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('wires the Finder screen to the authenticated helpers without auth opt-outs', () => {
    const page = readFileSync(join(process.cwd(), 'app/people/page.tsx'), 'utf8')
    expect(page).toContain('from "./finder-api"')
    expect(page).toContain('await searchFinderPeople(payload)')
    expect(page).toContain('await createFinderQuery(payload)')
    expect(page).not.toMatch(/includeAuth\s*:\s*false/)
  })
})