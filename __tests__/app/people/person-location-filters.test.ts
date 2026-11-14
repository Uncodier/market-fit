import { buildPersonLocationFilters, resolvePersonLocationFilters } from '@/app/people/person-location-filters'
import { apiClient } from '@/app/services/api-client-service'
import { createFinderQuery, searchFinderPeople } from '@/app/people/finder-api'

jest.mock('@/app/services/api-client-service', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }))

beforeEach(() => jest.resetAllMocks())

it('retains selected IDs and draft names while deduplicating', () => {
  expect(buildPersonLocationFilters([
    { id: '71', text: 'Mexico City, Mexico' }, { id: 71, text: 'Mexico City, Mexico' },
    { id: null, text: 'Paris, France' },
  ], ' Paris, France ')).toEqual({ person_locations: [71], person_location_names: ['Paris, France'] })
})

it.each(['', ' ', 'invalid', -1, 0, 1.5])('does not silently drop text with invalid ID %s', id => {
  expect(buildPersonLocationFilters([{ id, text: 'Paris, France' }])).toEqual({
    person_locations: undefined, person_location_names: ['Paris, France'],
  })
})

it('merges exact resolved names with selected IDs without mutating the payload', async () => {
  const payload = { site_id: 'site-a', person_locations: [71], person_location_names: ['paris, france'] }
  const lookup = jest.fn().mockResolvedValue([{ id: '72', text: 'Paris, France' }, { id: 73, text: 'Paris, Texas' }])
  await expect(resolvePersonLocationFilters(payload, lookup)).resolves.toEqual({
    site_id: 'site-a', person_locations: [71, 72],
  })
  expect(lookup).toHaveBeenCalledWith('paris, france', 'site-a')
  expect(payload.person_location_names).toEqual(['paris, france'])
})

it.each([
  { results: [] },
  { results: [{ id: 71, text: 'Paris, France' }] },
  { results: [{ id: 71, text: 'Paris' }, { id: 72, text: 'Paris' }] },
  { results: [{ id: 'invalid', text: 'Paris' }] },
])('rejects missing, partial, ambiguous or invalid matches: %j', async ({ results }) => {
  await expect(resolvePersonLocationFilters({ person_location_names: ['Paris'] },
    jest.fn().mockResolvedValue(results))).rejects.toThrow('Select a person location suggestion')
})

it.each([searchFinderPeople, createFinderQuery])('does not POST when person location lookup fails', async action => {
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: false, error: { message: 'Location lookup failed' } })
  await expect(action({ site_id: 'site-a', person_location_names: ['Paris'] })).rejects.toThrow('Location lookup failed')
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('resolves both company and person location before creating an enrichment query', async () => {
  ;(apiClient.get as jest.Mock)
    .mockResolvedValueOnce({ success: true, data: { results: [{ id: 42, text: 'Acme' }] } })
    .mockResolvedValueOnce({ success: true, data: { results: [{ id: 71, text: 'Paris, France' }] } })
  await createFinderQuery({ site_id: 'site-a', organization_names: ['Acme'], person_location_names: ['Paris, France'] })
  expect(apiClient.get).toHaveBeenLastCalledWith(
    '/api/finder/autocomplete/locations?q=Paris%2C%20France&page=1&site_id=site-a', { includeAuth: true },
  )
  expect(apiClient.post).toHaveBeenCalledWith('/api/finder/person_role_search/createQuery',
    { site_id: 'site-a', organizations: [42], person_locations: [71] }, { includeAuth: true })
})