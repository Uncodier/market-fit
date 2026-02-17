"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { cn } from "@/lib/utils"
import { useLayout } from "@/app/context/LayoutContext"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Card, CardContent } from "@/app/components/ui/card"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Avatar, AvatarImage, AvatarFallback } from "@/app/components/ui/avatar"
import { Pagination } from "@/app/components/ui/pagination"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SidebarToggle } from "@/app/control-center/components/SidebarToggle"
import { Breadcrumb } from "@/app/components/navigation/Breadcrumb"
import { Search, ChevronUp, ChevronDown, ChevronRight, X, MoreHorizontal, MoreVertical, Globe, Check, CheckCircle2, RotateCw, Clock } from "@/app/components/ui/icons"
import { LinkedInIcon } from "@/app/components/ui/social-icons"
import { Badge } from "@/app/components/ui/badge"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Switch } from "@/app/components/ui/switch"
import { Slider } from "@/app/components/ui/slider"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { useSite } from "@/app/context/SiteContext"
import { getSegments } from "@/app/segments/actions"
import { createClient } from "@/lib/supabase/client"

type Person = {
  id: string
  name: string
  roleTitle: string
  company: string
  companyLogoUrl?: string
  location: string
  phone?: string
  personalEmails?: number
  positionStart?: string
  positionEnd?: string
  avatarUrl?: string
}

// Generic option returned by autocomplete endpoints
interface LookupOption {
  id?: number | string | null
  text: string
}

// Finder request types based on server route contract
type FinderFundingType =
  | 'angel' | 'seed' | 'series_a' | 'series_b' | 'series_c' | 'grant' | string

type FinderSimpleEventSource = 'product_hunt' | 'form_c_sec_gov' | 'form_d_sec_gov'
type FinderSimpleEventReason = 'report_released' | 'promoted_on_site'

interface FinderRequest {
  page?: number

  role_title?: string
  role_description?: string
  role_is_current?: boolean
  role_position_start_date?: string
  role_position_end_date?: string
  role_years_on_position_start?: number
  role_years_on_position_end?: number

  person_name?: string
  person_headline?: string
  person_description?: string
  person_skills?: number[]
  person_locations?: number[]
  person_industries?: number[]
  person_industries_exclude?: number[]
  person_linkedin_public_identifiers?: string[]

  organizations?: number[]
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

  job_post_title?: string
  job_post_description?: string
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
}

// Default page size assumed by server (used for UI range display)
const DEFAULT_PAGE_SIZE = 10

interface CollapsibleFieldProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  countBadge?: number
  onClear?: () => void
  onOpenChange?: (open: boolean) => void
}

