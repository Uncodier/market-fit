import React, { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useSite } from "@/app/context/SiteContext"
import { getLeads, updateLead as updateLeadAction, createLead as createLeadAction } from "@/app/leads/actions"
import { getSegments } from "@/app/segments/actions"
import { Lead, Segment, LeadFilters } from "@/app/leads/types"
import { toast } from "sonner"

interface LeadsContextType {
  leads: Lead[]
  segments: Segment[]
  loading: boolean
  filters: LeadFilters
  searchQuery: string
  updateFilters: (filters: LeadFilters) => void
  updateSearchQuery: (query: string) => void
  clearFilters: () => void
  createLead: (leadData: any) => Promise<{ error?: string; lead?: any }>
  updateLead: (id: string, data: Partial<Lead>) => Promise<void>
  refreshLeads: () => Promise<void>
}

const LeadsContext = createContext<LeadsContextType>({
  leads: [],
  segments: [],
  loading: false,
  filters: { status: [], segments: [], origin: [] },
  searchQuery: "",
  updateFilters: () => {},
  updateSearchQuery: () => {},
  clearFilters: () => {},
  createLead: async () => ({ error: "Not implemented" }),
  updateLead: async () => {},
  refreshLeads: async () => {}
})

export const useLeads = () => useContext(LeadsContext)

interface LeadsProviderProps {
  children: ReactNode
}

export function LeadsProvider({ children }: LeadsProviderProps) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<LeadFilters>({
    status: [],
    segments: [],
    origin: []
  })
  const [searchQuery, setSearchQuery] = useState("")
  const { currentSite } = useSite()
  
  // Load leads when currentSite changes
  useEffect(() => {
    refreshLeads()
    loadSegments()
  }, [currentSite])
  
  // Function to load leads from database
  const refreshLeads = async () => {
    if (!currentSite?.id) return
    
    setLoading(true)
    try {
      const result = await getLeads(currentSite.id)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Normalize leads to ensure all fields are present
      const normalizedLeads = result.leads?.map(lead => ({
        ...lead,
        origin: lead.origin || null
      })) || []
      
      setLeads(normalizedLeads)
    } catch (error) {
      console.error("Error loading leads:", error)
      toast.error("Error loading leads")
    } finally {
      setLoading(false)
    }
  }
  
  // Function to load segments
  const loadSegments = async () => {
    if (!currentSite?.id) return
    
    try {
      const response = await getSegments(currentSite.id)
      if (response.error) {
        console.error(response.error)
        return
      }
      
      if (response.segments) {
        setSegments(response.segments.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })))
      }
    } catch (error) {
      console.error("Error loading segments:", error)
    }
  }
  
  // Function to update filters
  const updateFilters = (newFilters: LeadFilters) => {
    setFilters(newFilters)
  }
  
  // Function to update search query
  const updateSearchQuery = (query: string) => {
    setSearchQuery(query)
  }
  
  // Function to clear filters
  const clearFilters = () => {
    setFilters({
      status: [],
      segments: [],
      origin: []
    })
    setSearchQuery("")
  }
  
  // Function to create a new lead
  const createLead = async (leadData: any) => {
    if (!currentSite?.id) {
      return { error: "No site selected" }
    }
    
    try {
      const result = await createLeadAction({
        ...leadData,
        site_id: currentSite.id
      })
      
      if (result.error) {
        return { error: result.error }
      }
      
      await refreshLeads()
      return { lead: result.lead }
    } catch (error) {
      console.error("Error creating lead:", error)
      return { error: "Error creating lead" }
    }
  }
  
  // Function to update a lead
  const updateLead = async (id: string, data: Partial<Lead>) => {
    if (!currentSite?.id) {
      toast.error("No site selected")
      return
    }
    
    try {
      // Find the existing lead to get its current attribution data
      const existingLead = leads.find(l => l.id === id)
      
      // Make sure the required fields are present
      const updateData = {
        id,
        name: data.name || "", // Ensure required fields have fallback values
        email: data.email || "",
        status: data.status || "new", // Default to new status if undefined
        site_id: currentSite.id,
        // Preserve existing attribution data unless explicitly provided
        ...(existingLead?.attribution && !data.attribution && { attribution: existingLead.attribution }),
        ...data
      }
      
      const result = await updateLeadAction(updateData)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Update lead in local state
      setLeads(prevLeads =>
        prevLeads.map(l =>
          l.id === id ? { ...l, ...data } : l
        )
      )
      
      toast.success("Lead updated successfully")
    } catch (error) {
      console.error("Error updating lead:", error)
      toast.error("Error updating lead")
    }
  }
  
  const contextValue: LeadsContextType = {
    leads,
    segments,
    loading,
    filters,
    searchQuery,
    updateFilters,
    updateSearchQuery,
    clearFilters,
    createLead,
    updateLead,
    refreshLeads
  }
  
  return (
    <LeadsContext.Provider value={contextValue}>
      {children}
    </LeadsContext.Provider>
  )
} 