// Finder request types based on server route contract
import type { LookupFilterNames } from './lookup-filters'
export type FinderFundingType =
  | 'angel' | 'seed' | 'series_a' | 'series_b' | 'series_c' | 'grant' | string

export type FinderSimpleEventSource = 'product_hunt' | 'form_c_sec_gov' | 'form_d_sec_gov'
export type FinderSimpleEventReason = 'report_released' | 'promoted_on_site'

export interface FinderRequest extends LookupFilterNames {
  site_id?: string
  page?: number

  /** Single string or array of terms for OR semantics. */
  role_title?: string | string[]
  role_description?: string
  role_is_current?: boolean
  role_position_start_date?: string
  role_position_end_date?: string
  role_years_on_position_start?: number
  role_years_on_position_end?: number

  /** Single string (legacy) or array of terms for OR semantics (e.g. "sergio" OR "juan"). */
  person_name?: string | string[]
  /** Single string or array of terms for OR semantics. */
  person_headline?: string | string[]
  person_description?: string
  person_skills?: number[]
  person_locations?: number[]
  person_location_names?: string[]
  person_industries?: number[]
  person_industries_exclude?: number[]
  person_linkedin_public_identifiers?: string[]

  organizations?: number[]
  organization_names?: string[]
  organizations_bulk_domain?: string
  organization_domains?: string[]
  organization_description?: string
  organization_locations?: number[]
  organization_industries?: number[]
  organization_industries_exclude?: number[]
  organization_keywords?: number[]
  organization_web_technologies?: number[]
  organization_founded_date_start?: string
  organization_founded_date_end?: string
  organization_employees_start?: number
  organization_employees_end?: number
  organization_revenue_start?: number
  organization_revenue_end?: number
  organization_domain_rank_start?: number
  organization_domain_rank_end?: number
  organization_linkedin_public_identifiers?: string[]

  funding_types?: FinderFundingType[]
  funding_total_start?: number
  funding_total_end?: number
  funding_event_date_featured_start?: string
  funding_event_date_featured_end?: string

  /** Single string or array of terms for OR semantics. */
  job_post_title?: string | string[]
  /** Single string or array of terms for OR semantics. */
  job_post_description?: string | string[]
  job_post_is_remote?: boolean | null
  job_post_is_active?: boolean | null
  job_post_date_featured_start?: string
  job_post_date_featured_end?: string
  job_post_locations?: number[]
  job_post_locations_exclude?: number[]

  simple_event_source?: FinderSimpleEventSource
  simple_event_reason?: FinderSimpleEventReason
  simple_event_date_featured_start?: string
  simple_event_date_featured_end?: string

  /** Scope to people linked to a deal for the current site (requires site_id). */
  require_deal?: boolean
  /** Scope to people with tracked visits for the current site (requires site_id). */
  require_site_visit?: boolean
}

export const DEFAULT_PAGE_SIZE = 10
