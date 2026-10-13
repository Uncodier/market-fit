import type { Lead } from "./types"
import type { LeadFilters } from "@/app/components/kanban-view"

/**
 * Normalize origin value: replace "lead_generation_workflow" with "Makinari"
 */
export function normalizeOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null
  return origin === "lead_generation_workflow" ? "Makinari" : origin
}

const JOURNEY_STAGE_ORDER = [
  'not_contacted',
  'awareness', 
  'consideration', 
  'decision', 
  'purchase', 
  'retention', 
  'referral'
]

export const getCompanyName = (lead: Lead) => {
  if (lead.companies && lead.companies.name) {
    return lead.companies.name
  }
  if (lead.company && typeof lead.company === 'object' && lead.company.name) {
    return lead.company.name
  }
  if (typeof lead.company === 'string') {
    return lead.company
  }
  return lead.name
}

export const getCompanyKey = (lead: Lead) => {
  if ((lead.companies && lead.companies.name) || 
      (lead.company && typeof lead.company === 'object' && lead.company.name) ||
      (typeof lead.company === 'string')) {
    const companyName = getCompanyName(lead)
    return companyName.toLowerCase().trim()
  }
  
  return `lead_${lead.id}`
}

export interface CompanyGroup {
  companyName: string
  companyKey: string
  leads: Lead[]
  mostAdvancedLead: Lead
  mostAdvancedStage: string
  leadCount: number
  isExpanded: boolean
}

export type LeadSortOption = "newest" | "oldest" | "nearest_due_date" | "last_updated"

