import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"
import { type LookupOption } from "./finder-api"
import { buildCompanyFilters } from "./company-filters"
import { buildPersonLocationFilters } from "./person-location-filters"
import { buildLookupFilter } from "./lookup-filters"
import { useLookupFilterDrafts } from "./use-lookup-filter-drafts"
import { useSavedFilterValues } from "./use-saved-filter-values"
import type { FinderRequest, FinderSimpleEventSource, FinderSimpleEventReason } from "./finder-request-types"

export function usePeopleFilters(currentSite: { id: string } | null) {
  const { lookupDrafts, lookupDraftSetters } = useLookupFilterDrafts()
  const { savedValues, setSavedFilterValues, clearSavedFields } = useSavedFilterValues()
  // filters
  const [query, setQuery] = useState("")
  const [industries, setIndustries] = useState<LookupOption[]>([])
  const [personIndustriesExclude, setPersonIndustriesExclude] = useState<LookupOption[]>([])
  const [locations, setLocations] = useState<LookupOption[]>([])
  const [personLocationInput, setPersonLocationInput] = useState("")
  const [employeeFrom, setEmployeeFrom] = useState<number | "">("")
  const [employeeTo, setEmployeeTo] = useState<number | "">("")
  const [revenueFrom, setRevenueFrom] = useState<number | "">("")
  const [revenueTo, setRevenueTo] = useState<number | "">("")
  const [domainRankFrom, setDomainRankFrom] = useState<number | "">("")
  const [domainRankTo, setDomainRankTo] = useState<number | "">("")
  // single-string filters
  const [personNameChips, setPersonNameChips] = useState<string[]>([])
  const [personNameInput, setPersonNameInput] = useState<string>("")
  const [personHeadlineChips, setPersonHeadlineChips] = useState<string[]>([])
  const [personHeadlineInput, setPersonHeadlineInput] = useState<string>("")
  const [jobTitleChips, setJobTitleChips] = useState<string[]>([])
  const [jobTitleInput, setJobTitleInput] = useState<string>("")
  const [skills, setSkills] = useState<LookupOption[]>([])
  const [companies, setCompanies] = useState<LookupOption[]>([])
  const [companyInput, setCompanyInput] = useState("")
  const [keywords, setKeywords] = useState<LookupOption[]>([])
  const [personLinkedinIds, setPersonLinkedinIds] = useState<string[]>([])
  const [personLinkedinIdsInputText, setPersonLinkedinIdsInputText] = useState<string>("")
  const [isCurrentRole, setIsCurrentRole] = useState(true)
  const [roleDateSince, setRoleDateSince] = useState<Date | undefined>(undefined)
  const [roleDateUntil, setRoleDateUntil] = useState<Date | undefined>(undefined)
  const [roleYearsOnPositionStart, setRoleYearsOnPositionStart] = useState<number | "">("")
  const [roleYearsOnPositionEnd, setRoleYearsOnPositionEnd] = useState<number | "">("")
  const [personDescription, setPersonDescription] = useState<string>("")
  // job postings
  const [jobPostingTitleChips, setJobPostingTitleChips] = useState<string[]>([])
  const [jobPostingTitleInput, setJobPostingTitleInput] = useState<string>("")
  const [jobPostingDescriptionChips, setJobPostingDescriptionChips] = useState<string[]>([])
  const [jobPostingDescriptionInput, setJobPostingDescriptionInput] = useState<string>("")
  const [jobFeaturedDateFrom, setJobFeaturedDateFrom] = useState<Date | undefined>(undefined)
  const [jobFeaturedDateTo, setJobFeaturedDateTo] = useState<Date | undefined>(undefined)
  const [includeRemote, setIncludeRemoteState] = useState(false)
  const setIncludeRemote = (value: SetStateAction<boolean>) => { clearSavedFields('job_post_is_remote'); setIncludeRemoteState(value) }
  const [isJobActive, setIsJobActiveState] = useState(false)
  const setIsJobActive = (value: SetStateAction<boolean>) => { clearSavedFields('job_post_is_active'); setIsJobActiveState(value) }
  const [jobLocations, setJobLocations] = useState<LookupOption[]>([])
  const [jobLocationsExclude, setJobLocationsExclude] = useState<LookupOption[]>([])
  // funding
  const [fundingRange, setFundingRangeState] = useState<[number, number]>([0, 0])
  const setFundingRange: Dispatch<SetStateAction<[number, number]>> = value => {
    clearSavedFields('funding_total_start', 'funding_total_end'); setFundingRangeState(value)
  }
  const [fundingType, setFundingTypeState] = useState<string>("")
  const setFundingType = (value: SetStateAction<string>) => { clearSavedFields('funding_types'); setFundingTypeState(value) }
  const [fundingDateRange, setFundingDateRange] = useState<{ start?: Date; end?: Date }>({})
  const [fundingRangeTouched, setFundingRangeTouched] = useState<boolean>(false)
  // technologies
  const [technologies, setTechnologies] = useState<LookupOption[]>([])
  // organization-specific additional filters
  const [orgDomains, setOrgDomains] = useState<string[]>([])
  const [orgDomainsInputText, setOrgDomainsInputText] = useState<string>("")
  const [orgBulkDomain, setOrgBulkDomain] = useState<string>("")
  const [orgDescription, setOrgDescription] = useState<string>("")
  const [orgLocations, setOrgLocations] = useState<LookupOption[]>([])
  const [orgIndustries, setOrgIndustries] = useState<LookupOption[]>([])
  const [orgIndustriesExclude, setOrgIndustriesExclude] = useState<LookupOption[]>([])
  const [orgLinkedinIds, setOrgLinkedinIds] = useState<string[]>([])
  const [orgLinkedinIdsInputText, setOrgLinkedinIdsInputText] = useState<string>("")
  const [orgFoundedRange, setOrgFoundedRange] = useState<{ start?: Date; end?: Date }>({})
  // simple events
  const [simpleEventSource, setSimpleEventSource] = useState<FinderSimpleEventSource | null>(null)
  const [simpleEventReason, setSimpleEventReason] = useState<FinderSimpleEventReason | null>(null)
  const [simpleEventDateRange, setSimpleEventDateRange] = useState<{ start?: Date; end?: Date }>({})
  const [requireDeal, setRequireDealState] = useState(false)
  const setRequireDeal = (value: SetStateAction<boolean>) => { clearSavedFields('require_deal'); setRequireDealState(value) }
  const [requireSiteVisit, setRequireSiteVisitState] = useState(false)
  const setRequireSiteVisit = (value: SetStateAction<boolean>) => { clearSavedFields('require_site_visit'); setRequireSiteVisitState(value) }

  const [sectionOpenDefaults, setSectionOpenDefaults] = useState({
    name: false,
    jobTitle: false,
    personIndustry: false,
    personLocation: false,
    skills: false,
    personLinkedin: false,
    company: false,
    domains: false,
    compLocInd: false,
    sizeFounded: false,
    foundedDate: false,
    companyLinkedin: false,
    jobPostings: false,
    funding: false,
    technologies: false,
    signals: false,
    crmActivity: false,
  })
  // Debug: Monitor domain state changes
  useEffect(() => {
    console.log('[People] Domain state changed:', {
      orgDomains,
      orgDomainsInputText,
      orgBulkDomain,
      personLinkedinIds,
      personLinkedinIdsInputText,
      orgLinkedinIds,
      orgLinkedinIdsInputText,
      timestamp: new Date().toISOString()
    })
  }, [orgDomains, orgDomainsInputText, orgBulkDomain, personLinkedinIds, personLinkedinIdsInputText, orgLinkedinIds, orgLinkedinIdsInputText])
  // format YYYY-MM-DD
  const toYmd = (d?: Date) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : undefined

  // build payload for server (page is 0-based)
  /** All terms (chips + current input) as separate elements for OR semantics on the backend. */
  const personNameTerms = useMemo(
    () => Array.from(new Set([...personNameChips, personNameInput.trim()].filter(Boolean))),
    [personNameChips, personNameInput]
  )
  const personHeadlineTerms = useMemo(
    () => Array.from(new Set([...personHeadlineChips, personHeadlineInput.trim()].filter(Boolean))),
    [personHeadlineChips, personHeadlineInput]
  )
  const jobTitleTerms = useMemo(
    () => Array.from(new Set([...jobTitleChips, jobTitleInput.trim()].filter(Boolean))),
    [jobTitleChips, jobTitleInput]
  )
  const jobPostingTitleTerms = useMemo(
    () => Array.from(new Set([...jobPostingTitleChips, jobPostingTitleInput.trim()].filter(Boolean))),
    [jobPostingTitleChips, jobPostingTitleInput]
  )
  const jobPostingDescriptionTerms = useMemo(
    () => Array.from(new Set([...jobPostingDescriptionChips, jobPostingDescriptionInput.trim()].filter(Boolean))),
    [jobPostingDescriptionChips, jobPostingDescriptionInput]
  )

  const wrapInQuotesIfNeeded = (value: string | undefined): string | undefined => {
    if (!value || value.trim() === '') return value
    const trimmed = value.trim()
    // If it contains spaces and is not already wrapped in quotes, wrap it
    if (trimmed.includes(' ') && !trimmed.startsWith('"') && !trimmed.endsWith('"')) {
      return `"${trimmed}"`
    }
    return trimmed
  }
  const termsToPayload = (terms: string[]): string | string[] | undefined => {
    if (terms.length === 0) return undefined
    if (terms.length === 1) return wrapInQuotesIfNeeded(terms[0]) ?? undefined
    return terms.map((t) => wrapInQuotesIfNeeded(t) ?? t)
  }

  const buildFinderPayload = (pageOneBased: number): FinderRequest => {
    const roleStart = toYmd(roleDateSince)
    const roleEnd = toYmd(roleDateUntil)
    const jobStart = toYmd(jobFeaturedDateFrom)
    const jobEnd = toYmd(jobFeaturedDateTo)
    const fundStart = toYmd(fundingDateRange.start)
    const fundEnd = toYmd(fundingDateRange.end)

  const companyFilters = buildCompanyFilters(companies, companyInput)
  const companyDomains = companyFilters.organization_domains

  // Debug: Log domain-related values
  console.log('[People] Domain debug:', {
    companies,
    companyDomains,
    orgDomains,
    orgDomainsInputText,
    orgBulkDomain,
    domainRankFrom,
    domainRankTo,
    personLinkedinIds,
    personLinkedinIdsInputText,
    orgLinkedinIds,
    orgLinkedinIdsInputText
  })

    const payload: FinderRequest = {
      site_id: currentSite?.id,
      page: Math.max(0, pageOneBased - 1),
      role_title: termsToPayload(jobTitleTerms),
      role_description: wrapInQuotesIfNeeded(query) || undefined,
      role_is_current: isCurrentRole,
      role_position_start_date: roleStart,
      role_position_end_date: roleEnd,
      role_years_on_position_start: typeof roleYearsOnPositionStart === 'number' ? roleYearsOnPositionStart : undefined,
      role_years_on_position_end: typeof roleYearsOnPositionEnd === 'number' ? roleYearsOnPositionEnd : undefined,

      person_name: termsToPayload(personNameTerms),
      person_headline: termsToPayload(personHeadlineTerms),
      person_description: wrapInQuotesIfNeeded(personDescription) || undefined,
      ...buildPersonLocationFilters(locations, personLocationInput),

      ...buildLookupFilter("person_industries", industries, lookupDrafts.person_industries),

      ...buildLookupFilter("person_industries_exclude", personIndustriesExclude, lookupDrafts.person_industries_exclude),

      person_linkedin_public_identifiers: (() => {
        const all = Array.from(new Set([
          ...(personLinkedinIds || []),
          ...(personLinkedinIdsInputText.trim() ? [personLinkedinIdsInputText.trim()] : [])
        ]))
        return all.length ? all : undefined
      })(),

      ...buildLookupFilter("person_skills", skills, lookupDrafts.person_skills),

      organizations: companyFilters.organizations,
      organization_names: companyFilters.organization_names,
      ...buildLookupFilter("organization_keywords", keywords, lookupDrafts.organization_keywords),
      organization_domains: (() => {
        const all = Array.from(new Set([
          ...(companyDomains || []),
          ...(orgDomains || []),
          ...(orgDomainsInputText.trim() ? [orgDomainsInputText.trim()] : [])
        ]))
        return all.length ? all : undefined
      })(),
      organizations_bulk_domain: wrapInQuotesIfNeeded(orgBulkDomain) || undefined,
      organization_description: wrapInQuotesIfNeeded(orgDescription) || undefined,
      ...buildLookupFilter("organization_locations", orgLocations, lookupDrafts.organization_locations),
      ...buildLookupFilter("organization_industries", orgIndustries, lookupDrafts.organization_industries),
      ...buildLookupFilter("organization_industries_exclude", orgIndustriesExclude, lookupDrafts.organization_industries_exclude),
      organization_employees_start: typeof employeeFrom === 'number' ? employeeFrom : undefined,
      organization_employees_end: typeof employeeTo === 'number' ? employeeTo : undefined,
      organization_revenue_start: typeof revenueFrom === 'number' ? revenueFrom : undefined,
      organization_revenue_end: typeof revenueTo === 'number' ? revenueTo : undefined,
      organization_domain_rank_start: typeof domainRankFrom === 'number' ? domainRankFrom : undefined,
      organization_domain_rank_end: typeof domainRankTo === 'number' ? domainRankTo : undefined,
      ...buildLookupFilter("organization_web_technologies", technologies, lookupDrafts.organization_web_technologies),

      organization_founded_date_start: toYmd(orgFoundedRange.start),
      organization_founded_date_end: toYmd(orgFoundedRange.end),

      organization_linkedin_public_identifiers: (() => {
        const all = Array.from(new Set([
          ...(orgLinkedinIds || []),
          ...(orgLinkedinIdsInputText.trim() ? [orgLinkedinIdsInputText.trim()] : [])
        ]))
        return all.length ? all : undefined
      })(),

      simple_event_source: simpleEventSource ?? undefined,
      simple_event_reason: simpleEventReason ?? undefined,
      simple_event_date_featured_start: toYmd(simpleEventDateRange.start),
      simple_event_date_featured_end: toYmd(simpleEventDateRange.end),

      funding_types: fundingType ? [fundingType] : undefined,
      funding_total_start:
        fundingRangeTouched && fundingRange && (fundingRange[0] !== 0 || fundingRange[1] !== 0)
          ? Math.min(fundingRange[0], fundingRange[1])
          : undefined,
      funding_total_end:
        fundingRangeTouched && fundingRange && (fundingRange[0] !== 0 || fundingRange[1] !== 0)
          ? Math.max(fundingRange[0], fundingRange[1])
          : undefined,
      funding_event_date_featured_start: fundStart,
      funding_event_date_featured_end: fundEnd,

      job_post_title: termsToPayload(jobPostingTitleTerms),
      job_post_description: termsToPayload(jobPostingDescriptionTerms),
      job_post_is_remote: includeRemote || undefined,
      job_post_is_active: isJobActive || undefined,
      job_post_date_featured_start: jobStart,
      job_post_date_featured_end: jobEnd,
      ...buildLookupFilter("job_post_locations", jobLocations, lookupDrafts.job_post_locations),
      ...buildLookupFilter("job_post_locations_exclude", jobLocationsExclude, lookupDrafts.job_post_locations_exclude),

      ...(requireDeal ? { require_deal: true } : {}),
      ...(requireSiteVisit ? { require_site_visit: true } : {}),
      ...savedValues,
    }

    // Debug: Log the complete payload before returning
    console.log('[People] Complete payload:', JSON.stringify(payload, null, 2))
    console.log('[People] Domain fields in payload:', {
      organization_domains: payload.organization_domains,
      organizations_bulk_domain: payload.organizations_bulk_domain,
      organization_domain_rank_start: payload.organization_domain_rank_start,
      organization_domain_rank_end: payload.organization_domain_rank_end
    })

    return payload
  }
  return {
    setSavedFilterValues,
    lookupDraftSetters,
    query,
    setQuery,
    industries,
    setIndustries,
    personIndustriesExclude,
    setPersonIndustriesExclude,
    locations,
    setLocations,
    setPersonLocationInput,
    employeeFrom,
    setEmployeeFrom,
    employeeTo,
    setEmployeeTo,
    revenueFrom,
    setRevenueFrom,
    revenueTo,
    setRevenueTo,
    domainRankFrom,
    setDomainRankFrom,
    domainRankTo,
    setDomainRankTo,
    personNameChips,
    setPersonNameChips,
    personNameInput,
    setPersonNameInput,
    personHeadlineChips,
    setPersonHeadlineChips,
    personHeadlineInput,
    setPersonHeadlineInput,
    jobTitleChips,
    setJobTitleChips,
    jobTitleInput,
    setJobTitleInput,
    skills,
    setSkills,
    companies,
    setCompanies,
    companyInput,
    setCompanyInput,
    keywords,
    setKeywords,
    personLinkedinIds,
    setPersonLinkedinIds,
    personLinkedinIdsInputText,
    setPersonLinkedinIdsInputText,
    isCurrentRole,
    setIsCurrentRole,
    roleDateSince,
    setRoleDateSince,
    roleDateUntil,
    setRoleDateUntil,
    roleYearsOnPositionStart,
    setRoleYearsOnPositionStart,
    roleYearsOnPositionEnd,
    setRoleYearsOnPositionEnd,
    personDescription,
    setPersonDescription,
    jobPostingTitleChips,
    setJobPostingTitleChips,
    jobPostingTitleInput,
    setJobPostingTitleInput,
    jobPostingDescriptionChips,
    setJobPostingDescriptionChips,
    jobPostingDescriptionInput,
    setJobPostingDescriptionInput,
    jobFeaturedDateFrom,
    setJobFeaturedDateFrom,
    jobFeaturedDateTo,
    setJobFeaturedDateTo,
    includeRemote,
    setIncludeRemote,
    isJobActive,
    setIsJobActive,
    jobLocations,
    setJobLocations,
    jobLocationsExclude,
    setJobLocationsExclude,
    fundingRange,
    setFundingRange,
    fundingType,
    setFundingType,
    fundingDateRange,
    setFundingDateRange,
    fundingRangeTouched,
    setFundingRangeTouched,
    technologies,
    setTechnologies,
    orgDomains,
    setOrgDomains,
    orgDomainsInputText,
    setOrgDomainsInputText,
    orgBulkDomain,
    setOrgBulkDomain,
    orgDescription,
    setOrgDescription,
    orgLocations,
    setOrgLocations,
    orgIndustries,
    setOrgIndustries,
    orgIndustriesExclude,
    setOrgIndustriesExclude,
    orgLinkedinIds,
    setOrgLinkedinIds,
    orgLinkedinIdsInputText,
    setOrgLinkedinIdsInputText,
    orgFoundedRange,
    setOrgFoundedRange,
    simpleEventSource,
    setSimpleEventSource,
    simpleEventReason,
    setSimpleEventReason,
    simpleEventDateRange,
    setSimpleEventDateRange,
    requireDeal,
    setRequireDeal,
    requireSiteVisit,
    setRequireSiteVisit,
    sectionOpenDefaults,
    setSectionOpenDefaults,
    toYmd,
    personNameTerms,
    personHeadlineTerms,
    jobTitleTerms,
    jobPostingTitleTerms,
    jobPostingDescriptionTerms,
    wrapInQuotesIfNeeded,
    termsToPayload,
    buildFinderPayload,
  }
}
export type PeopleFilters = ReturnType<typeof usePeopleFilters>
