import { LOOKUP_FILTERS, buildLookupFilter, resolveLookupFilters, type LookupFilterField } from '@/app/people/lookup-filters'
import { apiClient } from '@/app/services/api-client-service'
import { createFinderQuery, searchFinderPeople } from '@/app/people/finder-api'

jest.mock('@/app/services/api-client-service', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }))
const fields = Object.keys(LOOKUP_FILTERS) as LookupFilterField[]
beforeEach(() => jest.resetAllMocks())

it.each(fields)('keeps IDs and manual/draft text for %s', field => {
  expect(buildLookupFilter(field, [{ id: '42', text: 'Selected' }, { id: null, text: 'Manual' }], 'Draft')).toEqual({
    [field]: [42], [`${field}_names`]: ['Manual', 'Draft'],
  })
})

it.each(fields)('resolves %s to provider IDs and removes UI names', async field => {
  const payload = { site_id: 'site-a', [field]: [42], [`${field}_names`]: ['Exact'] }
  const lookup = jest.fn().mockResolvedValue([{ id: '43', text: 'Exact' }])
  await expect(resolveLookupFilters(payload, lookup)).resolves.toEqual({ site_id: 'site-a', [field]: [42, 43] })
  expect(lookup).toHaveBeenCalledWith(LOOKUP_FILTERS[field].category, 'Exact', 'site-a')
  expect(payload[`${field}_names`]).toEqual(['Exact'])
})

it.each(fields)('rejects unknown or ambiguous text for %s before search/totals', async field => {
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { results: [] } })
  await expect(searchFinderPeople({ site_id: 'site-a', [`${field}_names`]: ['Unknown'] })).rejects.toThrow('suggestion')
  expect(apiClient.post).not.toHaveBeenCalled()
})

it.each(fields)('includes resolved %s in search, totals and saved-query creation', async field => {
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { results: [{ id: 42, text: 'Exact' }] } })
  ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true })
  const payload = { site_id: 'site-a', [`${field}_names`]: ['Exact'] }
  await searchFinderPeople(payload)
  await createFinderQuery(payload)
  for (const suffix of ['', '/totals', '/createQuery']) {
    expect(apiClient.post).toHaveBeenCalledWith(`/api/finder/person_role_search${suffix}`,
      { site_id: 'site-a', [field]: [42] }, { includeAuth: true })
  }
})

it.each([null, 'name', [null], [' ']])('rejects malformed filter names %j', async names => {
  await expect(resolveLookupFilters({ person_skills_names: names }, jest.fn())).rejects.toThrow('Invalid person skill names')
})

it('rejects ambiguous exact matches', async () => {
  await expect(resolveLookupFilters({ person_skills_names: ['Exact'] }, jest.fn().mockResolvedValue([
    { id: 42, text: 'Exact' }, { id: 43, text: 'Exact' },
  ]))).rejects.toThrow('suggestion')
})