function CollapsibleField({ title, children, defaultOpen = true, countBadge, onClear, onOpenChange }: CollapsibleFieldProps) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => {
    setOpen(defaultOpen)
  }, [defaultOpen])
  const handleToggle = () => {
    const newOpen = !open
    setOpen(newOpen)
    onOpenChange?.(newOpen)
  }
  return (
    <div className="rounded-lg border border-border/30 bg-muted/40 transition-colors hover:bg-muted/70 hover:border-border">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          {typeof countBadge === "number" && countBadge > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-xs rounded-full border border-border/40 px-2 py-0.5 text-muted-foreground bg-background/60">
                {countBadge}
              </span>
              {onClear && (
                <button
                  type="button"
                  className="text-xs rounded-full border border-border/40 px-2 py-0.5 text-muted-foreground hover:bg-muted"
                  onClick={(e) => { e.stopPropagation(); onClear() }}
                  aria-label={`Clear ${title}`}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      {open && (
        <div className="px-4 py-3 border-t border-border/30 bg-background/40">
          {children}
        </div>
      )}
    </div>
  )
}

function ChipsInput({ values, onChange, placeholder = "Search", onTextChange }: { values: string[]; onChange: (next: string[]) => void; placeholder?: string; onTextChange?: (text: string) => void }) {
  const [text, setText] = useState("")
  const add = () => {
    const v = text.trim()
    if (!v) return
    onChange(Array.from(new Set([...values, v])))
    setText("")
    if (onTextChange) onTextChange("")
  }
  return (
    <div className="space-y-2">
      <Input
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const newValue = e.target.value
          setText(newValue)
          if (onTextChange) onTextChange(newValue)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
        className="h-10"
      />
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-2 py-1">
              {v}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="hover:text-destructive"
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">Press "Enter" to add to search.</p>
    </div>
  )
}

// Debounce helper
function debounce<T extends (...args: any[]) => any>(fn: T, delay = 300) {
  let t: any
  return (...args: Parameters<T>) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

// Generic async lookup chips input
function LookupChipsInput({
  values,
  onChange,
  placeholder = "Search",
  fetcher
}: {
  values: LookupOption[]
  onChange: (next: LookupOption[]) => void
  placeholder?: string
  fetcher: (query: string) => Promise<LookupOption[]>
}) {
  const [text, setText] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<LookupOption[]>([])
  const listRef = useRef<HTMLDivElement | null>(null)

  const doSearch = debounce(async (q: string) => {
    if (!q) { setSuggestions([]); return }
    try {
      setLoading(true)
      const res = await fetcher(q)
      const existingTexts = new Set(values.map(v => v.text))
      setSuggestions(res.filter(s => !existingTexts.has(s.text)))
      // Ensure the list shows from the top on each new query
      setTimeout(() => { if (listRef.current) listRef.current.scrollTop = 0 }, 0)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, 250)

  const add = (v: string | LookupOption) => {
    const val = typeof v === 'string' ? v.trim() : v.text
    if (!val) return
    const option: LookupOption = typeof v === 'string' ? { id: null, text: val } : v
    // Avoid duplicates by text
    const seen = new Set(values.map(x => x.text))
    const next = seen.has(option.text) ? values : [...values, option]
    onChange(next)
    setText("")
    setOpen(false)
  }

  // Keep the suggestions list scrolled to the very top when opening or updating
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = 0
    }
  }, [open, suggestions.length])

  return (
    <div className="relative space-y-2">
      <Input
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const v = e.target.value
          setText(v)
          setOpen(true)
          doSearch(v)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add(text)
          }
        }}
        className="h-10"
      />
      {open && suggestions.length > 0 && (
        <div ref={listRef} className="absolute z-20 top-[44px] left-0 right-0 border bg-background rounded-md shadow-sm max-h-56 overflow-y-auto overflow-x-hidden divide-y max-w-full !flex !flex-col items-start">
          {suggestions.map(s => (
            <button
              key={`${s.id ?? s.text}`}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted leading-snug"
              onClick={() => add(s)}
              title={s.text}
            >
              <span className="block truncate">{s.text}</span>
            </button>
          ))}
        </div>
      )}
      {values.length > 0 && (
        <div className="flex flex-row flex-wrap gap-2 items-center justify-start">
          {values.map((v) => (
            <span key={`${v.id ?? v.text}`} className="inline-flex items-center gap-1 text-xs rounded-full bg-muted px-2 py-1">
              {v.text}
              <button
                type="button"
                onClick={() => onChange(values.filter((x) => x.text !== v.text))}
                className="hover:text-destructive"
                aria-label={`Remove ${v.text}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {loading && <p className="text-xs text-muted-foreground">Searching…</p>}
    </div>
  )
}

// Centralized lookup fetcher: hits external Finder autocomplete endpoints
async function lookupFetcher(type: string, q: string): Promise<LookupOption[]> {
  // Map UI field keys to server categories
  const categoryMap: Record<string, string> = {
    industries: 'industries',
    organizations: 'organizations',
    org_keywords: 'organization_keywords',
    locations: 'locations',
    skills: 'person_skills',
    web_technologies: 'web_technologies'
  }

  const category = categoryMap[type] || type

  try {
    const res = await apiClient.get(`/api/finder/autocomplete/${encodeURIComponent(category)}?q=${encodeURIComponent(q)}&page=0`, { includeAuth: false })
    if (!res.success) throw new Error(res.error?.message || 'lookup failed')
    const data: any = res.data
    const results = Array.isArray(data?.results) ? data.results : []
    return results
      .map((r: any) => ({ id: r?.id ?? null, text: r?.text }))
      .filter((v: any) => typeof v.text === 'string' && v.text.length > 0)
  } catch {
    // Fallback local suggestions for development
    const samples: Record<string, string[]> = {
      industries: ["Health", "Finance", "Insurance", "Retail", "SaaS", "E-commerce"],
      organizations: ["Acme Corp", "Globex", "Umbrella", "Initech", "Stark Industries"],
      org_keywords: ["Fintech", "Insurtech", "AI", "Cloud", "Cybersecurity"],
      locations: ["São Paulo", "Mexico City", "Bogotá", "Lima", "Buenos Aires"],
      skills: ["React", "Node.js", "Python", "Sales", "Marketing"],
      web_technologies: ["Next.js", "Vue", "Angular", "Django", "Rails"]
    }
    const arr = (samples as any)[type]?.filter((s: string) => s.toLowerCase().includes(q.toLowerCase())) || []
    return arr.map((text: string) => ({ id: null, text }))
  }
}

export default function PeopleSearchPage() {
  const { isLayoutCollapsed } = useLayout()
  const { currentSite } = useSite()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [sidebarLeft, setSidebarLeft] = useState("256px")

  // filters
  const [query, setQuery] = useState("")
  const [industries, setIndustries] = useState<LookupOption[]>([])
  const [personIndustriesExclude, setPersonIndustriesExclude] = useState<LookupOption[]>([])
  const [locations, setLocations] = useState<LookupOption[]>([])
  const [employeeFrom, setEmployeeFrom] = useState<number | "">("")
  const [employeeTo, setEmployeeTo] = useState<number | "">("")
  const [revenueFrom, setRevenueFrom] = useState<number | "">("")
  const [revenueTo, setRevenueTo] = useState<number | "">("")
  const [domainRankFrom, setDomainRankFrom] = useState<number | "">("")
  const [domainRankTo, setDomainRankTo] = useState<number | "">("")
  // single-string filters
  const [personName, setPersonName] = useState<string>("")
  const [personHeadline, setPersonHeadline] = useState<string>("")
  const [jobTitle, setJobTitle] = useState<string>("")
  const [skills, setSkills] = useState<LookupOption[]>([])
  const [companies, setCompanies] = useState<LookupOption[]>([])
  const [keywords, setKeywords] = useState<LookupOption[]>([])
  const [personLinkedinIds, setPersonLinkedinIds] = useState<string[]>([])
  const [personLinkedinIdsInputText, setPersonLinkedinIdsInputText] = useState<string>("")
  const [isCurrentRole, setIsCurrentRole] = useState(true)
  const [roleDateSince, setRoleDateSince] = useState<Date | undefined>(undefined)
  const [roleDateUntil, setRoleDateUntil] = useState<Date | undefined>(undefined)
  // job postings
  const [jobPostingTitle, setJobPostingTitle] = useState<string>("")
  const [jobPostingDescription, setJobPostingDescription] = useState("")
  const [jobFeaturedDateFrom, setJobFeaturedDateFrom] = useState<Date | undefined>(undefined)
  const [jobFeaturedDateTo, setJobFeaturedDateTo] = useState<Date | undefined>(undefined)
  const [includeRemote, setIncludeRemote] = useState(false)
  const [isJobActive, setIsJobActive] = useState(false)
  const [jobLocations, setJobLocations] = useState<LookupOption[]>([])
  const [jobLocationsExclude, setJobLocationsExclude] = useState<LookupOption[]>([])
  // funding
  const [fundingRange, setFundingRange] = useState<[number, number]>([50000, 50000])
  const [fundingType, setFundingType] = useState<string>("")
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

  // pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [pageJump, setPageJump] = useState<string>("")

  // remote data state
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [totalResults, setTotalResults] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [addingToLeads, setAddingToLeads] = useState(false)
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false)
  const [segmentsLoading, setSegmentsLoading] = useState(false)
  const [availableSegments, setAvailableSegments] = useState<Array<{ id: string; name: string }>>([])
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | 'none'>('none')
  const [icpName, setIcpName] = useState<string>("")
  const [isIcpModalOpen, setIsIcpModalOpen] = useState(false)
  const [icpListLoading, setIcpListLoading] = useState(false)
  const [availableIcps, setAvailableIcps] = useState<Array<{ 
    id: string; 
    name: string | null; 
    status?: string | null; 
    role_query_id: string;
    total_targets?: number;
    processed_targets?: number;
    found_matches?: number;
    progress_percent?: string;
    started_at?: string | null;
    last_progress_at?: string | null;
    finished_at?: string | null;
  }>>([])
  const [selectedIcpId, setSelectedIcpId] = useState<string | 'none'>('none')
  const [collapsibleVersion, setCollapsibleVersion] = useState(0)
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([])
  const [isEnriching, setIsEnriching] = useState(false)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [addedPersonIds, setAddedPersonIds] = useState<Set<string>>(new Set())
  const [isEditIcpModalOpen, setIsEditIcpModalOpen] = useState(false)
  const [editingIcp, setEditingIcp] = useState<{ id: string; name: string | null; role_query_id: string } | null>(null)
  const [editingIcpName, setEditingIcpName] = useState<string>("")
  const [editingIcpSegmentId, setEditingIcpSegmentId] = useState<string | 'none'>('none')
  const [editingIcpSegmentsLoading, setEditingIcpSegmentsLoading] = useState(false)
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
  })

  useEffect(() => {
    setSidebarLeft(isLayoutCollapsed ? "64px" : "256px")
  }, [isLayoutCollapsed])

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

  // Helper function to load ICP data
  const handleLoadIcp = async (icpId: string) => {
    try {
      if (!currentSite?.id) return
      const res = await apiClient.get(`/api/finder/icp?icp_id=${encodeURIComponent(icpId)}&site_id=${encodeURIComponent(currentSite.id)}`)
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to load saved list')
      }
      const q = (res.data as any)?.role_query?.query || {}
      // Apply basic fields to UI
      const parseDate = (s?: string) => (s ? new Date(s) : undefined)
      const toLookupFromIds = (arr?: any[]) => (Array.isArray(arr) ? arr.map((id: any) => ({ id: (typeof id === 'string' ? Number(id) : id), text: `ID ${id}` })) : [])
      setJobTitle(q.role_title || '')
      setQuery(q.role_description || '')
      setIsCurrentRole(Boolean(q.role_is_current))
      setRoleDateSince(parseDate(q.role_position_start_date))
      setRoleDateUntil(parseDate(q.role_position_end_date))
      setPersonName(q.person_name || '')
      setPersonHeadline(q.person_headline || '')
      // Clear complex chip-based filters; user can refine as needed
      setSkills([])
      // Person locations from IDs
      setLocations(toLookupFromIds(q.person_locations))
      setIndustries([])
      setPersonIndustriesExclude([])
      setCompanies([])
      setKeywords([])
      setOrgDomains([])
      setOrgDomainsInputText("")
      setOrgLinkedinIds([])
      setOrgLinkedinIdsInputText("")
      setPersonLinkedinIds([])
      setPersonLinkedinIdsInputText("")
      // Organization locations from IDs
      setOrgLocations(toLookupFromIds(q.organization_locations))
      setOrgIndustries([])
      setOrgIndustriesExclude([])
      // Job posting locations from IDs
      setJobLocations(toLookupFromIds(q.job_post_locations))
      setJobLocationsExclude(toLookupFromIds(q.job_post_locations_exclude))
      setIncludeRemote(Boolean(q.job_post_is_remote))
      setIsJobActive(Boolean(q.job_post_is_active))
      setJobPostingTitle(q.job_post_title || '')
      setJobPostingDescription(q.job_post_description || '')
      setJobFeaturedDateFrom(parseDate(q.job_post_date_featured_start))
      setJobFeaturedDateTo(parseDate(q.job_post_date_featured_end))
      setFundingDateRange({ start: parseDate(q.funding_event_date_featured_start), end: parseDate(q.funding_event_date_featured_end) })
      if (typeof q.funding_total_start === 'number' && typeof q.funding_total_end === 'number') {
        setFundingRange([q.funding_total_start, q.funding_total_end])
        setFundingRangeTouched(true)
      } else {
        setFundingRange([50000, 50000])
        setFundingRangeTouched(false)
      }
      // Company size (employees)
      if (typeof q.organization_employees_start === 'number') {
        setEmployeeFrom(q.organization_employees_start)
      }
      if (typeof q.organization_employees_end === 'number') {
        setEmployeeTo(q.organization_employees_end)
      }
      setSimpleEventSource(q.simple_event_source ?? null)
      setSimpleEventReason(q.simple_event_reason ?? null)
      setSimpleEventDateRange({ start: parseDate(q.simple_event_date_featured_start), end: parseDate(q.simple_event_date_featured_end) })
      // Decide which cards to open by default based on loaded query
      const openDefaults = {
        name: Boolean(q.person_name || q.person_headline || (q.person_linkedin_public_identifiers && q.person_linkedin_public_identifiers.length > 0)),
        jobTitle: Boolean(q.role_title || q.role_description || q.role_position_start_date || q.role_position_end_date || q.role_is_current),
        personIndustry: Boolean((q.person_industries && q.person_industries.length) || (q.person_industries_exclude && q.person_industries_exclude.length)),
        personLocation: Boolean(q.person_locations && q.person_locations.length),
        skills: Boolean(q.person_skills && q.person_skills.length),
        personLinkedin: Boolean(q.person_linkedin_public_identifiers && q.person_linkedin_public_identifiers.length),
        company: Boolean(q.organizations || q.organization_description || q.organization_linkedin_public_identifiers),
        domains: Boolean((q.organization_domains && q.organization_domains.length) || q.organizations_bulk_domain),
        compLocInd: Boolean((q.organization_locations && q.organization_locations.length) || (q.organization_industries && q.organization_industries.length) || (q.organization_industries_exclude && q.organization_industries_exclude.length) || (q.organization_keywords && q.organization_keywords.length)),
        sizeFounded: Boolean(q.organization_employees_start || q.organization_employees_end || q.organization_revenue_start || q.organization_revenue_end || q.organization_founded_date_start || q.organization_founded_date_end),
        foundedDate: Boolean(q.organization_founded_date_start || q.organization_founded_date_end),
        companyLinkedin: Boolean(q.organization_linkedin_public_identifiers && q.organization_linkedin_public_identifiers.length),
        jobPostings: Boolean(q.job_post_title || q.job_post_description || q.job_post_is_remote || q.job_post_is_active || q.job_post_date_featured_start || q.job_post_date_featured_end || (q.job_post_locations && q.job_post_locations.length) || (q.job_post_locations_exclude && q.job_post_locations_exclude.length)),
        funding: Boolean(q.funding_types || typeof q.funding_total_start === 'number' || typeof q.funding_total_end === 'number' || q.funding_event_date_featured_start || q.funding_event_date_featured_end),
        technologies: Boolean(q.organization_web_technologies && q.organization_web_technologies.length),
        signals: Boolean(q.simple_event_source || q.simple_event_reason || q.simple_event_date_featured_start || q.simple_event_date_featured_end),
      }
      setSectionOpenDefaults(openDefaults)
      setCollapsibleVersion(v => v + 1)
      setIsIcpModalOpen(false)
      toast.success('Saved list loaded')
      // Trigger search with the loaded setup (build payload directly from q to avoid async state race)
      setCurrentPage(1)
      const payloadFromQ: FinderRequest = {
        page: 0,
        role_title: q.role_title || undefined,
        role_description: q.role_description || undefined,
        role_is_current: q.role_is_current,
        role_position_start_date: q.role_position_start_date,
        role_position_end_date: q.role_position_end_date,
        person_name: q.person_name || undefined,
        person_headline: q.person_headline || undefined,
        person_locations: Array.isArray(q.person_locations) ? q.person_locations.map((v: any) => (typeof v === 'string' ? Number(v) : v)).filter((n: any) => typeof n === 'number' && Number.isFinite(n)) : undefined,
        organization_locations: Array.isArray(q.organization_locations) ? q.organization_locations.map((v: any) => (typeof v === 'string' ? Number(v) : v)).filter((n: any) => typeof n === 'number' && Number.isFinite(n)) : undefined,
        organization_employees_start: typeof q.organization_employees_start === 'number' ? q.organization_employees_start : undefined,
        organization_employees_end: typeof q.organization_employees_end === 'number' ? q.organization_employees_end : undefined,
        job_post_locations: Array.isArray(q.job_post_locations) ? q.job_post_locations.map((v: any) => (typeof v === 'string' ? Number(v) : v)).filter((n: any) => typeof n === 'number' && Number.isFinite(n)) : undefined,
        job_post_locations_exclude: Array.isArray(q.job_post_locations_exclude) ? q.job_post_locations_exclude.map((v: any) => (typeof v === 'string' ? Number(v) : v)).filter((n: any) => typeof n === 'number' && Number.isFinite(n)) : undefined,
      }
      await executeSearch(payloadFromQ)
    } catch (e) {
      console.error('[People] Load saved list error:', e)
      toast.error('Failed to load saved list')
    }
  }

  // Helper function to delete ICP
  const handleDeleteIcp = async (icpId: string) => {
    try {
      if (!currentSite?.id) return
      const res = await apiClient.delete(`/api/finder/icp?icp_id=${encodeURIComponent(icpId)}&site_id=${encodeURIComponent(currentSite.id)}`)
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to delete saved list')
      }
      // Remove from local state
      setAvailableIcps(prev => prev.filter(icp => icp.id !== icpId))
      toast.success('Saved list deleted')
    } catch (e) {
      console.error('[People] Delete saved list error:', e)
      toast.error('Failed to delete saved list')
    }
  }

  // Helper function to edit ICP name and segment
  const handleEditIcp = async () => {
    if (!editingIcp || !editingIcpName.trim()) {
      toast.error('Please enter a name')
      return
    }
    try {
      const supabase = createClient()
      
      // Update ICP name
      const { error: updateError } = await supabase
        .from('icp_mining')
        .update({ name: editingIcpName.trim() })
        .eq('id', editingIcp.id)
      
      if (updateError) throw updateError
      
      // Update segment association if changed
      if (editingIcpSegmentId !== 'none') {
        // Get current segment associations
        const { data: currentSegments, error: segError } = await supabase
          .from('role_query_segments')
          .select('segment_id')
          .eq('role_query_id', editingIcp.role_query_id)
        
        if (segError) throw segError
        
        const currentSegmentIds = (currentSegments || []).map((s: any) => s.segment_id)
        
        // If the selected segment is not in the current associations, add it
        if (!currentSegmentIds.includes(editingIcpSegmentId)) {
          // Remove all existing associations
          const { error: deleteError } = await supabase
            .from('role_query_segments')
            .delete()
            .eq('role_query_id', editingIcp.role_query_id)
          
          if (deleteError) throw deleteError
          
          // Add new association
          const { error: insertError } = await supabase
            .from('role_query_segments')
            .insert({
              role_query_id: editingIcp.role_query_id,
              segment_id: editingIcpSegmentId
            })
          
          if (insertError) throw insertError
        }
      }
      
      // Update local state
      setAvailableIcps(prev => prev.map(icp => 
        icp.id === editingIcp.id ? { ...icp, name: editingIcpName.trim() } : icp
      ))
      
      setIsEditIcpModalOpen(false)
      setEditingIcp(null)
      setEditingIcpName("")
      setEditingIcpSegmentId('none')
      toast.success('Saved list updated')
    } catch (e) {
      console.error('[People] Edit saved list error:', e)
      toast.error('Failed to update saved list')
    }
  }

  useEffect(() => {
    document.title = "Find People | Market Fit"
    const event = new CustomEvent("breadcrumb:update", {
      detail: { title: "Find People", path: "/people", section: "Find People" }
    })
    window.dispatchEvent(event)
    return () => { document.title = "Market Fit" }
  }, [])

  // Load ICPs when site is available
  useEffect(() => {
    const loadIcps = async () => {
      if (!currentSite?.id || availableIcps.length > 0 || icpListLoading) return
      try {
        setIcpListLoading(true)
        const supabase = createClient()
        // 1) Get segment ids for current site
        const { data: segs, error: segErr } = await supabase
          .from('segments')
          .select('id')
          .eq('site_id', currentSite.id)
        if (segErr) throw segErr
        const segmentIds = (segs || []).map((s: any) => s.id)
        if (segmentIds.length === 0) { setAvailableIcps([]); return }
        // 2) Get role_query_ids related to those segments
        const { data: rqs, error: rqErr } = await supabase
          .from('role_query_segments')
          .select('role_query_id')
          .in('segment_id', segmentIds)
        if (rqErr) throw rqErr
        const roleQueryIds = Array.from(new Set((rqs || []).map((r: any) => r.role_query_id)))
        if (roleQueryIds.length === 0) { setAvailableIcps([]); return }
        // 3) List ICPs for those role_query_ids
        const { data: icps, error: icpErr } = await supabase
          .from('icp_mining')
          .select('id, name, status, role_query_id, total_targets, processed_targets, found_matches, progress_percent, started_at, last_progress_at, finished_at')
          .in('role_query_id', roleQueryIds)
          .order('created_at', { ascending: false })
        if (icpErr) throw icpErr
        setAvailableIcps(icps || [])
      } catch (e) {
        console.error('[People] Load ICP list error:', e)
        setAvailableIcps([])
      } finally {
        setIcpListLoading(false)
      }
    }
    loadIcps()
  }, [currentSite?.id])

  // Update TopBar breadcrumb with results count
  useEffect(() => {
    const items = [
      { href: "/people", label: "Find People" },
      { href: "#", label: `${(totalResults || 0).toLocaleString()} results` }
    ]
    const event = new CustomEvent("breadcrumb:update", {
      detail: {
        title: "Find People",
        breadcrumb: (
          <Breadcrumb items={items} />
        )
      }
    })
    window.dispatchEvent(event)

    return () => {
      // Clear breadcrumb on unmount
      const clearEvent = new CustomEvent("breadcrumb:update", {
        detail: { title: "Find People", breadcrumb: null }
      })
      window.dispatchEvent(clearEvent)
    }
  }, [totalResults])

  // format YYYY-MM-DD
  const toYmd = (d?: Date) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : undefined

  // build payload for server (page is 0-based)
  // Utility function to wrap multi-word inputs in quotes for API compatibility
  const wrapInQuotesIfNeeded = (value: string | undefined): string | undefined => {
    if (!value || value.trim() === '') return value
    const trimmed = value.trim()
    // If it contains spaces and is not already wrapped in quotes, wrap it
    if (trimmed.includes(' ') && !trimmed.startsWith('"') && !trimmed.endsWith('"')) {
      return `"${trimmed}"`
    }
    return trimmed
  }

  const buildFinderPayload = (pageOneBased: number): FinderRequest => {
    const roleStart = toYmd(roleDateSince)
    const roleEnd = toYmd(roleDateUntil)
    const jobStart = toYmd(jobFeaturedDateFrom)
    const jobEnd = toYmd(jobFeaturedDateTo)
    const fundStart = toYmd(fundingDateRange.start)
    const fundEnd = toYmd(fundingDateRange.end)

  // Treat company chips added manually that look like domains as organization_domains
  const companyDomains = companies
    .filter(c => (!c.id || c.id === null) && /\./.test(c.text) && !/\s/.test(c.text))
    .map(c => c.text)

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
      page: Math.max(0, pageOneBased - 1),
      role_title: wrapInQuotesIfNeeded(jobTitle) || undefined,
      role_description: wrapInQuotesIfNeeded(query) || undefined,
      role_is_current: isCurrentRole,
      role_position_start_date: roleStart,
      role_position_end_date: roleEnd,

      person_name: wrapInQuotesIfNeeded(personName) || undefined,
      person_headline: wrapInQuotesIfNeeded(personHeadline) || undefined,
      person_locations: (() => {
        const ids = locations
          .map(l => (typeof l.id === 'string' ? Number(l.id) : l.id))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        return ids.length ? ids : undefined
      })(),

      person_industries: (() => {
        const ids = industries
          .map(l => (typeof l.id === 'string' ? Number(l.id) : l.id))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        return ids.length ? ids : undefined
      })(),

      person_industries_exclude: (() => {
        const ids = personIndustriesExclude
          .map(l => (typeof l.id === 'string' ? Number(l.id) : l.id))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        return ids.length ? ids : undefined
      })(),

      person_linkedin_public_identifiers: (() => {
        const all = Array.from(new Set([
          ...(personLinkedinIds || []),
          ...(personLinkedinIdsInputText.trim() ? [personLinkedinIdsInputText.trim()] : [])
        ]))
        return all.length ? all : undefined
      })(),

      person_skills: (() => {
        const ids = skills
          .map(l => (typeof l.id === 'string' ? Number(l.id) : l.id))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        return ids.length ? ids : undefined
      })(),

      organizations: (() => {
        const ids = companies
          .map(l => (typeof l.id === 'string' ? Number(l.id) : l.id))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        return ids.length ? ids : undefined
      })(),
      organization_keywords: (() => {
        const ids = keywords
          .map(l => (typeof l.id === 'string' ? Number(l.id) : l.id))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        return ids.length ? ids : undefined
      })(),
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
      organization_locations: (() => {
        const ids = orgLocations
          .map(l => (typeof l.id === 'string' ? Number(l.id) : l.id))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        return ids.length ? ids : undefined
      })(),
      organization_industries: (() => {
        const ids = orgIndustries
          .map(l => (typeof l.id === 'string' ? Number(l.id) : l.id))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        return ids.length ? ids : undefined
      })(),
      organization_industries_exclude: (() => {
        const ids = orgIndustriesExclude
          .map(l => (typeof l.id === 'string' ? Number(l.id) : l.id))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        return ids.length ? ids : undefined
      })(),
      organization_employees_start: typeof employeeFrom === 'number' ? employeeFrom : undefined,
      organization_employees_end: typeof employeeTo === 'number' ? employeeTo : undefined,
      organization_revenue_start: typeof revenueFrom === 'number' ? revenueFrom : undefined,
      organization_revenue_end: typeof revenueTo === 'number' ? revenueTo : undefined,
      organization_domain_rank_start: typeof domainRankFrom === 'number' ? domainRankFrom : undefined,
      organization_domain_rank_end: typeof domainRankTo === 'number' ? domainRankTo : undefined,
      organization_web_technologies: (() => {
        const ids = technologies
          .map(t => (typeof t.id === 'string' ? Number(t.id) : t.id))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        return ids.length ? ids : undefined
      })(),

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
      funding_total_start: fundingRangeTouched ? fundingRange?.[0] : undefined,
      funding_total_end: fundingRangeTouched ? fundingRange?.[1] : undefined,
      funding_event_date_featured_start: fundStart,
      funding_event_date_featured_end: fundEnd,

      job_post_title: wrapInQuotesIfNeeded(jobPostingTitle) || undefined,
      job_post_description: wrapInQuotesIfNeeded(jobPostingDescription) || undefined,
      job_post_is_remote: includeRemote || undefined,
      job_post_is_active: isJobActive || undefined,
      job_post_date_featured_start: jobStart,
      job_post_date_featured_end: jobEnd,
      job_post_locations: (() => {
        const ids = jobLocations
          .map(l => (typeof l.id === 'string' ? Number(l.id) : l.id))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        return ids.length ? ids : undefined
      })(),
      job_post_locations_exclude: (() => {
        const ids = jobLocationsExclude
          .map(l => (typeof l.id === 'string' ? Number(l.id) : l.id))
          .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        return ids.length ? ids : undefined
      })(),
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

  const executeSearch = async (payload: FinderRequest) => {
    setLoading(true)
    setError(null)
    try {
      // Debug: Log payload being sent
      console.log('[People] Sending request with payload:', JSON.stringify(payload, null, 2))
      
      const [res, totals] = await Promise.all([
        apiClient.post<{ search_results: any[]; total_search_results: number }>(
          '/api/finder/person_role_search',
          payload,
          { includeAuth: false }
        ),
        apiClient.post<{
          total_search_results: number;
          total_persons: number;
          total_organizations: number;
        }>(
          '/api/finder/person_role_search/totals',
          payload,
          { includeAuth: false }
        )
      ])
      if (!res.success) {
        throw new Error(res.error?.message || 'Finder request failed')
      }
      const data = res.data as any
      const totalsData = totals?.data as any
      setSearchResults(Array.isArray(data?.search_results) ? data.search_results : [])
      const computedTotal = typeof totalsData?.total_persons === 'number'
        ? totalsData.total_persons
        : (typeof data?.total_search_results === 'number' ? data.total_search_results : 0)
      setTotalResults(computedTotal)
    } catch (e: any) {
      console.error('[People] Finder error:', e)
      toast.error(e?.message || 'Finder request failed')
      setError(null)
      setSearchResults([])
      setTotalResults(0)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (page: number = 1) => {
    const payload = buildFinderPayload(page)
    await executeSearch(payload)
  }

  // Dynamic column widths depending on sidebar state to avoid horizontal scroll
  // Removed phone and emails columns; redistribute widths across remaining columns
  const tableColumnWidths = isSidebarCollapsed
    ? { name: 28, role: 14, company: 22, location: 12, start: 10, end: 10, links: 4 }
    : { name: 26, role: 14, company: 20, location: 16, start: 10, end: 10, links: 4 }

  // Calculate dynamic max width for main content based on left nav and filters sidebar
  const leftNavWidth = isLayoutCollapsed ? 64 : 256
  const filtersWidth = isSidebarCollapsed ? 0 : 319
  const contentMaxWidth = `calc(100vw - ${leftNavWidth + filtersWidth}px)`

  // Open modal and fetch segments
  const handleAddToLeads = async () => {
    setIsSegmentModalOpen(true)
    if (!currentSite?.id) return
    // Load only once per open if empty
    if (availableSegments.length > 0) return
    try {
      setSegmentsLoading(true)
      const res = await getSegments(currentSite.id)
      if (res?.segments) {
        setAvailableSegments(res.segments.map((s: any) => ({ id: s.id, name: s.name })))
      }
    } catch (e) {
      console.error('[People] Load segments error:', e)
    } finally {
      setSegmentsLoading(false)
    }
  }

  // Confirm add to leads with selected segment
  const handleConfirmAddToLeads = async () => {
    try {
      setAddingToLeads(true)
      const payload = buildFinderPayload(currentPage) as any
      if (!currentSite?.id) {
        throw new Error('Missing site_id')
      }
      payload.site_id = currentSite.id
      if (selectedSegmentId && selectedSegmentId !== 'none') {
        payload.segment_id = selectedSegmentId
      }
      if (icpName && icpName.trim().length > 0) {
        payload.name = icpName.trim()
      }
      // Add total_targets with current search results total
      payload.total_targets = totalResults
      const res = await apiClient.post('/api/finder/person_role_search/createQuery', payload, { includeAuth: false })
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to create query')
      }
      toast.success('Leads query created successfully')
      setIsSegmentModalOpen(false)
      setIcpName("")
    } catch (e: any) {
      console.error('[People] Add to leads error:', e)
      toast.error(e?.message || 'Failed to add leads')
    } finally {
      setAddingToLeads(false)
    }
  }

  const onClickSearch = () => {
    setCurrentPage(1)
    handleSearch(1)
  }

  const onPageChange = (page: number) => {
    setCurrentPage(page)
    handleSearch(page)
  }

  function mapResultToPerson(r: any): Person {
    const id = String(r?.id || r?.person?.id || r?.person_id)
    const name = r?.person?.full_name || r?.person?.name || r?.person_name || r?.name || 'Unknown'
    const roleTitle = r?.role_title || r?.role?.title || '—'
    const company = r?.organization?.name || r?.company?.name || r?.organization_name || '—'
    const companyLogoUrl = r?.organization?.logo || r?.company?.logo
    const location = r?.person?.location?.name || r?.person?.location || r?.location || '—'
    const positionStart = r?.start_date || r?.role?.position_start_date || r?.position_start_date || r?.role_position_start_date
    const positionEnd = r?.end_date || r?.role?.position_end_date || r?.position_end_date || r?.role_position_end_date
    const avatarUrl = r?.person?.photo || r?.person?.avatar_url || r?.person?.photo_url || r?.avatar_url
    return { id, name, roleTitle, company, companyLogoUrl, location, positionStart, positionEnd, avatarUrl }
  }

  // Group results by person and company (same person.id and organization.id)
  const groupedResults = useMemo(() => {
    const map = new Map<string, any>()
    for (const r of searchResults || []) {
      const personId = String(r?.person?.id || r?.person_id || r?.id || '')
      const companyId = String(r?.organization?.id || r?.company?.id || r?.organization_id || '')
      const personName = r?.person?.full_name || r?.person?.name || r?.person_name || r?.name || 'Unknown'
      const avatarUrl = r?.person?.photo || r?.person?.avatar_url || r?.person?.photo_url || r?.avatar_url
      const companyName = r?.organization?.name || r?.company?.name || r?.organization_name || '—'
      const companyLogoUrl = r?.organization?.logo || r?.company?.logo
      const location = r?.person?.location?.name || r?.person?.location || r?.location || '—'
      const start = r?.start_date || r?.role?.position_start_date || r?.position_start_date || r?.role_position_start_date
      const end = r?.end_date || r?.role?.position_end_date || r?.position_end_date || r?.role_position_end_date
      const personLinkedInIdentifier = r?.person?.linkedin_info?.public_identifier
      const personLinkedIn = r?.person?.linkedin_info?.public_profile_url || (personLinkedInIdentifier ? `https://www.linkedin.com/in/${personLinkedInIdentifier}/` : undefined)
      const companyLinkedInIdentifier = r?.organization?.linkedin_info?.public_identifier
      const companyLinkedIn = r?.organization?.linkedin_info?.public_profile_url || (companyLinkedInIdentifier ? `https://www.linkedin.com/company/${companyLinkedInIdentifier}/` : undefined)
      const companyWebsite = r?.organization?.website
      const companyDomain = r?.organization?.domain
      const isCurrent = Boolean(r?.is_current)
      const roleTitle = r?.role_title || r?.role?.title || '—'
      const key = `${personId || personName}::${companyId || companyName}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          personId,
          personName,
          avatarUrl,
          companyId,
          companyName,
          companyLogoUrl,
          location,
          personLinkedIn,
          companyLinkedIn,
          companyWebsite,
          companyDomain,
          roles: [] as Array<{ id: string; title: string; start?: string; end?: string; isCurrent?: boolean }>
        })
      }
      const group = map.get(key)!
      group.roles.push({ id: String(r?.id ?? `${personId}-${companyId}-${group.roles.length}`), title: roleTitle, start, end, isCurrent })
    }

    // Choose primary role (prefer current, else latest start)
    return Array.from(map.values()).map((g) => {
      const roles = [...g.roles]
      roles.sort((a, b) => {
        if (a.isCurrent && !b.isCurrent) return -1
        if (!a.isCurrent && b.isCurrent) return 1
        const da = a.start ? Date.parse(a.start) : 0
        const db = b.start ? Date.parse(b.start) : 0
        return db - da
      })
      return { ...g, roles }
    })
  }, [searchResults])

  // Function to check if leads exist for people in search results
  const checkLeadsForPeople = useCallback(async (groups: typeof groupedResults, siteId: string): Promise<Set<string>> => {
    if (!siteId || groups.length === 0) {
      return new Set()
    }

    try {
      const supabase = createClient()
      
      // Query all leads for the site (only name and company fields for efficiency)
      const { data: leads, error } = await supabase
        .from('leads')
        .select('name, company, companies(name)')
        .eq('site_id', siteId)

      if (error) {
        console.error('Error fetching leads for matching:', error)
        return new Set()
      }

      if (!leads || leads.length === 0) {
        return new Set()
      }

      // Create a Set of matched person IDs
      const matchedPersonIds = new Set<string>()

      // Helper function to normalize strings for comparison
      const normalize = (str: string | null | undefined): string => {
        if (!str) return ''
        // Remove extra spaces, convert to lowercase, and trim
        return str
          .trim()
          .toLowerCase()
          .replace(/\s+/g, ' ') // Replace multiple spaces with single space
          .trim()
      }

      // Helper function to get company name from lead
      const getLeadCompanyName = (lead: any): string | null => {
        // Check companies relation first
        if (lead.companies?.name) {
          return lead.companies.name
        }
        // Check company JSONB field
        if (lead.company) {
          if (typeof lead.company === 'string') {
            return lead.company
          }
          if (typeof lead.company === 'object' && lead.company.name) {
            return lead.company.name
          }
        }
        return null
      }

      // For each person in results, check if a matching lead exists
      for (const group of groups) {
        const personName = normalize(group.personName)
        const companyName = group.companyName && group.companyName !== '—' 
          ? normalize(group.companyName) 
          : null

        let foundMatch = false

        // Check each lead for a match
        for (const lead of leads) {
          const leadName = normalize(lead.name)
          
          // Match by name (required)
          if (leadName === personName) {
            const leadCompanyName = normalize(getLeadCompanyName(lead))
            
            // If person has company declared, validate company match
            if (companyName) {
              // If lead also has company, they must match
              if (leadCompanyName) {
                if (leadCompanyName === companyName) {
                  matchedPersonIds.add(group.personId)
                  foundMatch = true
                  console.log('✅ Match found (name + company):', {
                    personName: group.personName,
                    personCompany: group.companyName,
                    leadName: lead.name,
                    leadCompany: getLeadCompanyName(lead)
                  })
                  break
                } else {
                  // Companies don't match - log for debugging
                  console.log('❌ Name matches but companies differ:', {
                    personName: group.personName,
                    personCompany: group.companyName,
                    leadName: lead.name,
                    leadCompany: getLeadCompanyName(lead),
                    normalizedPersonCompany: companyName,
                    normalizedLeadCompany: leadCompanyName
                  })
                }
              } else {
                // Person has company but lead doesn't - still match by name only
                // (company might not have been set when lead was created)
                matchedPersonIds.add(group.personId)
                foundMatch = true
                console.log('✅ Match found (name only, person has company but lead doesn\'t):', {
                  personName: group.personName,
                  personCompany: group.companyName,
                  leadName: lead.name
                })
                break
              }
            } else {
              // No company declared in person, name match is sufficient
              matchedPersonIds.add(group.personId)
              foundMatch = true
              console.log('✅ Match found (name only):', {
                personName: group.personName,
                leadName: lead.name
              })
              break
            }
          }
        }

        if (!foundMatch && personName) {
          // Log potential matches for debugging
          const potentialMatches = leads.filter((lead: any) => {
            const leadName = normalize(lead.name)
            return leadName.includes(personName) || personName.includes(leadName)
          })
          if (potentialMatches.length > 0) {
            console.log('⚠️ No exact match but found similar names:', {
              personName: group.personName,
              personCompany: group.companyName,
              similarLeads: potentialMatches.map((l: any) => ({ name: l.name, company: getLeadCompanyName(l) }))
            })
          }
        }
      }

      // Debug logging
      console.log('🔍 Lead matching check:', {
        totalPeople: groups.length,
        totalLeads: leads.length,
        matchedCount: matchedPersonIds.size,
        siteId: siteId
      })

      return matchedPersonIds
    } catch (error) {
      console.error('Error in checkLeadsForPeople:', error)
      return new Set()
    }
  }, [])

  // Background check to see if people already have leads in the site
  useEffect(() => {
    const runCheck = async () => {
      if (!currentSite?.id || groupedResults.length === 0) {
        setAddedPersonIds(new Set())
        return
      }

      console.log('🔍 Starting lead check for people:', {
        siteId: currentSite.id,
        peopleCount: groupedResults.length
      })

      try {
        const matchedIds = await checkLeadsForPeople(groupedResults, currentSite.id)
        console.log('🔍 Lead check completed, matched IDs:', Array.from(matchedIds))
        setAddedPersonIds(matchedIds)
      } catch (error) {
        console.error('Error checking leads for people:', error)
        setAddedPersonIds(new Set())
      }
    }

    runCheck()
  }, [groupedResults, currentSite?.id, checkLeadsForPeople])

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const togglePersonSelection = (personId: string) => {
    setSelectedPersonIds(prev => {
      if (prev.includes(personId)) {
        return prev.filter(id => id !== personId)
      } else {
        return [...prev, personId]
      }
    })
  }

  const handleEnrich = async () => {
    if (!currentSite?.id) {
      toast.error('Site ID is required')
      return
    }

    if (selectedPersonIds.length === 0) {
      toast.error('No people selected')
      return
    }

    setIsEnriching(true)
    setIsConfirmModalOpen(false)

    try {
      let successCount = 0
      let errorCount = 0

      for (const personId of selectedPersonIds) {
        try {
          const response = await apiClient.post('/api/workflow/enrichLead', {
            site_id: currentSite.id,
            person_id: personId
          })

          if (response.success) {
            successCount++
          } else {
            errorCount++
            console.error(`Failed to enrich person ${personId}:`, response.error)
          }
        } catch (error) {
          errorCount++
          console.error(`Error enriching person ${personId}:`, error)
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully enriched ${successCount} ${successCount === 1 ? 'person' : 'people'}`)
        setSelectedPersonIds([])
      }

      if (errorCount > 0) {
        toast.error(`Failed to enrich ${errorCount} ${errorCount === 1 ? 'person' : 'people'}`)
      }
    } catch (error) {
      console.error('Error in enrich process:', error)
      toast.error('An error occurred while enriching leads')
    } finally {
      setIsEnriching(false)
    }
  }

  const sidebar = (
    <div className={cn(
      "fixed transition-all duration-200 ease-in-out z-10",
      isSidebarCollapsed ? "w-0 opacity-0" : "w-[319px] opacity-100"
    )} style={{ left: sidebarLeft, top: "64px", height: "calc(100vh - 64px)" }}>
      <div className="h-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-r relative">
        {/* Content */}
          <div className="h-full overflow-hidden">
          <div className="h-full overflow-auto p-4 space-y-4 pb-[110px]">
            <div className="space-y-3">
              <h3 className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2" style={{ fontSize: '10.8px' }}>📋 Saved Lists</h3>
              {(() => {
                if (icpListLoading) {
                  return (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, idx) => (
                        <CollapsibleField key={idx} title="Loading..." defaultOpen={false}>
                          <div className="space-y-1.5">
                            <Card className="border border-border">
                              <CardContent className="p-2.5">
                                <div className="flex items-center justify-between gap-3">
                                  <Skeleton className="h-4 w-32" />
                                  <Skeleton className="h-7 w-7 rounded-md flex-shrink-0" />
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </CollapsibleField>
                      ))}
                    </div>
                  )
                }

                if (availableIcps.length === 0) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No saved lists found</p>
                    </div>
                  )
                }

                // Group ICPs by status
                const groupedByStatus = availableIcps.reduce((acc, icp) => {
                  let status = icp.status || 'unknown'
                  // Merge mining and running into "in_progress"
                  if (status === 'mining' || status === 'running') {
                    status = 'in_progress'
                  }
                  if (!acc[status]) {
                    acc[status] = []
                  }
                  acc[status].push(icp)
                  return acc
                }, {} as Record<string, typeof availableIcps>)

                // Status order and labels
                const statusOrder = ['in_progress', 'pending', 'completed', 'failed', 'unknown']
                const statusLabels: Record<string, string> = {
                  'in_progress': 'In Progress',
                  'pending': 'Pending',
                  'completed': 'Completed',
                  'failed': 'Failed',
                  'unknown': 'Other'
                }

                const renderIcpCard = (icp: typeof availableIcps[0]) => (
                  <Card 
                    key={icp.id} 
                    className="border border-border hover:border-foreground/20 transition-colors cursor-pointer"
                    onClick={() => handleLoadIcp(icp.id)}
                  >
                    <CardContent className="p-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-medium truncate text-sm flex-1 min-w-0">
                          {(icp.name && icp.name.trim()) ? icp.name : `List ${icp.id.slice(0,8)}…`}
                        </h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleLoadIcp(icp.id)
                              }}
                            >
                              Load
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.stopPropagation()
                                setEditingIcp({ id: icp.id, name: icp.name, role_query_id: icp.role_query_id })
                                setEditingIcpName(icp.name || "")
                                
                                // Load segments if not already loaded
                                if (availableSegments.length === 0 && currentSite?.id) {
                                  try {
                                    const res = await getSegments(currentSite.id)
                                    if (res?.segments) {
                                      setAvailableSegments(res.segments.map((s: any) => ({ id: s.id, name: s.name })))
                                    }
                                  } catch (err) {
                                    console.error('[People] Load segments error:', err)
                                  }
                                }
                                
                                // Load current segment for this ICP
                                try {
                                  setEditingIcpSegmentsLoading(true)
                                  const supabase = createClient()
                                  const { data: segs, error: segErr } = await supabase
                                    .from('role_query_segments')
                                    .select('segment_id')
                                    .eq('role_query_id', icp.role_query_id)
                                    .limit(1)
                                  
                                  if (segErr) throw segErr
                                  
                                  if (segs && segs.length > 0) {
                                    setEditingIcpSegmentId(segs[0].segment_id)
                                  } else {
                                    setEditingIcpSegmentId('none')
                                  }
                                } catch (err) {
                                  console.error('[People] Load segment error:', err)
                                  setEditingIcpSegmentId('none')
                                } finally {
                                  setEditingIcpSegmentsLoading(false)
                                }
                                
                                setIsEditIcpModalOpen(true)
                              }}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteIcp(icp.id)
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                )

                return (
                  <div className="space-y-3">
                    {statusOrder.map((status) => {
                      const icps = groupedByStatus[status] || []
                      if (icps.length === 0) return null

                      return (
                        <CollapsibleField 
                          key={status}
                          title={statusLabels[status]}
                          defaultOpen={false}
                          countBadge={icps.length}
                        >
                          <div className="space-y-1.5">
                            {icps.map(renderIcpCard)}
                          </div>
                        </CollapsibleField>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
            <div className="space-y-3">
              <h3 className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2" style={{ fontSize: '10.8px' }}>👤 Person Criteria</h3>
              <div className="space-y-3">
                <CollapsibleField title="Name" defaultOpen={sectionOpenDefaults.name} onClear={() => { setPersonName(""); setPersonHeadline(""); setPersonLinkedinIds([]); setPersonLinkedinIdsInputText("") }}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Use “quotation marks" for exact matches.</p>
                      <Input className="h-10" placeholder="Search" value={personName} onChange={(e)=> setPersonName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Headline</p>
                      <Input className="h-10" placeholder="Search" value={personHeadline} onChange={(e)=> setPersonHeadline(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">LinkedIn Identifiers</p>
                      <ChipsInput 
                        values={personLinkedinIds}
                        onChange={setPersonLinkedinIds}
                        onTextChange={setPersonLinkedinIdsInputText}
                        placeholder="linkedin.com/in/slug"
                      />
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Job Title" defaultOpen={sectionOpenDefaults.jobTitle} onClear={() => { setJobTitle(""); setQuery(""); setIsCurrentRole(true); setRoleDateSince(undefined); setRoleDateUntil(undefined) }}>
                  <p className="text-xs text-muted-foreground mb-2">Use "quotation marks" for exact matches</p>
                  <Input className="h-10" placeholder="Search" value={jobTitle} onChange={(e)=> setJobTitle(e.target.value)} />
                  {/* Job description (boolean search) */}
                  <div className="mt-4 flex flex-col items-start space-y-2">
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <Input placeholder="Keywords" className="h-10" value={query} onChange={(e)=> setQuery(e.target.value)} />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="text-left text-xs text-muted-foreground">Role date since</label>
                        {!roleDateSince && (
                          <Badge variant="outline" className="text-xs">Not set</Badge>
                        )}
                        {roleDateSince && (
                          <button
                            type="button"
                            onClick={() => setRoleDateSince(undefined)}
                            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear date"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <DatePicker
                        date={roleDateSince || new Date()}
                        setDate={(date) => setRoleDateSince(date)}
                        className="w-full"
                        mode="default"
                        placeholder="Select start date"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <label className="text-left text-xs text-muted-foreground">Role date until</label>
                        {!roleDateUntil && (
                          <Badge variant="outline" className="text-xs">Not set</Badge>
                        )}
                        {roleDateUntil && (
                          <button
                            type="button"
                            onClick={() => setRoleDateUntil(undefined)}
                            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear date"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <DatePicker
                        date={roleDateUntil || new Date()}
                        setDate={(date) => setRoleDateUntil(date)}
                        className="w-full"
                        mode="default"
                        placeholder="Select end date"
                      />
                    </div>
                    <p className="text-left text-xs text-muted-foreground">Pick the period for the role.</p>
                  </div>
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="current-role" className="text-left text-sm text-foreground">Role is current</label>
                    <Switch id="current-role" checked={isCurrentRole} onCheckedChange={setIsCurrentRole} />
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Industry" defaultOpen={sectionOpenDefaults.personIndustry} countBadge={industries.length + personIndustriesExclude.length} onClear={() => { setIndustries([]); setPersonIndustriesExclude([]) }}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Include</p>
                      <LookupChipsInput 
                        values={industries}
                        onChange={setIndustries}
                        placeholder="Search industries"
                        fetcher={(q) => lookupFetcher('industries', q)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Exclude</p>
                      <LookupChipsInput 
                        values={personIndustriesExclude}
                        onChange={setPersonIndustriesExclude}
                        placeholder="Search industries to exclude"
                        fetcher={(q) => lookupFetcher('industries', q)}
                      />
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Location" defaultOpen={sectionOpenDefaults.personLocation} countBadge={locations.length} onClear={() => setLocations([])}>
                  <LookupChipsInput 
                    values={locations}
                    onChange={setLocations}
                    placeholder="Search locations"
                    fetcher={(q) => lookupFetcher('locations', q)}
                  />
                </CollapsibleField>
                <CollapsibleField title="Skills" countBadge={skills.length} onClear={() => setSkills([])} defaultOpen={sectionOpenDefaults.skills}>
                  <LookupChipsInput 
                    values={skills} 
                    onChange={setSkills} 
                    placeholder="Search skills"
                    fetcher={(q) => lookupFetcher('skills', q)}
                  />
                </CollapsibleField>
                <CollapsibleField title="LinkedIn Identifiers" defaultOpen={sectionOpenDefaults.personLinkedin} countBadge={personLinkedinIds.length} onClear={() => { setPersonLinkedinIds([]); setPersonLinkedinIdsInputText("") }}>
                  <ChipsInput 
                    values={personLinkedinIds}
                    onChange={setPersonLinkedinIds}
                    onTextChange={setPersonLinkedinIdsInputText}
                    placeholder="linkedin.com/in/slug"
                  />
                </CollapsibleField>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2" style={{ fontSize: '10.8px' }}>🏢 Company Criteria</h3>
              <div className="space-y-3">
                <CollapsibleField title="Company" countBadge={companies.length} onClear={() => { setCompanies([]); setOrgLinkedinIds([]); setOrgDescription("") }} defaultOpen={sectionOpenDefaults.company}>
                  <div className="space-y-3">
                    <LookupChipsInput 
                      values={companies}
                      onChange={setCompanies}
                      placeholder="Search companies"
                      fetcher={(q) => lookupFetcher('organizations', q)}
                    />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <Input className="h-10" placeholder="Boolean text query" value={orgDescription} onChange={(e)=> setOrgDescription(e.target.value)} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">LinkedIn Identifiers</p>
                      <ChipsInput 
                        values={orgLinkedinIds}
                        onChange={setOrgLinkedinIds}
                        onTextChange={setOrgLinkedinIdsInputText}
                        placeholder="linkedin.com/company/slug"
                      />
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Domains" defaultOpen={sectionOpenDefaults.domains} countBadge={orgDomains.length + (orgBulkDomain ? 1 : 0)} onClear={() => { setOrgDomains([]); setOrgBulkDomain("") }}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Domains</p>
                      <ChipsInput 
                        values={orgDomains}
                        onChange={setOrgDomains}
                        onTextChange={setOrgDomainsInputText}
                        placeholder="example.com"
                      />
                      <p className="text-xs text-muted-foreground mt-1">You can also type domains in Company chips above.</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Bulk Domain</p>
                      <Input 
                        className="h-10" 
                        placeholder="example.com" 
                        value={orgBulkDomain} 
                        onChange={(e) => {
                          const newValue = e.target.value
                          console.log('[People] Bulk Domain input changed:', newValue)
                          setOrgBulkDomain(newValue)
                        }} 
                      />
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Location & Industry" defaultOpen={sectionOpenDefaults.compLocInd} countBadge={orgLocations.length + orgIndustries.length + orgIndustriesExclude.length + keywords.length} onClear={() => { setOrgLocations([]); setOrgIndustries([]); setOrgIndustriesExclude([]); setKeywords([]) }}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Locations</p>
                      <LookupChipsInput 
                        values={orgLocations}
                        onChange={setOrgLocations}
                        placeholder="Search locations"
                        fetcher={(q) => lookupFetcher('locations', q)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Industries (Include)</p>
                      <LookupChipsInput 
                        values={orgIndustries}
                        onChange={setOrgIndustries}
                        placeholder="Search industries"
                        fetcher={(q) => lookupFetcher('industries', q)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Industries (Exclude)</p>
                      <LookupChipsInput 
                        values={orgIndustriesExclude}
                        onChange={setOrgIndustriesExclude}
                        placeholder="Search industries to exclude"
                        fetcher={(q) => lookupFetcher('industries', q)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Keywords</p>
                      <LookupChipsInput 
                        values={keywords} 
                        onChange={setKeywords} 
                        placeholder="Keywords"
                        fetcher={(q) => lookupFetcher('org_keywords', q)}
                      />
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Company Size & Founded" defaultOpen={sectionOpenDefaults.sizeFounded}>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-1">Employees</p>
                      <div className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-5">
                      <p className="text-xs text-muted-foreground mb-1">From</p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={employeeFrom === "" ? "" : employeeFrom}
                        onChange={(e) => {
                          const v = e.target.value
                          setEmployeeFrom(v === "" ? "" : Number(v))
                        }}
                        className="h-10"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-center pb-2">-</div>
                    <div className="col-span-5">
                      <p className="text-xs text-muted-foreground mb-1">To</p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={employeeTo === "" ? "" : employeeTo}
                        onChange={(e) => {
                          const v = e.target.value
                          setEmployeeTo(v === "" ? "" : Number(v))
                        }}
                        className="h-10"
                        placeholder="0"
                      />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-1">Revenue (USD)</p>
                    <div className="grid grid-cols-12 items-end gap-2">
                      <div className="col-span-5">
                        <p className="text-xs text-muted-foreground mb-1">From</p>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1000}
                          value={revenueFrom === "" ? "" : revenueFrom}
                          onChange={(e) => {
                            const v = e.target.value
                            setRevenueFrom(v === "" ? "" : Number(v))
                          }}
                          className="h-10"
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-center pb-2">-</div>
                      <div className="col-span-5">
                        <p className="text-xs text-muted-foreground mb-1">To</p>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1000}
                          value={revenueTo === "" ? "" : revenueTo}
                          onChange={(e) => {
                            const v = e.target.value
                            setRevenueTo(v === "" ? "" : Number(v))
                          }}
                          className="h-10"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-left text-xs text-muted-foreground">Founded Date Range</label>
                      {(!orgFoundedRange.start || !orgFoundedRange.end) && (
                        <Badge variant="outline" className="text-xs">Not set</Badge>
                      )}
                      {(orgFoundedRange.start || orgFoundedRange.end) && (
                        <button
                          type="button"
                          onClick={() => setOrgFoundedRange({})}
                          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Clear date range"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <CalendarDateRangePicker 
                      initialStartDate={orgFoundedRange.start}
                      initialEndDate={orgFoundedRange.end}
                      onRangeChange={(start, end) => setOrgFoundedRange({ start, end })}
                      className="w-full [&_.btn]:h-10 [&_.btn]:items-start"
                    />
                    <p className="text-left text-xs text-muted-foreground">Pick the period for the company founding.</p>
                  </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Web & Tech" defaultOpen={false}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Technologies</p>
                      <LookupChipsInput 
                        values={technologies}
                        onChange={setTechnologies}
                        placeholder="Search technologies"
                        fetcher={(q) => lookupFetcher('web_technologies', q)}
                      />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-1">Domain Rank</p>
                      <div className="grid grid-cols-12 items-end gap-2">
                    <div className="col-span-5">
                      <p className="text-xs text-muted-foreground mb-1">From</p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={domainRankFrom === "" ? "" : domainRankFrom}
                        onChange={(e) => {
                          const v = e.target.value
                          setDomainRankFrom(v === "" ? "" : Number(v))
                        }}
                        className="h-10"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-2 flex items-center justify-center pb-2">-</div>
                    <div className="col-span-5">
                      <p className="text-xs text-muted-foreground mb-1">To</p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={domainRankTo === "" ? "" : domainRankTo}
                        onChange={(e) => {
                          const v = e.target.value
                          setDomainRankTo(v === "" ? "" : Number(v))
                        }}
                        className="h-10"
                        placeholder="0"
                      />
                    </div>
                      </div>
                    </div>
                  </div>
                </CollapsibleField>
                
                <CollapsibleField title="Founded Date" defaultOpen={sectionOpenDefaults.foundedDate}>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-left text-xs text-muted-foreground">Founded Date Range</label>
                      {(!orgFoundedRange.start || !orgFoundedRange.end) && (
                        <Badge variant="outline" className="text-xs">Not set</Badge>
                      )}
                      {(orgFoundedRange.start || orgFoundedRange.end) && (
                        <button
                          type="button"
                          onClick={() => setOrgFoundedRange({})}
                          className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Clear date range"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <CalendarDateRangePicker 
                      initialStartDate={orgFoundedRange.start}
                      initialEndDate={orgFoundedRange.end}
                      onRangeChange={(start, end) => setOrgFoundedRange({ start, end })}
                      className="w-full [&_.btn]:h-10 [&_.btn]:items-start"
                    />
                    <p className="text-left text-xs text-muted-foreground">Pick the period for the company founding.</p>
                  </div>
                </CollapsibleField>
                <CollapsibleField title="LinkedIn Identifiers" defaultOpen={sectionOpenDefaults.companyLinkedin} countBadge={orgLinkedinIds.length} onClear={() => setOrgLinkedinIds([])}>
                  <ChipsInput 
                    values={orgLinkedinIds}
                    onChange={setOrgLinkedinIds}
                    placeholder="linkedin.com/company/slug"
                  />
                </CollapsibleField>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2" style={{ fontSize: '10.8px' }}>🎯 Buying Intent</h3>
              <div className="space-y-3">
                <CollapsibleField title="Job Postings" defaultOpen={sectionOpenDefaults.jobPostings}>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Title</p>
                      <p className="text-xs text-muted-foreground mb-2">Use "quotation marks" for exact matches</p>
                      <Input className="h-10" placeholder="Search" value={jobPostingTitle} onChange={(e)=> setJobPostingTitle(e.target.value)} />
                    </div>
                    <div className="flex flex-col items-start space-y-2">
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <Input placeholder="Description" className="h-10" value={jobPostingDescription} onChange={(e)=> setJobPostingDescription(e.target.value)} />
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs text-muted-foreground">Job featured date since</p>
                          {!jobFeaturedDateFrom && (
                            <Badge variant="outline" className="text-xs">Not set</Badge>
                          )}
                          {jobFeaturedDateFrom && (
                            <button
                              type="button"
                              onClick={() => setJobFeaturedDateFrom(undefined)}
                              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Clear date"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <DatePicker
                          date={jobFeaturedDateFrom || new Date()}
                          setDate={(date) => setJobFeaturedDateFrom(date)}
                          className="w-full"
                          mode="default"
                          placeholder="Select start date"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs text-muted-foreground">Job featured date until</p>
                          {!jobFeaturedDateTo && (
                            <Badge variant="outline" className="text-xs">Not set</Badge>
                          )}
                          {jobFeaturedDateTo && (
                            <button
                              type="button"
                              onClick={() => setJobFeaturedDateTo(undefined)}
                              className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Clear date"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <DatePicker
                          date={jobFeaturedDateTo || new Date()}
                          setDate={(date) => setJobFeaturedDateTo(date)}
                          className="w-full"
                          mode="default"
                          placeholder="Select end date"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="py-1.5 flex items-center justify-between gap-2">
                        <label htmlFor="include-remote" className="text-sm">Include Remote</label>
                        <Switch id="include-remote" checked={includeRemote} onCheckedChange={setIncludeRemote} />
                      </div>
                      <div className="py-1.5 flex items-center justify-between gap-2">
                        <label htmlFor="job-active" className="text-sm">Active</label>
                        <Switch id="job-active" checked={isJobActive} onCheckedChange={setIsJobActive} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Locations</p>
                      <LookupChipsInput 
                        values={jobLocations} 
                        onChange={setJobLocations} 
                        placeholder="Search"
                        fetcher={(q) => lookupFetcher('locations', q)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Locations Exclude</p>
                      <LookupChipsInput 
                        values={jobLocationsExclude} 
                        onChange={setJobLocationsExclude} 
                        placeholder="Search"
                        fetcher={(q) => lookupFetcher('locations', q)}
                      />
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField 
                  title="Funding" 
                  defaultOpen={sectionOpenDefaults.funding}
                  countBadge={
                    (fundingDateRange.start || fundingDateRange.end ? 1 : 0) +
                    (fundingRangeTouched ? 1 : 0) +
                    (fundingType ? 1 : 0)
                  }
                  onClear={() => {
                    setFundingDateRange({})
                    setFundingType("")
                    setFundingRange([50000, 50000])
                    setFundingRangeTouched(false)
                  }}
                >
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-muted-foreground">Funding Date</p>
                        {(!fundingDateRange.start || !fundingDateRange.end) && (
                          <Badge variant="outline" className="text-xs">Not set</Badge>
                        )}
                        {(fundingDateRange.start || fundingDateRange.end) && (
                          <button
                            type="button"
                            onClick={() => setFundingDateRange({})}
                            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear date range"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <CalendarDateRangePicker 
                        initialStartDate={fundingDateRange.start}
                        initialEndDate={fundingDateRange.end}
                        onRangeChange={(start, end)=> setFundingDateRange({ start, end })} 
                        className="w-full" 
                      />
                    </div>
                    <div>
                      {(() => {
                        // Logarithmic scale conversion functions
                        // Range: 50,000 to 100,000,000 (50K to 100M)
                        const MIN_FUNDING = 50000
                        const MAX_FUNDING = 100000000
                        const SLIDER_MAX = 100
                        
                        // Convert real value to slider position (0-100)
                        const realToSlider = (value: number): number => {
                          if (value <= MIN_FUNDING) return 0
                          if (value >= MAX_FUNDING) return SLIDER_MAX
                          const logMin = Math.log10(MIN_FUNDING)
                          const logMax = Math.log10(MAX_FUNDING)
                          const logValue = Math.log10(value)
                          return ((logValue - logMin) / (logMax - logMin)) * SLIDER_MAX
                        }
                        
                        // Convert slider position (0-100) to real value
                        const sliderToReal = (sliderValue: number): number => {
                          if (sliderValue <= 0) return MIN_FUNDING
                          if (sliderValue >= SLIDER_MAX) return MAX_FUNDING
                          const logMin = Math.log10(MIN_FUNDING)
                          const logMax = Math.log10(MAX_FUNDING)
                          const logValue = logMin + (sliderValue / SLIDER_MAX) * (logMax - logMin)
                          return Math.round(Math.pow(10, logValue))
                        }
                        
                        // Current slider positions
                        const sliderValues: [number, number] = [
                          realToSlider(fundingRange[0]),
                          realToSlider(fundingRange[1])
                        ]
                        
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-muted-foreground font-medium">Funding Amount</p>
                              <div className="flex items-center gap-2">
                                <p className="text-sm">{fundingRange[0].toLocaleString()} - {fundingRange[1].toLocaleString()}</p>
                                {fundingRangeTouched && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFundingRange([50000, 50000])
                                      setFundingRangeTouched(false)
                                    }}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label="Clear funding amount"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="pt-2">
                              <Slider 
                                value={sliderValues}
                                onValueChange={(v: number[]) => { 
                                  const realValues: [number, number] = [
                                    sliderToReal(v[0]),
                                    sliderToReal(v[1])
                                  ]
                                  setFundingRange(realValues)
                                  setFundingRangeTouched(true) 
                                }}
                                min={0}
                                max={SLIDER_MAX}
                                step={0.5}
                                className="style-slider-thumb"
                              />
                            </div>
                          </>
                        )
                      })()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-muted-foreground">Funding Type</p>
                        {fundingType && (
                          <button
                            type="button"
                            onClick={() => setFundingType("")}
                            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear funding type"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <Select value={fundingType} onValueChange={setFundingType}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="angel">Angel</SelectItem>
                          <SelectItem value="convertible_note">Convertible note</SelectItem>
                          <SelectItem value="corporate_round">Corporate round</SelectItem>
                          <SelectItem value="debt_financing">Debt financing</SelectItem>
                          <SelectItem value="equity_crowdfunding">Equity crowdfunding</SelectItem>
                          <SelectItem value="grant">Grant</SelectItem>
                          <SelectItem value="initial_coin_offering">Initial coin offering</SelectItem>
                          <SelectItem value="non_equity_assistance">Non equity assistance</SelectItem>
                          <SelectItem value="post_ipo_debt">Post IPO debt</SelectItem>
                          <SelectItem value="post_ipo_equity">Post IPO equity</SelectItem>
                          <SelectItem value="post_ipo_secondary">Post IPO secondary</SelectItem>
                          <SelectItem value="pre_seed">Pre seed</SelectItem>
                          <SelectItem value="private_equity">Private equity</SelectItem>
                          <SelectItem value="product_crowdfunding">Product crowdfunding</SelectItem>
                          <SelectItem value="secondary_market">Secondary market</SelectItem>
                          <SelectItem value="seed">Seed</SelectItem>
                          <SelectItem value="series_a">Series A</SelectItem>
                          <SelectItem value="series_b">Series B</SelectItem>
                          <SelectItem value="series_c">Series C</SelectItem>
                          <SelectItem value="series_d">Series D</SelectItem>
                          <SelectItem value="series_e">Series E</SelectItem>
                          <SelectItem value="series_f">Series F</SelectItem>
                          <SelectItem value="series_g">Series G</SelectItem>
                          <SelectItem value="series_h">Series H</SelectItem>
                          <SelectItem value="series_i">Series I</SelectItem>
                          <SelectItem value="series_j">Series J</SelectItem>
                          <SelectItem value="series_unknown">Series unknown</SelectItem>
                          <SelectItem value="undisclosed">Undisclosed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Technologies" countBadge={technologies.length} defaultOpen={sectionOpenDefaults.technologies}>
                  <LookupChipsInput 
                    values={technologies}
                    onChange={setTechnologies}
                    placeholder="Search technologies"
                    fetcher={(q) => lookupFetcher('web_technologies', q)}
                  />
                </CollapsibleField>
                <CollapsibleField title="Signals" defaultOpen={sectionOpenDefaults.signals}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Simple Event Source</p>
                      <Select value={simpleEventSource ?? ""} onValueChange={(v) => setSimpleEventSource(v as FinderSimpleEventSource)}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Select source" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="product_hunt">Product Hunt</SelectItem>
                          <SelectItem value="form_c_sec_gov">Form C (sec.gov)</SelectItem>
                          <SelectItem value="form_d_sec_gov">Form D (sec.gov)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Simple Event Reason</p>
                      <Select value={simpleEventReason ?? ""} onValueChange={(v) => setSimpleEventReason(v as FinderSimpleEventReason)}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Select reason" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="report_released">Report released</SelectItem>
                          <SelectItem value="promoted_on_site">Promoted on site</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-muted-foreground">Simple Event Featured Date</p>
                        {(!simpleEventDateRange.start || !simpleEventDateRange.end) && (
                          <Badge variant="outline" className="text-xs">Not set</Badge>
                        )}
                        {(simpleEventDateRange.start || simpleEventDateRange.end) && (
                          <button
                            type="button"
                            onClick={() => setSimpleEventDateRange({})}
                            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear date range"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <CalendarDateRangePicker 
                        initialStartDate={simpleEventDateRange.start}
                        initialEndDate={simpleEventDateRange.end}
                        onRangeChange={(start, end)=> setSimpleEventDateRange({ start, end })}
                        className="w-full"
                      />
                    </div>
                  </div>
                </CollapsibleField>
              </div>
            </div>
            {/* bottom action bar handles actions */}
          </div>
          {/* Bottom action bar - always visible within sidebar */}
          <div 
            className={cn(
              "absolute bottom-0 left-0 w-full border-t bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80 h-[87px]",
              isSidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-auto"
            )}
            style={{ paddingLeft: '16px', paddingRight: '16px' }}
          >
            <div className="h-full w-full flex items-center gap-2">
              <Button 
                variant="outline" 
                className="w-1/2 h-10"
                onClick={()=>{ setQuery(""); setIndustries([]); setPersonIndustriesExclude([]); setLocations([]); setEmployeeFrom(""); setEmployeeTo(""); setRevenueFrom(""); setRevenueTo(""); setPersonName(""); setPersonHeadline(""); setJobTitle(""); setSkills([]); setCompanies([]); setKeywords([]); setTechnologies([]); setJobPostingTitle(""); setJobPostingDescription(""); setJobFeaturedDateFrom(undefined); setJobFeaturedDateTo(undefined); setIncludeRemote(false); setIsJobActive(false); setJobLocations([]); setJobLocationsExclude([]); setFundingDateRange({}); setFundingType(""); setFundingRangeTouched(false); setPersonLinkedinIds([]); setPersonLinkedinIdsInputText(""); setOrgDomains([]); setOrgDomainsInputText(""); setOrgBulkDomain(""); setOrgDescription(""); setOrgLocations([]); setOrgIndustries([]); setOrgIndustriesExclude([]); setOrgLinkedinIds([]); setOrgLinkedinIdsInputText(""); setOrgFoundedRange({}); setSimpleEventSource(null); setSimpleEventReason(null); setSimpleEventDateRange({}); setRoleDateSince(undefined); setRoleDateUntil(undefined); }}
              >
                Clear
              </Button>
            <Button className="w-1/2 h-10 gap-2" onClick={onClickSearch}>
                <Search className="h-4 w-4" />
              {loading ? 'Searching…' : 'Search'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const isEmptyView = !loading && totalResults === 0

  return (
    <div className="flex h-full relative">
      {sidebar}
      <div 
        className="flex flex-col h-full w-full transition-all duration-200 ease-in-out"
        style={{ 
          marginLeft: isSidebarCollapsed ? "0px" : "319px",
          maxWidth: contentMaxWidth
        }}
      >
        <StickyHeader className="sticky-left">
          <SidebarToggle
            isCollapsed={isSidebarCollapsed}
            onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="absolute left-0 top-1/2 -translate-y-1/2"
          />
          <div className="ml-[120px] mr-16 transition-all duration-300 ease-in-out">
            <div className="flex items-center justify-between">
              <div>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="secondary" 
                  className="h-9" 
                  disabled={selectedPersonIds.length === 0 || isEnriching}
                  onClick={() => setIsConfirmModalOpen(true)}
                >
                  {isEnriching ? 'Enriching...' : `Add and Enrich${selectedPersonIds.length > 0 ? ` (${selectedPersonIds.length})` : ''}`}
                </Button>
                <Button variant="secondary" className="h-9" onClick={handleAddToLeads} disabled={totalResults === 0 || loading || addingToLeads}>
                  {`Add ${(totalResults || 0).toLocaleString()} results to leads`}
                </Button>
              </div>
            </div>
          </div>
        </StickyHeader>
        <div className={cn("flex-1 bg-muted/30 transition-colors duration-300 ease-in-out", isEmptyView ? "overflow-visible" : "overflow-auto")} style={isEmptyView ? { height: 'calc(100vh - 64px - 71px)' } : undefined}>
          <div className={cn(isEmptyView ? "h-full" : "p-8 h-full space-y-4") }>
            {isEmptyView ? (
              <EmptyState 
                variant="fancy"
                icon={<Search />}
                title="Find the right people"
                description="Use the filters on the left and click Search to discover matching people."
                className="min-h-full"
              />
            ) : (
            <Card>
              

              <div>
                  {loading ? (
                    <>
                      <div className="divide-y">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={i} className="flex items-center px-6 py-3 gap-4">
                            <Skeleton className="h-8 w-8 rounded-full" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-64" />
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-24" />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between px-6 py-4 border-t">
                        <div className="flex items-center gap-4">
                          <Skeleton className="h-4 w-72" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-8 w-8 rounded-md" />
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-8 w-8 rounded-md" />
                          ))}
                          <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                <Table className="w-full table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[56px]"> </TableHead>
                      <TableHead style={{ width: `${tableColumnWidths.name}%` }}>Person Name</TableHead>
                      <TableHead style={{ width: `${tableColumnWidths.role}%` }}>Role Title</TableHead>
                      <TableHead style={{ width: `${tableColumnWidths.company}%` }}>Company</TableHead>
                      <TableHead style={{ width: `${tableColumnWidths.location}%` }}>Person Location</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: `${tableColumnWidths.start}%` }}>Start Date</TableHead>
                      <TableHead className="whitespace-nowrap" style={{ width: `${tableColumnWidths.end}%` }}>End Date</TableHead>
                      <TableHead className="w-[56px] text-right" style={{ width: `${tableColumnWidths.links}%` }}>
                        <span className="sr-only">Links</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                          {error && (
                            <TableRow>
                              <TableCell colSpan={6}>
                                <div className="py-8 text-center text-sm text-destructive">{error}</div>
                              </TableCell>
                            </TableRow>
                          )}
                          {!error && groupedResults.map(group => {
                            const isExpandable = group.roles.length > 1
                            const isExpanded = !!expandedGroups[group.key]
                            const primary = group.roles[0]
                            return (
                              <Fragment key={group.key}>
                                <TableRow 
                                  key={`${group.key}-row`}
                                  className={cn(
                                    "group hover:bg-muted/50 transition-colors cursor-pointer",
                                    selectedPersonIds.includes(group.personId) ? 'bg-primary/10 hover:bg-primary/15' : ''
                                  )}
                                  onClick={(e) => {
                                    // Don't toggle selection if clicking on expand button, dropdown, or links
                                    const target = e.target as HTMLElement
                                    if (target.closest('button') || target.closest('[role="menu"]') || target.closest('a')) {
                                      return
                                    }
                                    // Toggle selection on row click
                                    togglePersonSelection(group.personId)
                                  }}
                                >
                                  <TableCell className="w-[56px]">
                                    <div className="relative h-8 w-8">
                                      <Avatar className={cn(
                                        "h-8 w-8 border",
                                        addedPersonIds.has(group.personId) 
                                          ? "border-green-500/50 ring-2 ring-green-500/20" 
                                          : "border-primary/10"
                                      )}>
                                      {group.avatarUrl ? (
                                        <AvatarImage src={group.avatarUrl} alt={group.personName} />
                                      ) : null}
                                      <AvatarFallback className={cn(
                                        "text-[10px] leading-none font-medium text-center",
                                        addedPersonIds.has(group.personId)
                                          ? "bg-green-50 text-green-700"
                                          : "bg-muted text-foreground"
                                      )}>
                                        {group.personName.split(' ').map((s: string) => s[0]).slice(0,2).join('').toUpperCase()}
                                      </AvatarFallback>
                                      </Avatar>
                                      {selectedPersonIds.includes(group.personId) && (
                                        <div className="absolute inset-0 h-8 w-8 rounded-full bg-primary/90 hover:bg-primary flex items-center justify-center border-2 border-background transition-colors">
                                          <Check className="h-4 w-4 text-primary-foreground" />
                                        </div>
                                      )}
                                      {addedPersonIds.has(group.personId) && !selectedPersonIds.includes(group.personId) && (
                                        <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-green-500 border-2 border-background flex items-center justify-center">
                                          <Check className="h-2.5 w-2.5 text-white" />
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-0.5 flex items-center gap-2">
                                      {isExpandable && (
                                        <button
                                          type="button"
                                          className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-muted"
                                          onClick={(e) => { e.stopPropagation(); toggleGroup(group.key) }}
                                          aria-label={isExpanded ? 'Collapse roles' : 'Expand roles'}
                                        >
                                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </button>
                                      )}
                                      <p className="font-medium text-sm line-clamp-2" title={group.personName}>{group.personName}</p>
                                      {group.roles.length > 1 && (
                                        <Badge variant="secondary" className="ml-1">{group.roles.length}</Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">{primary.title}</TableCell>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {group.companyLogoUrl ? (
                                        <img
                                          src={group.companyLogoUrl}
                                          alt={`${group.companyName} logo`}
                                          className="h-5 w-5 rounded-sm border border-border/40 object-cover"
                                        />
                                      ) : null}
                                      <div className="line-clamp-2" title={group.companyName}>{group.companyName}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <div className="line-clamp-2" title={group.location}>{group.location}</div>
                                  </TableCell>
                                  <TableCell className="font-medium whitespace-nowrap">{primary.start ?? "N/A"}</TableCell>
                                  <TableCell className="font-medium whitespace-nowrap">{primary.end ?? (primary.start ? "Present" : "N/A")}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end" onClick={(e)=> e.stopPropagation()}>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                          >
                                            <span className="sr-only">Open links</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem asChild disabled={!group.personLinkedIn}>
                                            <a
                                              href={group.personLinkedIn || '#'}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-2"
                                            >
                                              <LinkedInIcon size={16} />
                                              <span>Person LinkedIn</span>
                                            </a>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem asChild disabled={!group.companyLinkedIn}>
                                            <a
                                              href={group.companyLinkedIn || '#'}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-2"
                                            >
                                              <LinkedInIcon size={16} />
                                              <span>Company LinkedIn</span>
                                            </a>
                                          </DropdownMenuItem>
                                          <DropdownMenuItem asChild disabled={!(group.companyWebsite || group.companyDomain)}>
                                            <a
                                              href={(group.companyWebsite || (group.companyDomain ? `https://${group.companyDomain}` : '#'))}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-2"
                                            >
                                              <Globe className="h-4 w-4" />
                                              <span>Company Website</span>
                                            </a>
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </TableCell>
                                </TableRow>

                                {isExpandable && isExpanded && group.roles.slice(1).map((role: any) => (
                                  <TableRow key={`${group.key}-${role.id}`} className="group hover:bg-muted/30 transition-colors border-l-4 border-l-blue-200 bg-muted/20">
                                    <TableCell className="w-[56px]"></TableCell>
                                    <TableCell>
                                      <div className="pl-8 text-sm text-muted-foreground">Additional role</div>
                                    </TableCell>
                                    <TableCell className="font-medium">{role.title}</TableCell>
                                    <TableCell className="font-medium">
                                      <div className="flex items-center gap-2">
                                        {group.companyLogoUrl ? (
                                          <img
                                            src={group.companyLogoUrl}
                                            alt={`${group.companyName} logo`}
                                            className="h-5 w-5 rounded-sm border border-border/40 object-cover"
                                          />
                                        ) : null}
                                        <div className="line-clamp-2" title={group.companyName}>{group.companyName}</div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      <div className="line-clamp-2" title={group.location}>{group.location}</div>
                                    </TableCell>
                                    <TableCell className="font-medium whitespace-nowrap">{role.start ?? "N/A"}</TableCell>
                                    <TableCell className="font-medium whitespace-nowrap">{role.end ?? (role.start ? "Present" : "N/A")}</TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                ))}
                              </Fragment>
                            )
                          })}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <div className="flex items-center gap-4">
                    <p className="text-sm text-muted-foreground">
                            {totalResults > 0 ? (
                              <>
                                Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, totalResults).toLocaleString()}</span> to <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + (searchResults?.length || 0), totalResults).toLocaleString()}</span> of <span className="font-medium">{(totalResults || 0).toLocaleString()}</span> people
                              </>
                            ) : 'No results'}
                    </p>
                  </div>
                        <div className="flex items-center gap-3">
                          <Pagination currentPage={currentPage} totalPages={Math.max(1, Math.ceil((totalResults || 0) / (itemsPerPage || DEFAULT_PAGE_SIZE)))} onPageChange={onPageChange} disabled={loading} />
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={Math.max(1, Math.ceil((totalResults || 0) / (itemsPerPage || DEFAULT_PAGE_SIZE)))}
                              placeholder="Go to"
                              className="h-8 w-[88px]"
                              value={pageJump}
                              onChange={(e) => setPageJump(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const value = Number(pageJump)
                                  const maxPages = Math.max(1, Math.ceil((totalResults || 0) / (itemsPerPage || DEFAULT_PAGE_SIZE)))
                                  const next = Math.min(Math.max(1, isNaN(value) ? 1 : value), maxPages)
                                  onPageChange(next)
                                  setPageJump('')
                                }
                              }}
                              aria-label="Go to page"
                            />
                            <Button
                              variant="outline"
                              className="h-8"
                              onClick={() => {
                                const value = Number(pageJump)
                                const maxPages = Math.max(1, Math.ceil((totalResults || 0) / (itemsPerPage || DEFAULT_PAGE_SIZE)))
                                const next = Math.min(Math.max(1, isNaN(value) ? 1 : value), maxPages)
                                onPageChange(next)
                                setPageJump('')
                              }}
                            >
                              Go
                            </Button>
                          </div>
                        </div>
                </div>
                    </>
                  )}
              </div>
            </Card>
            )}
          </div>
        </div>
      </div>
      {/* Segment selection modal */}
      <Dialog open={isSegmentModalOpen} onOpenChange={setIsSegmentModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Select segment</DialogTitle>
            <DialogDescription>Choose a segment to associate with the new leads query.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Segment</p>
            <Select value={selectedSegmentId} onValueChange={(v) => setSelectedSegmentId(v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder={segmentsLoading ? 'Loading segments…' : 'Select segment'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No segment</SelectItem>
                {availableSegments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="pt-2">
              <p className="text-xs text-muted-foreground mb-1">ICP name</p>
              <Input
                placeholder="e.g. SaaS US - Heads of Growth"
                value={icpName}
                onChange={(e) => setIcpName(e.target.value)}
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSegmentModalOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmAddToLeads} disabled={addingToLeads || segmentsLoading}>
              {addingToLeads ? 'Adding…' : 'Add to leads'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ICP selection modal */}
      <Dialog open={isIcpModalOpen} onOpenChange={setIsIcpModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Load saved lists</DialogTitle>
            <DialogDescription>Select a saved list to load its query.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {icpListLoading ? (
          <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Card key={idx} className="border border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-md" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-2/3" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                        <Skeleton className="h-9 w-20 rounded-md" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>
            ) : availableIcps.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No saved lists found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {availableIcps.map((icp) => (
                  <Card 
                    key={icp.id} 
                    className="border border-border hover:border-foreground/20 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedIcpId(icp.id)
                      // Auto-load the selected list
                      handleLoadIcp(icp.id)
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {(icp.name && icp.name.trim()) ? icp.name.charAt(0).toUpperCase() : "L"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">
                              {(icp.name && icp.name.trim()) ? icp.name : `List ${icp.id.slice(0,8)}…`}
                            </h3>
                            {icp.status && (
                              <Badge 
                                variant={icp.status === 'completed' ? 'default' : icp.status === 'mining' ? 'secondary' : 'outline'}
                                className="h-5 px-2 text-xs"
                              >
                                {icp.status}
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1">
                            {icp.status === 'mining' && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Progress: {icp.progress_percent || '0.00'}%</span>
                                  <span className="text-muted-foreground">
                                    {icp.processed_targets || 0} / {icp.total_targets || 0} targets
                                  </span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-1.5">
                                  <div 
                                    className="bg-primary h-1.5 rounded-full transition-all duration-300" 
                                    style={{ width: `${icp.progress_percent || '0'}%` }}
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Found {icp.found_matches || 0} matches
                                </p>
                              </div>
                            )}
                            {icp.status === 'completed' && (
                              <p className="text-sm text-muted-foreground">
                                Ready to load • {icp.found_matches || 0} matches found
                              </p>
                            )}
                            {icp.status === 'pending' && (
                              <p className="text-sm text-muted-foreground">
                                Queued for mining
                              </p>
                            )}
                            {!icp.status && (
                              <p className="text-sm text-muted-foreground">
                                Status unknown
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
            <Button
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteIcp(icp.id)
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
            </Button>
                          <Button 
                            variant="secondary" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleLoadIcp(icp.id)
                            }}
                          >
                            Load
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIcpModalOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Enrich confirmation modal */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add and Enrich Selected People</DialogTitle>
            <DialogDescription>
              Are you sure you want to add and enrich {selectedPersonIds.length} {selectedPersonIds.length === 1 ? 'person' : 'people'}? This will call the enrich API for each selected person.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)} disabled={isEnriching}>
              Cancel
            </Button>
            <Button onClick={handleEnrich} disabled={isEnriching}>
              {isEnriching ? 'Enriching...' : 'Add and Enrich'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Edit ICP name modal */}
      <Dialog open={isEditIcpModalOpen} onOpenChange={setIsEditIcpModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Saved List</DialogTitle>
            <DialogDescription>
              Update the name and segment for this saved list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Name</p>
              <Input
                placeholder="e.g. SaaS US - Heads of Growth"
                value={editingIcpName}
                onChange={(e) => setEditingIcpName(e.target.value)}
                className="h-10"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleEditIcp()
                  }
                }}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Segment</p>
              {editingIcpSegmentsLoading ? (
                <div className="h-10 flex items-center">
                  <p className="text-xs text-muted-foreground">Loading segments…</p>
                </div>
              ) : (
                <Select value={editingIcpSegmentId} onValueChange={(v) => setEditingIcpSegmentId(v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select segment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No segment</SelectItem>
                    {availableSegments.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditIcpModalOpen(false)
              setEditingIcp(null)
              setEditingIcpName("")
              setEditingIcpSegmentId('none')
            }}>
              Cancel
            </Button>
            <Button onClick={handleEditIcp} disabled={!editingIcpName.trim() || editingIcpSegmentsLoading}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


