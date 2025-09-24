"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { apiClient } from "@/app/services/api-client-service"
import { cn } from "@/lib/utils"
import { useLayout } from "@/app/context/LayoutContext"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Card } from "@/app/components/ui/card"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Avatar, AvatarImage, AvatarFallback } from "@/app/components/ui/avatar"
import { Pagination } from "@/app/components/ui/pagination"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { SidebarToggle } from "@/app/control-center/components/SidebarToggle"
import { Breadcrumb } from "@/app/components/navigation/Breadcrumb"
import { Search, ChevronUp, ChevronDown, ChevronRight, X } from "@/app/components/ui/icons"
import { Badge } from "@/app/components/ui/badge"
import { CalendarDateRangePicker } from "@/app/components/ui/date-range-picker"
import { Switch } from "@/app/components/ui/switch"
import { Slider } from "@/app/components/ui/slider"

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

type FinderSimpleEventSource = 'product_hunt' | 'crunchbase' | 'indeed' | string
type FinderSimpleEventReason = 'report_released' | string

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
  job_post_is_remote?: boolean
  job_post_is_active?: boolean
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
}

function CollapsibleField({ title, children, defaultOpen = true, countBadge, onClear }: CollapsibleFieldProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border border-border/30 bg-muted/40">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setOpen(!open)}
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

function ChipsInput({ values, onChange, placeholder = "Search" }: { values: string[]; onChange: (next: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState("")
  const add = () => {
    const v = text.trim()
    if (!v) return
    onChange(Array.from(new Set([...values, v])))
    setText("")
  }
  return (
    <div className="space-y-2">
      <Input
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [sidebarLeft, setSidebarLeft] = useState("256px")

  // filters
  const [query, setQuery] = useState("")
  const [industries, setIndustries] = useState<LookupOption[]>([])
  const [locations, setLocations] = useState<LookupOption[]>([])
  const [employeeFrom, setEmployeeFrom] = useState<number | "">("")
  const [employeeTo, setEmployeeTo] = useState<number | "">("")
  const [revenueFrom, setRevenueFrom] = useState<number | "">("")
  const [revenueTo, setRevenueTo] = useState<number | "">("")
  const [domainRankFrom, setDomainRankFrom] = useState<number | "">("")
  const [domainRankTo, setDomainRankTo] = useState<number | "">("")
  // single-string filters
  const [personName, setPersonName] = useState<string>("")
  const [jobTitle, setJobTitle] = useState<string>("")
  const [skills, setSkills] = useState<LookupOption[]>([])
  const [companies, setCompanies] = useState<LookupOption[]>([])
  const [keywords, setKeywords] = useState<LookupOption[]>([])
  const [isCurrentRole, setIsCurrentRole] = useState(true)
  const [roleDateRange, setRoleDateRange] = useState<{ start?: Date; end?: Date }>({})
  // job postings
  const [jobPostingTitle, setJobPostingTitle] = useState<string>("")
  const [jobPostingDescription, setJobPostingDescription] = useState("")
  const [jobFeaturedRange, setJobFeaturedRange] = useState<{ start?: Date; end?: Date }>({})
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
  // simple events
  const [simpleEventSource, setSimpleEventSource] = useState<string>("")
  const [simpleEventReason, setSimpleEventReason] = useState<string>("")

  // pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // remote data state
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [totalResults, setTotalResults] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [addingToLeads, setAddingToLeads] = useState(false)

  useEffect(() => {
    setSidebarLeft(isLayoutCollapsed ? "64px" : "256px")
  }, [isLayoutCollapsed])

  useEffect(() => {
    document.title = "Find People | Market Fit"
    const event = new CustomEvent("breadcrumb:update", {
      detail: { title: "Find People", path: "/people", section: "Find People" }
    })
    window.dispatchEvent(event)
    return () => { document.title = "Market Fit" }
  }, [])

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
  const buildFinderPayload = (pageOneBased: number): FinderRequest => {
    const roleStart = toYmd(roleDateRange.start)
    const roleEnd = toYmd(roleDateRange.end)
    const jobStart = toYmd(jobFeaturedRange.start)
    const jobEnd = toYmd(jobFeaturedRange.end)
    const fundStart = toYmd(fundingDateRange.start)
    const fundEnd = toYmd(fundingDateRange.end)

  // Treat company chips added manually that look like domains as organization_domains
  const companyDomains = companies
    .filter(c => (!c.id || c.id === null) && /\./.test(c.text) && !/\s/.test(c.text))
    .map(c => c.text)

    const payload: FinderRequest = {
      page: Math.max(0, pageOneBased - 1),
      role_title: jobTitle || undefined,
      role_description: query || undefined,
      role_is_current: isCurrentRole,
      role_position_start_date: roleStart,
      role_position_end_date: roleEnd,

      person_name: personName || undefined,
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
      organization_domains: companyDomains.length ? companyDomains : undefined,
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

      simple_event_source: simpleEventSource || undefined,
      simple_event_reason: simpleEventReason || undefined,

      funding_types: fundingType ? [fundingType] : undefined,
      funding_total_start: fundingRangeTouched ? fundingRange?.[0] : undefined,
      funding_total_end: fundingRangeTouched ? fundingRange?.[1] : undefined,
      funding_event_date_featured_start: fundStart,
      funding_event_date_featured_end: fundEnd,

      job_post_title: jobPostingTitle || undefined,
      job_post_description: jobPostingDescription || undefined,
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

    return payload
  }

  const handleSearch = async (page: number = 1) => {
    setLoading(true)
    setError(null)
    try {
      const payload = buildFinderPayload(page)
      console.log('[People] Finder payload:', payload)
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
      console.log('[People] Finder raw response:', res)
      if (!res.success) {
        throw new Error(res.error?.message || 'Finder request failed')
      }
      const data = res.data as any
      const totalsData = totals?.data as any
      console.log('[People] Finder parsed data:', { data, totals: totalsData })
      setSearchResults(Array.isArray(data?.search_results) ? data.search_results : [])
      const computedTotal = typeof totalsData?.total_persons === 'number'
        ? totalsData.total_persons
        : (typeof data?.total_search_results === 'number' ? data.total_search_results : 0)
      setTotalResults(computedTotal)
    } catch (e: any) {
      console.error('[People] Finder error:', e)
      toast.error(e?.message || 'Finder request failed')
      // Do not persist error in UI; reset to empty state
      setError(null)
      setSearchResults([])
      setTotalResults(0)
    } finally {
      setLoading(false)
    }
  }

  // Dynamic column widths depending on sidebar state to avoid horizontal scroll
  // Removed phone and emails columns; redistribute widths across remaining columns
  const tableColumnWidths = isSidebarCollapsed
    ? { name: 30, role: 14, company: 24, location: 12, start: 10, end: 10 }
    : { name: 28, role: 14, company: 22, location: 16, start: 10, end: 10 }

  // Calculate dynamic max width for main content based on left nav and filters sidebar
  const leftNavWidth = isLayoutCollapsed ? 64 : 256
  const filtersWidth = isSidebarCollapsed ? 0 : 319
  const contentMaxWidth = `calc(100vw - ${leftNavWidth + filtersWidth}px)`

  // Selection removed for now
  const handleAddToLeads = async () => {
    try {
      setAddingToLeads(true)
      const payload = buildFinderPayload(currentPage)
      const res = await apiClient.post('/api/finder/person_role_search/createQuery', payload, { includeAuth: false })
      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to create query')
      }
      toast.success('Leads query created successfully')
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

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))
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
              <h3 className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2" style={{ fontSize: '10.8px' }}>Person Criteria</h3>
              <div className="space-y-3">
                <CollapsibleField title="Name" defaultOpen={false}>
                  <p className="text-xs text-muted-foreground mb-2">Use “quotation marks” for exact matches.</p>
                  <Input className="h-10" placeholder="Search" value={personName} onChange={(e)=> setPersonName(e.target.value)} />
                </CollapsibleField>
                <CollapsibleField title="Job Title" defaultOpen={false}>
                  <p className="text-xs text-muted-foreground mb-2">Use “quotation marks” for exact matches</p>
                  <Input className="h-10" placeholder="Search" value={jobTitle} onChange={(e)=> setJobTitle(e.target.value)} />
                  {/* Job description (boolean search) */}
                  <div className="mt-4 flex flex-col items-start space-y-2">
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <Input placeholder="Keywords" className="h-10" value={query} onChange={(e)=> setQuery(e.target.value)} />
                  </div>
                  <div className="mt-4 space-y-2">
                    <label className="text-left text-xs text-muted-foreground">Role Date Range</label>
                    <CalendarDateRangePicker 
                      onRangeChange={(start, end) => setRoleDateRange({ start, end })}
                      className="w-full [&_.btn]:h-10 [&_.btn]:items-start"
                    />
                    <p className="text-left text-xs text-muted-foreground">Pick the period for the role.</p>
                  </div>
                  <div className="py-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="current-role" className="text-left text-sm text-foreground">Role is current</label>
                    <Switch id="current-role" checked={isCurrentRole} onCheckedChange={setIsCurrentRole} />
                  </div>
                </CollapsibleField>
                <CollapsibleField title="Industry" defaultOpen={false} countBadge={industries.length} onClear={() => setIndustries([])}>
                  <LookupChipsInput 
                    values={industries}
                    onChange={setIndustries}
                    placeholder="Search industries"
                    fetcher={(q) => lookupFetcher('industries', q)}
                  />
                </CollapsibleField>
                <CollapsibleField title="Location" defaultOpen={false} countBadge={locations.length} onClear={() => setLocations([])}>
                  <LookupChipsInput 
                    values={locations}
                    onChange={setLocations}
                    placeholder="Search locations"
                    fetcher={(q) => lookupFetcher('locations', q)}
                  />
                </CollapsibleField>
                <CollapsibleField title="Skills" countBadge={skills.length} onClear={() => setSkills([])} defaultOpen={false}>
                  <LookupChipsInput 
                    values={skills} 
                    onChange={setSkills} 
                    placeholder="Search skills"
                    fetcher={(q) => lookupFetcher('skills', q)}
                  />
                </CollapsibleField>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2" style={{ fontSize: '10.8px' }}>Company Criteria</h3>
              <div className="space-y-3">
                <CollapsibleField title="Company" countBadge={companies.length} onClear={() => setCompanies([])} defaultOpen={false}>
                  <LookupChipsInput 
                    values={companies}
                    onChange={setCompanies}
                    placeholder="Search companies"
                    fetcher={(q) => lookupFetcher('organizations', q)}
                  />
                </CollapsibleField>
                <CollapsibleField title="Employee Range" defaultOpen={false}>
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
                </CollapsibleField>
                <CollapsibleField title="Revenue Range (USD)" defaultOpen={false}>
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
                </CollapsibleField>
                <CollapsibleField title="Keywords" countBadge={keywords.length} onClear={() => setKeywords([])} defaultOpen={false}>
                  <LookupChipsInput 
                    values={keywords} 
                    onChange={setKeywords} 
                    placeholder="Keywords"
                    fetcher={(q) => lookupFetcher('org_keywords', q)}
                  />
                </CollapsibleField>
                <CollapsibleField title="Domain Rank" defaultOpen={false}>
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
                </CollapsibleField>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2" style={{ fontSize: '10.8px' }}>Buying Intent</h3>
              <div className="space-y-3">
                <CollapsibleField title="Job Postings" defaultOpen={false}>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Title</p>
                      <p className="text-xs text-muted-foreground mb-2">Use “quotation marks” for exact matches</p>
                      <Input className="h-10" placeholder="Search" value={jobPostingTitle} onChange={(e)=> setJobPostingTitle(e.target.value)} />
                    </div>
                    <div className="flex flex-col items-start space-y-2">
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <Input placeholder="Description" className="h-10" value={jobPostingDescription} onChange={(e)=> setJobPostingDescription(e.target.value)} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Job featured date</p>
                      <CalendarDateRangePicker onRangeChange={(start, end)=> setJobFeaturedRange({ start, end })} className="w-full" />
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
                <CollapsibleField title="Funding" defaultOpen={false}>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Funding Date</p>
                      <CalendarDateRangePicker onRangeChange={(start, end)=> setFundingDateRange({ start, end })} className="w-full" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground font-medium">Funding Amount</p>
                        <p className="text-sm">{fundingRange[0].toLocaleString()} - {fundingRange[1].toLocaleString()}</p>
                      </div>
                      <div className="pt-2">
                        <Slider 
                          value={fundingRange}
                          onValueChange={(v:any)=> { setFundingRange([v[0], v[1]]); setFundingRangeTouched(true) }}
                          min={0}
                          max={1000000}
                          step={5000}
                          className="style-slider-thumb"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Funding Type</p>
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
                <CollapsibleField title="Technologies" countBadge={technologies.length} defaultOpen={false}>
                  <LookupChipsInput 
                    values={technologies}
                    onChange={setTechnologies}
                    placeholder="Search technologies"
                    fetcher={(q) => lookupFetcher('web_technologies', q)}
                  />
                </CollapsibleField>
                <CollapsibleField title="Signals" defaultOpen={false}>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Simple Event Source</p>
                      <Select value={simpleEventSource} onValueChange={setSimpleEventSource}>
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
                      <Select value={simpleEventReason} onValueChange={setSimpleEventReason}>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Select reason" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="report_released">Report released</SelectItem>
                          <SelectItem value="promoted_on_site">Promoted on site</SelectItem>
                        </SelectContent>
                      </Select>
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
                onClick={()=>{ setQuery(""); setIndustries([]); setLocations([]); setEmployeeFrom(""); setEmployeeTo(""); setRevenueFrom(""); setRevenueTo(""); setPersonName(""); setJobTitle(""); setSkills([]); setCompanies([]); setKeywords([]); setTechnologies([]); setJobPostingTitle(""); setJobPostingDescription(""); setJobFeaturedRange({}); setIncludeRemote(false); setIsJobActive(false); setJobLocations([]); setJobLocationsExclude([]); setFundingDateRange({}); setFundingType(""); setFundingRangeTouched(false); }}
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
              <div></div>
              <div className="flex items-center gap-2">
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
                              <>
                                <TableRow 
                                  key={`${group.key}-row`}
                                  className={cn("group hover:bg-muted/50 transition-colors", isExpandable ? 'cursor-pointer' : '')}
                                  onClick={() => { if (isExpandable) toggleGroup(group.key) }}
                                >
                                  <TableCell className="w-[56px]">
                                    <div className="relative h-8 w-8">
                                      <Avatar className="h-8 w-8 border border-primary/10">
                                      {group.avatarUrl ? (
                                        <AvatarImage src={group.avatarUrl} alt={group.personName} />
                                      ) : null}
                                      <AvatarFallback className="bg-muted text-[10px] leading-none font-medium text-foreground text-center">
                                        {group.personName.split(' ').map((s: string) => s[0]).slice(0,2).join('').toUpperCase()}
                                      </AvatarFallback>
                                      </Avatar>
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
                                  </TableRow>
                                ))}
                              </>
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
                        <Pagination currentPage={currentPage} totalPages={Math.max(1, Math.ceil((totalResults || 0) / (itemsPerPage || DEFAULT_PAGE_SIZE)))} onPageChange={onPageChange} disabled={loading} />
                </div>
                    </>
                  )}
              </div>
            </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


