import type { Dispatch, SetStateAction } from 'react'
import type { LookupOption } from './finder-api'
import type { FinderRequest } from './finder-request-types'
import { buildLookupOptions } from './lookup-filters'
import type { PeopleFilters } from './use-people-filters'

// Date-only filters use local calendar dates, just like buildFinderPayload.toYmd.
function parseDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function applyTerms(
  value: string | string[] | undefined,
  setChips: Dispatch<SetStateAction<string[]>>,
  setInput: Dispatch<SetStateAction<string>>,
) {
  setChips(Array.isArray(value) ? value.filter(Boolean) : [])
  setInput(typeof value === 'string' ? value : '')
}

function namedOptions(ids?: number[], names?: string[]): LookupOption[] {
  return [
    ...(ids || []).map(id => ({ id: Number(id), text: `ID ${id}` })),
    ...(names || []).map(text => ({ id: null, text })),
  ]
}

/** Replace every editable Finder filter, including clearing stale draft inputs. */
export function applySavedFinderFilters(q: FinderRequest, filters: PeopleFilters) {
  Object.values(filters.lookupDraftSetters).forEach(setDraft => setDraft(''))
  applyTerms(q.role_title, filters.setJobTitleChips, filters.setJobTitleInput)
  applyTerms(q.person_name, filters.setPersonNameChips, filters.setPersonNameInput)
  applyTerms(q.person_headline, filters.setPersonHeadlineChips, filters.setPersonHeadlineInput)
  applyTerms(q.job_post_title, filters.setJobPostingTitleChips, filters.setJobPostingTitleInput)
  applyTerms(q.job_post_description, filters.setJobPostingDescriptionChips, filters.setJobPostingDescriptionInput)
  filters.setQuery(q.role_description || '')
  filters.setIsCurrentRole(Boolean(q.role_is_current))
  filters.setRoleDateSince(parseDate(q.role_position_start_date))
  filters.setRoleDateUntil(parseDate(q.role_position_end_date))
  filters.setRoleYearsOnPositionStart(q.role_years_on_position_start ?? '')
  filters.setRoleYearsOnPositionEnd(q.role_years_on_position_end ?? '')
  filters.setPersonDescription(q.person_description || '')
  filters.setPersonLinkedinIds([...(q.person_linkedin_public_identifiers || [])])
  filters.setPersonLinkedinIdsInputText('')
  filters.setLocations(namedOptions(q.person_locations, q.person_location_names))
  filters.setPersonLocationInput('')
  filters.setIndustries(buildLookupOptions('person_industries', q))
  filters.setPersonIndustriesExclude(buildLookupOptions('person_industries_exclude', q))
  filters.setSkills(buildLookupOptions('person_skills', q))

  filters.setCompanies(namedOptions(q.organizations, q.organization_names))
  filters.setCompanyInput('')
  filters.setOrgDomains([...(q.organization_domains || [])])
  filters.setOrgDomainsInputText('')
  filters.setOrgBulkDomain(q.organizations_bulk_domain || '')
  filters.setOrgDescription(q.organization_description || '')
  filters.setOrgLocations(buildLookupOptions('organization_locations', q))
  filters.setOrgIndustries(buildLookupOptions('organization_industries', q))
  filters.setOrgIndustriesExclude(buildLookupOptions('organization_industries_exclude', q))
  filters.setKeywords(buildLookupOptions('organization_keywords', q))
  filters.setTechnologies(buildLookupOptions('organization_web_technologies', q))
  filters.setOrgLinkedinIds([...(q.organization_linkedin_public_identifiers || [])])
  filters.setOrgLinkedinIdsInputText('')
  filters.setEmployeeFrom(q.organization_employees_start ?? '')
  filters.setEmployeeTo(q.organization_employees_end ?? '')
  filters.setRevenueFrom(q.organization_revenue_start ?? '')
  filters.setRevenueTo(q.organization_revenue_end ?? '')
  filters.setDomainRankFrom(q.organization_domain_rank_start ?? '')
  filters.setDomainRankTo(q.organization_domain_rank_end ?? '')
  filters.setOrgFoundedRange({
    start: parseDate(q.organization_founded_date_start),
    end: parseDate(q.organization_founded_date_end),
  })

  filters.setIncludeRemote(Boolean(q.job_post_is_remote))
  filters.setIsJobActive(Boolean(q.job_post_is_active))
  filters.setJobFeaturedDateFrom(parseDate(q.job_post_date_featured_start))
  filters.setJobFeaturedDateTo(parseDate(q.job_post_date_featured_end))
  filters.setJobLocations(buildLookupOptions('job_post_locations', q))
  filters.setJobLocationsExclude(buildLookupOptions('job_post_locations_exclude', q))
  filters.setFundingType(q.funding_types?.[0] || '')
  filters.setFundingRange([q.funding_total_start ?? 0, q.funding_total_end ?? 0])
  filters.setFundingRangeTouched(
    typeof q.funding_total_start === 'number' || typeof q.funding_total_end === 'number',
  )
  filters.setFundingDateRange({
    start: parseDate(q.funding_event_date_featured_start),
    end: parseDate(q.funding_event_date_featured_end),
  })
  filters.setSimpleEventSource(q.simple_event_source ?? null)
  filters.setSimpleEventReason(q.simple_event_reason ?? null)
  filters.setSimpleEventDateRange({
    start: parseDate(q.simple_event_date_featured_start),
    end: parseDate(q.simple_event_date_featured_end),
  })
  filters.setRequireDeal(Boolean(q.require_deal))
  filters.setRequireSiteVisit(Boolean(q.require_site_visit))
  filters.setSavedFilterValues({
    funding_types: q.funding_types,
    funding_total_start: q.funding_total_start,
    funding_total_end: q.funding_total_end,
    job_post_is_remote: q.job_post_is_remote,
    job_post_is_active: q.job_post_is_active,
    require_deal: q.require_deal,
    require_site_visit: q.require_site_visit,
  })
}