const getDateTimestamp = (dateValue?: string | null): number | null => {
  if (!dateValue) return null
  const timestamp = new Date(dateValue).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

export const getLeadSortComparator = (sortBy: LeadSortOption) => {
  const now = Date.now()

  return (a: Lead, b: Lead) => {
    const createdA = getDateTimestamp(a.created_at) ?? 0
    const createdB = getDateTimestamp(b.created_at) ?? 0

    if (sortBy === "oldest") return createdA - createdB
    if (sortBy === "newest") return createdB - createdA

    if (sortBy === "last_updated") {
      const updatedA = getDateTimestamp(a.updated_at) ?? createdA
      const updatedB = getDateTimestamp(b.updated_at) ?? createdB
      return updatedB - updatedA
    }

    const dueA = getDateTimestamp(a.last_contact)
    const dueB = getDateTimestamp(b.last_contact)
    const distanceA = dueA === null ? Number.POSITIVE_INFINITY : Math.abs(dueA - now)
    const distanceB = dueB === null ? Number.POSITIVE_INFINITY : Math.abs(dueB - now)

    if (distanceA !== distanceB) return distanceA - distanceB

    return createdB - createdA
  }
}

export const getMostAdvancedLead = (leads: Lead[], journeyStages: Record<string, string>): Lead => {
  if (!leads || leads.length === 0) throw new Error('No leads provided to getMostAdvancedLead')
  
  return leads.reduce((mostAdvanced, currentLead) => {
    const currentStage = journeyStages[currentLead.id] || 'not_contacted'
    const advancedStage = journeyStages[mostAdvanced.id] || 'not_contacted'
    
    const currentIndex = JOURNEY_STAGE_ORDER.indexOf(currentStage)
    const advancedIndex = JOURNEY_STAGE_ORDER.indexOf(advancedStage)
    
    if (currentIndex > advancedIndex) {
      return currentLead
    }
    
    if (currentIndex === advancedIndex) {
      return new Date(currentLead.created_at) > new Date(mostAdvanced.created_at) ? currentLead : mostAdvanced
    }
    
    return mostAdvanced
  })
}

export const groupLeadsByCompany = (
  leads: Lead[],
  journeyStages: Record<string, string>,
  expandedCompanies: Record<string, boolean>,
  sortBy: LeadSortOption
): CompanyGroup[] => {
  if (!leads || !Array.isArray(leads)) return []
  
  const groups: Record<string, CompanyGroup> = {}
  
  leads.forEach(lead => {
    const companyKey = getCompanyKey(lead)
    const companyName = getCompanyName(lead)
    
    if (!groups[companyKey]) {
      groups[companyKey] = {
        companyName,
        companyKey,
        leads: [],
        mostAdvancedLead: lead,
        mostAdvancedStage: journeyStages[lead.id] || 'not_contacted',
        leadCount: 0,
        isExpanded: expandedCompanies[companyKey] || false
      }
    }
    
    groups[companyKey].leads.push(lead)
    groups[companyKey].leadCount = groups[companyKey].leads.length
  })
  
  const leadComparator = getLeadSortComparator(sortBy)

  Object.values(groups).forEach(group => {
    group.leads.sort(leadComparator)
    
    group.mostAdvancedLead = getMostAdvancedLead(group.leads, journeyStages)
    group.mostAdvancedStage = journeyStages[group.mostAdvancedLead.id] || 'not_contacted'
  })
  
  return Object.values(groups).sort((a, b) => {
    const representativeLeadA = a.leads[0]
    const representativeLeadB = b.leads[0]
    const primarySort = leadComparator(representativeLeadA, representativeLeadB)

    if (primarySort !== 0) {
      return primarySort
    }
    
    const aStageIndex = JOURNEY_STAGE_ORDER.indexOf(a.mostAdvancedStage)
    const bStageIndex = JOURNEY_STAGE_ORDER.indexOf(b.mostAdvancedStage)
    
    if (aStageIndex !== bStageIndex) {
      return bStageIndex - aStageIndex
    }
    
    return new Date(b.mostAdvancedLead.created_at).getTime() - new Date(a.mostAdvancedLead.created_at).getTime()
  })
}

export function getDefaultLeadSort(urlSort: string | null): LeadSortOption {
  return urlSort === 'updated_at' || urlSort === 'last_updated' ? 'last_updated' : (urlSort === 'created_at' || urlSort === 'newest' ? 'newest' : (urlSort === 'oldest' ? 'oldest' : (urlSort === 'nearest_due_date' ? 'nearest_due_date' : 'newest')))
}

export const filterLeads = (
  dbLeads: Lead[],
  status: string,
  filters: LeadFilters,
  leadJourneyStages: Record<string, string>,
  searchQuery: string,
  sortBy: LeadSortOption
) => {
  if (!dbLeads || !Array.isArray(dbLeads)) return []

  let filtered = dbLeads

  // First apply tab-based status filter
  if (status !== "all") {
    filtered = filtered.filter(lead => lead.status === status)
  }

  // Apply advanced status filters only if we're on "all" tab
  if (filters.status.length > 0) {
    if (status === "all") {
      filtered = filtered.filter(lead => filters.status.includes(lead.status))
    } else {
      if (filters.status.includes(status)) {
        // Keep current filter
      } else {
        return []
      }
    }
  }

  // Apply segment filters
  if (filters.segments.length > 0) {
    filtered = filtered.filter(lead => 
      lead.segment_id && filters.segments.includes(lead.segment_id)
    )
  }

  // Apply origin filters
  if (filters.origin.length > 0) {
    filtered = filtered.filter(lead => 
      lead.origin && filters.origin.includes(lead.origin)
    )
  }

  // Apply journey stage filters
  if (filters.journeyStages.length > 0) {
    filtered = filtered.filter(lead => {
      const leadStage = leadJourneyStages[lead.id] || 'not_contacted'
      return filters.journeyStages.includes(leadStage)
    })
  }

  // Apply search query filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim()
    filtered = filtered.filter(lead => {
      const companyName = getCompanyName(lead)

      return (
        (lead.name && lead.name.toLowerCase().includes(query)) || 
        (lead.email && lead.email.toLowerCase().includes(query)) || 
        (companyName && companyName.toLowerCase().includes(query)) ||
        (lead.position && lead.position.toLowerCase().includes(query)) ||
        (lead.phone && lead.phone.toLowerCase().includes(query)) ||
        (lead.origin && lead.origin.toLowerCase().includes(query))
      )
    })
  }

  filtered = filtered.sort(getLeadSortComparator(sortBy))

  return filtered
}

