import { buildCompanyFilters, organizationId, resolveCompanyFilters } from '@/app/people/company-filters'
import { apiClient } from '@/app/services/api-client-service'
import { createFinderQuery, searchFinderPeople } from '@/app/people/finder-api'

jest.mock('@/app/services/api-client-service', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }))

beforeEach(() => jest.resetAllMocks())

it.each([null, undefined, '', ' ', 'not-an-id', 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'rejects invalid organization ID %s', value => expect(organizationId(value)).toBeUndefined(),
)

it('separates selected IDs, domains and unresolved names without silently dropping names', () => {
  expect(buildCompanyFilters([
    { id: '42', text: 'Acme' }, { id: 42, text: 'Acme' },
    { id: null, text: 'ACME.COM' }, { id: null, text: 'Acme Inc.' },
  ], 'Other Company')).toEqual({
    organizations: [42], organization_domains: ['acme.com'], organization_names: ['Acme Inc.', 'Other Company'],
  })
})

it('resolves exact names, merges IDs and removes UI-only fields without mutating input', async () => {
  const payload = { site_id: 'site-a', organizations: [42], organization_names: [' ACME '] }
  const lookup = jest.fn().mockResolvedValue([{ id: '43', text: 'Acme' }, { id: 99, text: 'Acme Consulting' }])
  await expect(resolveCompanyFilters(payload, lookup)).resolves.toEqual({ site_id: 'site-a', organizations: [42, 43] })
  expect(lookup).toHaveBeenCalledWith(' ACME ', 'site-a')
  expect(payload.organization_names).toEqual([' ACME '])
})

it.each([searchFinderPeople, createFinderQuery])('never POSTs after autocomplete fails', async action => {
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: false, error: { message: 'Finder lookup unavailable' } })
  await expect(action({ site_id: 'site-a', organization_names: ['Acme'] })).rejects.toThrow('Finder lookup unavailable')
  expect(apiClient.post).not.toHaveBeenCalled()
})

it('resolves company names before creating a saved enrichment query', async () => {
  ;(apiClient.get as jest.Mock).mockResolvedValue({ success: true, data: { results: [{ id: 42, text: 'Acme' }] } })
  await createFinderQuery({ site_id: 'site-a', organization_names: ['Acme'], total_targets: 10 })
  expect(apiClient.post).toHaveBeenCalledWith('/api/finder/person_role_search/createQuery',
    { site_id: 'site-a', organizations: [42], total_targets: 10 }, { includeAuth: true })
})