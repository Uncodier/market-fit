import { normalizeLinkedInFilters, normalizeLinkedInIdentifier } from '@/app/people/linkedin-filters'
import { createFinderQuery, searchFinderPeople } from '@/app/people/finder-api'
import { apiClient } from '@/app/services/api-client-service'

jest.mock('@/app/services/api-client-service', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }))
beforeEach(() => jest.resetAllMocks())

it.each([
  ['apple', 'apple'], [' Microsoft ', 'microsoft'], ['12345', '12345'],
  ['https://www.linkedin.com/company/apple/', 'apple'],
  ['linkedin.com/company/microsoft', 'microsoft'],
  ['https://mx.linkedin.com/company/apple/about/?trk=search#top', 'apple'],
  ['https://www.linkedin.com/company/%61pple/', 'apple'],
])('normalizes company input %s to %s', (input, expected) => {
  expect(normalizeLinkedInIdentifier(input, 'company')).toBe(expected)
})

it.each([
  '', 'Apple Inc.', 'https://example.com/company/apple/',
  'https://linkedin.com.evil.example/company/apple/',
  'https://www.linkedin.com/in/apple/', 'https://www.linkedin.com/company/',
  'https://www.linkedin.com/company/apple/unknown',
  'https://user:pass@linkedin.com/company/apple', 'https://linkedin.com:444/company/apple',
  'https://linkedin.com/company/apple%2Fevil', 'apple,microsoft',
])('rejects invalid company input %s without ignoring it', input => {
  expect(() => normalizeLinkedInIdentifier(input, 'company')).toThrow('valid LinkedIn company')
})

it('normalizes person URLs independently of company URLs and preserves original payload', () => {
  const payload = {
    organization_linkedin_public_identifiers: ['apple', 'https://www.linkedin.com/company/Apple/'],
    person_linkedin_public_identifiers: ['https://linkedin.com/in/ada-lovelace/'],
  }
  expect(normalizeLinkedInFilters(payload)).toEqual({
    organization_linkedin_public_identifiers: ['apple'], person_linkedin_public_identifiers: ['ada-lovelace'],
  })
  expect(payload.organization_linkedin_public_identifiers).toHaveLength(2)
})

it.each([null, 'apple', [42]])('rejects malformed identifier lists %j', values => {
  expect(() => normalizeLinkedInFilters({ organization_linkedin_public_identifiers: values })).toThrow('Invalid LinkedIn')
})

it('sends the normalized slug to search, totals and query creation', async () => {
  ;(apiClient.post as jest.Mock).mockResolvedValue({ success: true })
  const payload = { site_id: 'site-a', organization_linkedin_public_identifiers: ['https://www.linkedin.com/company/apple/'] }
  await searchFinderPeople(payload)
  await createFinderQuery(payload)
  for (const suffix of ['', '/totals', '/createQuery']) {
    expect(apiClient.post).toHaveBeenCalledWith(`/api/finder/person_role_search${suffix}`,
      { site_id: 'site-a', organization_linkedin_public_identifiers: ['apple'] }, { includeAuth: true })
  }
})

it.each([searchFinderPeople, createFinderQuery])('does not send requests for an invalid LinkedIn URL', async action => {
  await expect(action({ organization_linkedin_public_identifiers: ['https://example.com/apple'] })).rejects.toThrow('valid LinkedIn')
  expect(apiClient.get).not.toHaveBeenCalled()
  expect(apiClient.post).not.toHaveBeenCalled()
})