// Helper function to normalize company field to match UpdateLeadSchema requirements
// Returns the normalized company or undefined if it should be omitted from the update
export const normalizeCompanyField = (lead: Lead): string | { name?: string; website?: string; industry?: string; size?: string; annual_revenue?: string; founded?: string; description?: string; address?: { street?: string; city?: string; state?: string; zipcode?: string; country?: string } } | null | undefined => {
  // If we have company_id, we can optionally omit the company field
  // But if company data exists, we should still normalize it

  // Handle null or undefined company
  if (!lead.company) {
    // If we have a companies relation with a name, use that as a string
    if (lead.companies?.name) {
      return lead.companies.name
    }
    // If we have company_id, we can omit the field (return undefined)
    if (lead.company_id) {
      return undefined
    }
    return null
  }

  // Handle string company (even though type says object, it can be string in practice)
  const companyValue = lead.company as any
  if (typeof companyValue === 'string') {
    const companyString = companyValue.trim()
    return companyString || (lead.company_id ? undefined : null)
  }

  // If company is an object, extract only the valid schema fields
  if (typeof companyValue === 'object' && companyValue !== null) {
    // Check if it's an empty object
    if (Object.keys(companyValue).length === 0) {
      return lead.company_id ? undefined : null
    }
    const normalized: any = {}

    // Extract ONLY valid fields according to UpdateLeadSchema
    // Schema allows: name, website, industry, size, annual_revenue, founded, description, domain, location, external_organization_id, address
    // We only include fields that have valid string values (not null, not empty)
    const validStringFields = ['name', 'website', 'industry', 'size', 'annual_revenue', 'founded', 'description', 'domain']

    for (const field of validStringFields) {
      const value = companyValue[field]
      // Only include if it's a non-empty string
      if (typeof value === 'string' && value.trim() !== '') {
        normalized[field] = value.trim()
      }
      // Explicitly skip null, undefined, empty strings, and any other types
    }

    // Handle location field (can be any structure)
    if (companyValue.location !== undefined && companyValue.location !== null) {
      normalized.location = companyValue.location
    }

    // Handle external_organization_id (can be string or number)
    if (companyValue.external_organization_id !== undefined && companyValue.external_organization_id !== null) {
      normalized.external_organization_id = companyValue.external_organization_id
    }

    // Handle address object
    if (companyValue.address && typeof companyValue.address === 'object' && companyValue.address !== null) {
      const normalizedAddress: any = {}
      if (companyValue.address.street !== undefined && companyValue.address.street !== null && companyValue.address.street !== '') {
        normalizedAddress.street = companyValue.address.street
      }
      if (companyValue.address.city !== undefined && companyValue.address.city !== null && companyValue.address.city !== '') {
        normalizedAddress.city = companyValue.address.city
      }
      if (companyValue.address.state !== undefined && companyValue.address.state !== null && companyValue.address.state !== '') {
        normalizedAddress.state = companyValue.address.state
      }
      if (companyValue.address.zipcode !== undefined && companyValue.address.zipcode !== null && companyValue.address.zipcode !== '') {
        normalizedAddress.zipcode = companyValue.address.zipcode
      }
      if (companyValue.address.country !== undefined && companyValue.address.country !== null && companyValue.address.country !== '') {
        normalizedAddress.country = companyValue.address.country
      }

      if (Object.keys(normalizedAddress).length > 0) {
        normalized.address = normalizedAddress
      }
    }

    // If we have a name, return the normalized object (only with valid schema fields)
    if (normalized.name) {
      // Return only the normalized object with valid fields
      return normalized
    }

    // If no name in company object but we have companies relation, use that name
    if (lead.companies?.name) {
      normalized.name = lead.companies.name
      return normalized
    }

    // If object is empty or invalid, return null or undefined based on company_id
    if (Object.keys(normalized).length === 0) {
      return lead.company_id ? undefined : null
    }

    // If we have some fields but no name, and we have company_id, we can omit
    // Otherwise, if we have fields but no name, we still need a name, so return null
    if (lead.company_id) {
      return undefined
    }

    // If we have fields but no name and no company_id, we can't create a valid object
    // Return null to indicate invalid state
    return null
  }

  // Fallback: if we have company_id, omit the field, otherwise return null
  return lead.company_id ? undefined : null
}
