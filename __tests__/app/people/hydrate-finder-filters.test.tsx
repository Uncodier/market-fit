import { act, renderHook } from '@testing-library/react'
import { toast } from 'sonner'
import { apiClient } from '@/app/services/api-client-service'
import { applySavedFinderFilters } from '@/app/people/hydrate-finder-filters'
import { LOOKUP_FILTERS, type LookupFilterField } from '@/app/people/lookup-filters'
import type { FinderRequest } from '@/app/people/finder-request-types'
import { usePeopleFilters } from '@/app/people/use-people-filters'
import { usePeopleSavedListActions } from '@/app/people/use-people-saved-list-actions'

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('@/app/services/api-client-service', () => ({ apiClient: { get: jest.fn() } }))
jest.mock('@/app/commerce/resolve-relation', () => ({ resolveRelationId: jest.fn() }))
jest.mock('@/app/segments/actions', () => ({ getSegments: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))

const site = {
  id: 'current-site', name: 'Current Site', url: null, description: null, logo_url: null,
  user_id: 'user', created_at: '2024-01-01', updated_at: '2024-01-01', resource_urls: null,
}
const lookupFields = Object.keys(LOOKUP_FILTERS) as LookupFilterField[]
const saved: FinderRequest = {
  site_id: 'saved-site', page: 5,
  role_title: ['Engineer', 'Manager'], role_description: '"software engineering"',
  role_is_current: true, role_position_start_date: '2020-01-01', role_position_end_date: '2024-12-31',
  role_years_on_position_start: 0, role_years_on_position_end: 10,
  person_name: ['Ada', 'Grace'], person_headline: ['Founder', 'CTO'],
  person_description: '"product leader"', person_skills: [1], person_locations: [2],
  person_location_names: ['New York'], person_industries: [3], person_industries_exclude: [4],
  person_linkedin_public_identifiers: ['ada', 'grace'],
  organizations: [5], organization_names: ['Acme Inc.'],
  organizations_bulk_domain: 'acme.com', organization_domains: ['example.com', 'example.org'],
  organization_description: '"enterprise software"', organization_locations: [6],
  organization_industries: [7], organization_industries_exclude: [8],
  organization_keywords: [9], organization_web_technologies: [10],
  organization_founded_date_start: '1990-01-01', organization_founded_date_end: '2020-12-31',
  organization_employees_start: 0, organization_employees_end: 500,
  organization_revenue_start: 0, organization_revenue_end: 1000000,
  organization_domain_rank_start: 0, organization_domain_rank_end: 100,
  organization_linkedin_public_identifiers: ['acme', 'example'],
  funding_types: ['series_a'], funding_total_start: 0, funding_total_end: 1000000,
  funding_event_date_featured_start: '2022-01-01', funding_event_date_featured_end: '2023-12-31',
  job_post_title: ['Engineer', 'Designer'], job_post_description: ['Software', 'Design'],
  job_post_is_remote: true, job_post_is_active: true,
  job_post_date_featured_start: '2024-01-01', job_post_date_featured_end: '2024-12-31',
  job_post_locations: [11], job_post_locations_exclude: [12],
  simple_event_source: 'product_hunt', simple_event_reason: 'promoted_on_site',
  simple_event_date_featured_start: '2023-01-01', simple_event_date_featured_end: '2023-12-31',
  require_deal: true, require_site_visit: true,
}

function compact(payload: FinderRequest) {
  return JSON.parse(JSON.stringify(payload))
}

beforeEach(() => {
  jest.resetAllMocks()
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

it('roundtrips every editable field through the actual filter hook and payload builder', () => {
  const query: FinderRequest = compact(saved)
  const original = compact(query)
  const { result } = renderHook(() => usePeopleFilters(site))
  act(() => applySavedFinderFilters(query, result.current))
  expect(compact(result.current.buildFinderPayload(1))).toEqual({ ...saved, site_id: site.id, page: 0 })
  expect(query).toEqual(original)
  expect(result.current.fundingRangeTouched).toBe(true)
  expect(result.current.companies).toEqual([{ id: 5, text: 'ID 5' }, { id: null, text: 'Acme Inc.' }])
  expect(result.current.locations).toEqual([{ id: 2, text: 'ID 2' }, { id: null, text: 'New York' }])
})

it.each(lookupFields)('roundtrips IDs and UI-only names for %s, without stale lookup drafts', field => {
  const query: FinderRequest = { [field]: [42, 43], [`${field}_names`]: ['Unresolved name'] }
  const { result } = renderHook(() => usePeopleFilters(site))
  act(() => result.current.lookupDraftSetters[field]('Stale draft'))
  act(() => applySavedFinderFilters(query, result.current))
  expect(compact(result.current.buildFinderPayload(1))).toEqual({
    ...query, site_id: site.id, page: 0, role_is_current: false,
  })
})

it.each(['role_title', 'person_name', 'person_headline', 'job_post_title', 'job_post_description'] as const)(
  'supports legacy strings, arrays, and empty terms for %s', field => {
    const { result } = renderHook(() => usePeopleFilters(site))
    for (const [value, expected] of [
      ['"two words"', '"two words"'],
      [['Engineer', '"Team Lead"'], ['Engineer', '"Team Lead"']],
      [[], undefined], ['', undefined],
    ] as [string | string[], string | string[] | undefined][]) {
      act(() => applySavedFinderFilters({ [field]: value }, result.current))
      expect(result.current.buildFinderPayload(1)[field]).toEqual(expected)
    }
  },
)

it('replacing a loaded query clears every stale filter and text draft', () => {
  const { result } = renderHook(() => usePeopleFilters(site))
  act(() => applySavedFinderFilters(saved, result.current))
  act(() => {
    result.current.setCompanyInput('Stale company')
    result.current.setPersonLocationInput('Stale location')
    result.current.setPersonNameInput('Stale name')
    result.current.setPersonHeadlineInput('Stale headline')
    result.current.setJobTitleInput('Stale role')
    result.current.setJobPostingTitleInput('Stale job')
    result.current.setJobPostingDescriptionInput('Stale description')
    result.current.setOrgDomainsInputText('stale.com')
    result.current.setOrgLinkedinIdsInputText('stale-org')
    result.current.setPersonLinkedinIdsInputText('stale-person')
    lookupFields.forEach(field => result.current.lookupDraftSetters[field]('Stale lookup'))
  })
  act(() => applySavedFinderFilters({}, result.current))
  expect(compact(result.current.buildFinderPayload(3))).toEqual({ site_id: site.id, page: 2, role_is_current: false })
  expect(result.current.fundingRange).toEqual([0, 0])
  expect(result.current.fundingRangeTouched).toBe(false)
  expect(result.current.orgFoundedRange).toEqual({ start: undefined, end: undefined })
})

it('preserves numeric zero bounds and explicit false booleans in filter state', () => {
  const query: FinderRequest = {
    role_is_current: false, job_post_is_remote: false, job_post_is_active: false,
    require_deal: false, require_site_visit: false,
    role_years_on_position_start: 0, role_years_on_position_end: 0,
    organization_employees_start: 0, organization_employees_end: 0,
    organization_revenue_start: 0, organization_revenue_end: 0,
    organization_domain_rank_start: 0, organization_domain_rank_end: 0,
    funding_total_start: 0, funding_total_end: 0,
  }
  const { result } = renderHook(() => usePeopleFilters(site))
  act(() => applySavedFinderFilters(saved, result.current))
  act(() => applySavedFinderFilters(query, result.current))
  expect(result.current.isCurrentRole).toBe(false)
  expect(result.current.includeRemote).toBe(false)
  expect(result.current.isJobActive).toBe(false)
  expect(result.current.requireDeal).toBe(false)
  expect(result.current.requireSiteVisit).toBe(false)
  expect(result.current.fundingRange).toEqual([0, 0])
  expect(result.current.fundingRangeTouched).toBe(true)
  const payload = result.current.buildFinderPayload(1)
  expect(payload).toMatchObject(query)
  for (const field of [
    'role_years_on_position_start', 'role_years_on_position_end',
    'organization_employees_start', 'organization_employees_end',
    'organization_revenue_start', 'organization_revenue_end',
    'organization_domain_rank_start', 'organization_domain_rank_end',
  ] as const) expect(payload[field]).toBe(0)
})

it.each([
  { funding_total_start: 100 }, { funding_total_end: 100 },
  { organization_founded_date_start: '2001-01-01' }, { organization_founded_date_end: '2002-12-31' },
  { funding_event_date_featured_start: '2024-01-01' }, { funding_event_date_featured_end: '2024-12-31' },
] satisfies FinderRequest[])( 'hydrates one-sided ranges %j', query => {
  const { result } = renderHook(() => usePeopleFilters(site))
  act(() => applySavedFinderFilters(query, result.current))
  if ('funding_total_start' in query || 'funding_total_end' in query) {
    expect(result.current.fundingRange).toEqual([query.funding_total_start ?? 0, query.funding_total_end ?? 0])
    expect(result.current.fundingRangeTouched).toBe(true)
  }
  expect(compact(result.current.buildFinderPayload(1))).toEqual({
    ...query, site_id: site.id, page: 0, role_is_current: false,
  })
})

it('lets user edits replace hydrated funding and optional flags instead of keeping saved overrides', () => {
  const { result } = renderHook(() => usePeopleFilters(site))
  act(() => applySavedFinderFilters({
    funding_types: ['seed', 'series_a'], funding_total_start: 100,
    job_post_is_remote: null, job_post_is_active: null, require_deal: false, require_site_visit: false,
  }, result.current))
  act(() => {
    result.current.setFundingType('series_b')
    result.current.setFundingRange([200, 300])
    result.current.setIncludeRemote(true)
    result.current.setIsJobActive(true)
    result.current.setRequireDeal(true)
    result.current.setRequireSiteVisit(true)
  })
  expect(compact(result.current.buildFinderPayload(1))).toEqual({
    site_id: site.id, page: 0, role_is_current: false,
    funding_types: ['series_b'], funding_total_start: 200, funding_total_end: 300,
    job_post_is_remote: true, job_post_is_active: true, require_deal: true, require_site_visit: true,
  })
})

it.each([
  { funding_types: ['seed', 'series_a'] },
  { funding_total_start: 0 }, { funding_total_end: 0 },
  { funding_total_start: 0, funding_total_end: 0 },
  { job_post_is_remote: false, job_post_is_active: false, require_deal: false, require_site_visit: false },
  { job_post_is_remote: null, job_post_is_active: null },
] satisfies FinderRequest[])('preserves saved funding and optional flag semantics %j', query => {
  const { result } = renderHook(() => usePeopleFilters(site))
  act(() => applySavedFinderFilters(query, result.current))
  expect(compact(result.current.buildFinderPayload(1))).toEqual({
    ...query, site_id: site.id, page: 0, role_is_current: false,
  })
})

it('does not retain invalid dates or leak previous dates into a new query', () => {
  const { result } = renderHook(() => usePeopleFilters(site))
  act(() => applySavedFinderFilters(saved, result.current))
  act(() => applySavedFinderFilters({
    role_position_start_date: 'invalid', organization_founded_date_start: 'invalid',
    funding_event_date_featured_start: 'invalid', job_post_date_featured_start: 'invalid',
    simple_event_date_featured_start: 'invalid',
  }, result.current))
  expect(compact(result.current.buildFinderPayload(1))).toEqual({ site_id: site.id, page: 0, role_is_current: false })
})

it('builds pagination without copying an untrusted saved site into filter state', () => {
  const { result } = renderHook(() => usePeopleFilters(null))
  act(() => applySavedFinderFilters({ ...saved, site_id: 'saved-site', page: 99 }, result.current))
  const { site_id: savedSite, ...expected } = saved
  expect(savedSite).toBe('saved-site')
  expect(compact(result.current.buildFinderPayload(4))).toEqual({ ...expected, page: 3 })
})

function renderSavedListHook() {
  const controls = {
    currentSite: site, setCurrentPage: jest.fn(), executeSearch: jest.fn().mockResolvedValue(undefined),
    isSearchPending: jest.fn().mockReturnValue(false), availableSegments: [], setAvailableSegments: jest.fn(),
    setIsIcpModalOpen: jest.fn(), removeIcp: jest.fn(), renameIcp: jest.fn(), setCollapsibleVersion: jest.fn(),
    setIsEditIcpModalOpen: jest.fn(), editingIcp: null, setEditingIcp: jest.fn(), editingIcpName: '',
    setEditingIcpName: jest.fn(), editingIcpSegmentValue: null, setEditingIcpSegmentValue: jest.fn(),
    setEditingIcpSegmentsLoading: jest.fn(),
  }
  const hook = renderHook(() => {
    const filters = usePeopleFilters(site)
    return { filters, actions: usePeopleSavedListActions({ ...filters, ...controls }) }
  })
  return { ...hook, controls }
}

it('loads through handleLoadIcp, preserves open defaults, and executes the full saved query with current scope', async () => {
  const query = { ...saved, provider_only_field: 'preserved' }
  jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: { role_query: { query } } })
  const { result, controls } = renderSavedListHook()
  await act(async () => result.current.actions.handleLoadIcp('list/1'))
  expect(apiClient.get).toHaveBeenCalledWith('/api/finder/icp?icp_id=list%2F1&site_id=current-site')
  expect(compact(result.current.filters.buildFinderPayload(1))).toEqual({ ...saved, site_id: site.id, page: 0 })
  expect(Object.values(result.current.filters.sectionOpenDefaults).every(Boolean)).toBe(true)
  expect(controls.setCollapsibleVersion).toHaveBeenCalledTimes(1)
  expect(controls.setCollapsibleVersion.mock.calls[0][0](3)).toBe(4)
  expect(controls.setIsIcpModalOpen).toHaveBeenCalledWith(false)
  expect(controls.setCurrentPage).toHaveBeenCalledWith(1)
  expect(controls.executeSearch).toHaveBeenCalledWith({ ...query, page: 0, site_id: site.id })
  expect(toast.success).toHaveBeenCalledWith('Saved list loaded')
})

it('does not fetch or hydrate while search is pending', async () => {
  const { result, controls } = renderSavedListHook()
  controls.isSearchPending.mockReturnValue(true)
  await act(async () => result.current.actions.handleLoadIcp('list'))
  expect(apiClient.get).not.toHaveBeenCalled()
  expect(controls.executeSearch).not.toHaveBeenCalled()
})

it('does not overwrite filters if a search starts during the saved-list fetch', async () => {
  jest.mocked(apiClient.get).mockResolvedValue({ success: true, data: { role_query: { query: saved } } })
  const { result, controls } = renderSavedListHook()
  controls.isSearchPending.mockReturnValueOnce(false).mockReturnValue(true)
  await act(async () => result.current.actions.handleLoadIcp('list'))
  expect(result.current.filters.skills).toEqual([])
  expect(controls.executeSearch).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
})

it('leaves current filters unchanged after a failed saved-list response', async () => {
  jest.mocked(apiClient.get).mockResolvedValue({ success: false, error: { message: 'Unavailable' } })
  const { result, controls } = renderSavedListHook()
  act(() => applySavedFinderFilters(saved, result.current.filters))
  await act(async () => result.current.actions.handleLoadIcp('list'))
  expect(compact(result.current.filters.buildFinderPayload(1))).toEqual({ ...saved, site_id: site.id, page: 0 })
  expect(controls.executeSearch).not.toHaveBeenCalled()
  expect(toast.error).toHaveBeenCalledWith('Failed to load saved list')
})