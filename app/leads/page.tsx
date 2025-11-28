"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { ChevronLeft, ChevronRight, Search, User, Users, MessageSquare, Globe, FileText, Loader, Tag, X, CheckCircle2, ExternalLink, Phone, Pencil, Mail, Filter } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useSite } from "@/app/context/SiteContext"
import { getLeads, createLead, updateLead, deleteLead, searchLeads, searchLeadsWithCount } from "./actions"
import { CreateLeadDialog } from "@/app/components/create-lead-dialog"
import { toast } from "sonner"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/app/components/ui/sheet"
import { Separator } from "@/app/components/ui/separator"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { KanbanView, LeadFilters } from "@/app/components/kanban-view"
import { LeadFilterModal } from "@/app/components/ui/lead-filter-modal"
import { useRouter } from "next/navigation"
import { Lead, AttributionData } from "@/app/leads/types"
import { Campaign } from "@/app/types"
import { JOURNEY_STAGES } from "@/app/leads/types"
import { useCommandK } from "@/app/hooks/use-command-k"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { assignLeadToUser } from "@/app/leads/actions"
import { useAuth } from "@/app/hooks/use-auth"
import { Sparkles, User as UserIcon } from "@/app/components/ui/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { MoreHorizontal, Eye, Trash2 } from "@/app/components/ui/icons"
import { createClient } from "@/lib/supabase/client"
import { AttributionModal } from "@/app/leads/components/AttributionModal"
import { safeReload } from "@/app/utils/safe-reload"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useUserData } from "@/app/hooks/use-user-data"
import { GroupedLeadsTable } from "@/app/leads/components/grouped-leads-table"

// Cache de etapas para cada lead
const leadJourneyStagesCache: Record<string, string> = {};

// Función para limpiar completamente el cache
const clearJourneyStageCache = () => {
  Object.keys(leadJourneyStagesCache).forEach(key => {
    delete leadJourneyStagesCache[key];
  });
};

// Colores para las etapas del journey
const JOURNEY_STAGE_COLORS: Record<string, string> = {
  awareness: 'bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200',
  consideration: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200',
  decision: 'bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200',
  purchase: 'bg-green-50 text-green-700 hover:bg-green-50 border-green-200',
  retention: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-200',
  referral: 'bg-pink-50 text-pink-700 hover:bg-pink-50 border-pink-200',
  not_contacted: 'bg-gray-50 text-gray-700 hover:bg-gray-50 border-gray-200'
}

// Orden de las etapas del journey (más avanzado = índice más alto)
const JOURNEY_STAGE_ORDER = [
  'not_contacted',
  'awareness', 
  'consideration', 
  'decision', 
  'purchase', 
  'retention', 
  'referral'
]

// Función para obtener el nombre de la compañía
const getCompanyName = (lead: Lead) => {
  if (lead.companies && lead.companies.name) {
    return lead.companies.name
  }
  if (lead.company && typeof lead.company === 'object' && lead.company.name) {
    return lead.company.name
  }
  if (typeof lead.company === 'string') {
    return lead.company
  }
  // Si no hay compañía, usar el nombre del lead como "compañía"
  return lead.name
}

// Función para obtener una clave única por empresa
const getCompanyKey = (lead: Lead) => {
  // Si hay compañía real, usar el nombre de la compañía
  if ((lead.companies && lead.companies.name) || 
      (lead.company && typeof lead.company === 'object' && lead.company.name) ||
      (typeof lead.company === 'string')) {
    const companyName = getCompanyName(lead)
    return companyName.toLowerCase().trim()
  }
  
  // Si no hay compañía, usar el ID del lead para asegurar unicidad
  return `lead_${lead.id}`
}

// Interfaz para representar una empresa agrupada
interface CompanyGroup {
  companyName: string
  companyKey: string
  leads: Lead[]
  mostAdvancedLead: Lead
  mostAdvancedStage: string
  leadCount: number
  isExpanded: boolean
}

// Función para determinar el lead más avanzado de una empresa
const getMostAdvancedLead = (leads: Lead[], journeyStages: Record<string, string>): Lead => {
  if (!leads || leads.length === 0) throw new Error('No leads provided to getMostAdvancedLead')
  
  return leads.reduce((mostAdvanced, currentLead) => {
    const currentStage = journeyStages[currentLead.id] || 'not_contacted'
    const advancedStage = journeyStages[mostAdvanced.id] || 'not_contacted'
    
    const currentIndex = JOURNEY_STAGE_ORDER.indexOf(currentStage)
    const advancedIndex = JOURNEY_STAGE_ORDER.indexOf(advancedStage)
    
    // Si el lead actual tiene una etapa más avanzada, lo seleccionamos
    if (currentIndex > advancedIndex) {
      return currentLead
    }
    
    // Si tienen la misma etapa, seleccionar el más reciente
    if (currentIndex === advancedIndex) {
      return new Date(currentLead.created_at) > new Date(mostAdvanced.created_at) ? currentLead : mostAdvanced
    }
    
    return mostAdvanced
  })
}

// Función para agrupar leads por empresa
const groupLeadsByCompany = (leads: Lead[], journeyStages: Record<string, string>, expandedCompanies: Record<string, boolean>): CompanyGroup[] => {
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
  
  // Determinar el lead más avanzado para cada empresa y ordenar leads por fecha
  Object.values(groups).forEach(group => {
    // Ordenar leads dentro del grupo del más nuevo al más viejo
    group.leads.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    
    group.mostAdvancedLead = getMostAdvancedLead(group.leads, journeyStages)
    group.mostAdvancedStage = journeyStages[group.mostAdvancedLead.id] || 'not_contacted'
  })
  
  return Object.values(groups).sort((a, b) => {
    // Ordenar por fecha del lead más reciente primero (para que empresas con leads nuevos aparezcan arriba)
    const aNewestDate = new Date(a.leads[0].created_at).getTime() // Ya están ordenados del más nuevo al más viejo
    const bNewestDate = new Date(b.leads[0].created_at).getTime()
    
    if (aNewestDate !== bNewestDate) {
      return bNewestDate - aNewestDate // Más reciente primero
    }
    
    // Si tienen la misma fecha más reciente, ordenar por etapa más avanzada
    const aStageIndex = JOURNEY_STAGE_ORDER.indexOf(a.mostAdvancedStage)
    const bStageIndex = JOURNEY_STAGE_ORDER.indexOf(b.mostAdvancedStage)
    
    if (aStageIndex !== bStageIndex) {
      return bStageIndex - aStageIndex // Más avanzado primero
    }
    
    // Si tienen la misma etapa, ordenar por fecha de creación del lead más avanzado
    return new Date(b.mostAdvancedLead.created_at).getTime() - new Date(a.mostAdvancedLead.created_at).getTime()
  })
}

// Obtener el nombre legible de una etapa
const getJourneyStageName = (stageId: string) => {
  if (stageId === "not_contacted") return "Unaware"
  return JOURNEY_STAGES.find((stage: { id: string; label: string }) => stage.id === stageId)?.label || "Unknown"
}

// Contexto para manejar los segmentos
interface LeadsContextType {
  segments: Array<{ id: string; name: string }>
}

const LeadsContext = React.createContext<LeadsContextType>({
  segments: []
})

const useLeadsContext = () => React.useContext(LeadsContext)

// Componente Skeleton para carga de la tabla de leads
function LeadsTableSkeleton() {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[250px] w-[300px]">
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead className="min-w-[200px] w-[250px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[200px] min-w-[140px] max-w-[200px]">
              <Skeleton className="h-4 w-20" />
            </TableHead>
            <TableHead className="w-[130px] min-w-[100px] max-w-[130px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[130px] min-w-[110px] max-w-[130px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[120px] min-w-[100px] max-w-[120px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="text-right w-[120px] min-w-[100px] max-w-[120px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array(5).fill(0).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-24 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
    </Card>
  )
}

export default function LeadsPage() {
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [activeTab, setActiveTab] = useState("all")
  const [dbLeads, setDbLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [viewType, setViewType] = useState<ViewType>("table")
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [filters, setFilters] = useState<LeadFilters>({
    status: [],
    segments: [],
    origin: [],
    journeyStages: []
  })
  const { currentSite } = useSite()
  const [showAttributionModal, setShowAttributionModal] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    leadId: string
    leadName: string
    newStatus: string
  } | null>(null)
  
  // Estado para forzar recarga de journey stages
  const [forceReload, setForceReload] = useState(0)
  
  // Estado para manejar la expansión/colapso de empresas
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({})
  
  // Estado para journey stages
  const [leadJourneyStages, setLeadJourneyStages] = useState<Record<string, string>>({})
  const [isLoadingJourneyStages, setIsLoadingJourneyStages] = useState(false)
  const [reloadingLeads, setReloadingLeads] = useState<Set<string>>(new Set())
  const [searchTotalCount, setSearchTotalCount] = useState<number | null>(null)
  const [allLeadsTotalCount, setAllLeadsTotalCount] = useState<number | null>(null)

  // Kanban pagination state for leads
  const [kanbanPagination, setKanbanPagination] = useState<Record<string, { page: number; hasMore: boolean; isLoading: boolean }>>({
    new: { page: 1, hasMore: true, isLoading: false },
    contacted: { page: 1, hasMore: true, isLoading: false },
    qualified: { page: 1, hasMore: true, isLoading: false },
    converted: { page: 1, hasMore: true, isLoading: false },
    lost: { page: 1, hasMore: true, isLoading: false }
  })

  // Total counts for each status from the database
  const [totalCounts, setTotalCounts] = useState<Record<string, number>>({
    new: 0,
    contacted: 0,
    qualified: 0,
    converted: 0,
    lost: 0
  })
  
  // Get unique assignee IDs from leads
  const assigneeIds = useMemo(() => {
    const ids = dbLeads.map(lead => lead.assignee_id).filter(Boolean) as string[]
    return Array.from(new Set(ids))
  }, [dbLeads])
  
  // Fetch user data for assignees
  const { userData } = useUserData(assigneeIds)
  
  // Función para invalidar cache y forzar recarga
  const invalidateJourneyStageCache = (leadId: string) => {
    delete leadJourneyStagesCache[leadId]
    setForceReload(prev => prev + 1)
  }
  
  // Initialize command+k hook
  useCommandK()
  
  // Función para cargar leads desde la base de datos
  const loadLeads = async () => {
    if (!currentSite?.id) return

    setLoading(true)
    try {
      const result = await getLeads(currentSite.id)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Asegurarse de que todos los leads tienen todos los campos de la interfaz Lead
      const normalizedLeads = result.leads?.map((lead: any) => ({
        ...lead,
        origin: lead.origin || null,
        personal_email: lead.personal_email || null
      })) || []
      
      setDbLeads(normalizedLeads)
      setSearchTotalCount(null)

      // Fetch exact total count for table view (non-search)
      try {
        const supabase = createClient()
        const { count, error } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', currentSite.id)
        if (error) {
          console.error('Error fetching total leads count:', error)
          setAllLeadsTotalCount(null)
        } else {
          setAllLeadsTotalCount(count || 0)
        }
      } catch (err) {
        console.error('Error in total leads count:', err)
        setAllLeadsTotalCount(null)
      }

      // Load total counts for kanban view
      if (viewType === 'kanban') {
        await loadTotalCounts()
      }
    } catch (error) {
      console.error("Error loading leads:", error)
      toast.error("Error loading leads")
    } finally {
      setLoading(false)
    }
  }

  // Cloud search (debounced) to query the full dataset on Supabase
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null
    let cancelled = false

    const run = async () => {
      if (!currentSite?.id) return

      const q = (searchQuery || "").trim()
      if (q === "") {
        // If query cleared, restore full dataset
        await loadLeads()
        return
      }

      setLoading(true)
      try {
        // Fetch page worth of data and exact count
        const result = await searchLeadsWithCount(currentSite.id, q, 200, 0)
        if (cancelled) return
        if (result.error) {
          toast.error(result.error)
          setDbLeads([])
          setSearchTotalCount(0)
          return
        }
        setDbLeads(result.leads || [])
        setSearchTotalCount(result.totalCount || 0)
      } catch (error) {
        if (!cancelled) {
          console.error("Error searching leads:", error)
          toast.error("Error searching leads")
          setDbLeads([])
          setSearchTotalCount(0)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    // Debounce to reduce requests while typing
    if (searchQuery !== undefined) {
      timeoutId = setTimeout(run, 350)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      cancelled = true
    }
  }, [searchQuery, currentSite?.id])

  // Function to load total counts for kanban view
  const loadTotalCounts = React.useCallback(async () => {
    if (!currentSite?.id) return

    try {
      const supabase = createClient()
      const statuses = ['new', 'contacted', 'qualified', 'converted', 'lost']
      const counts: Record<string, number> = {}

      // Fetch count for each status
      for (const status of statuses) {
        const { count, error } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', currentSite.id)
          .eq('status', status)

        if (error) {
          console.error(`Error fetching count for ${status}:`, error)
          counts[status] = 0
        } else {
          counts[status] = count || 0
        }
      }

      setTotalCounts(counts)

      // Set kanban pagination state based on total counts
      setKanbanPagination({
        new: { page: 1, hasMore: counts.new > 50, isLoading: false },
        contacted: { page: 1, hasMore: counts.contacted > 50, isLoading: false },
        qualified: { page: 1, hasMore: counts.qualified > 50, isLoading: false },
        converted: { page: 1, hasMore: counts.converted > 50, isLoading: false },
        lost: { page: 1, hasMore: counts.lost > 50, isLoading: false }
      })
    } catch (error) {
      console.error("Error loading total counts:", error)
    }
  }, [currentSite?.id])

  // Handle load more for kanban columns
  const handleLoadMoreKanban = async (status: string) => {
    const currentPagination = kanbanPagination[status]
    if (currentPagination.isLoading || !currentPagination.hasMore) return

    if (!currentSite) return

    // Set loading state
    setKanbanPagination(prev => ({
      ...prev,
      [status]: { ...prev[status], isLoading: true }
    }))

    try {
      const supabase = createClient()
      const itemsPerPage = 50
      const offset = currentPagination.page * itemsPerPage

      // Fetch more leads for this specific status
      const { data: moreLeads, error } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          email,
          personal_email,
          phone,
          company,
          company_id,
          position,
          segment_id,
          campaign_id,
          status,
          notes,
          origin,
          created_at,
          updated_at,
          last_contact,
          site_id,
          user_id,
          birthday,
          language,
          social_networks,
          address,
          attribution,
          assignee_id,
          companies(name)
        `)
        .eq('site_id', currentSite.id)
        .eq('status', status)
        .order('created_at', { ascending: false })
        .range(offset, offset + itemsPerPage - 1)

      if (error) throw error

      // Normalize new leads
      const normalizedMoreLeads = moreLeads.map((lead: any) => ({
        ...lead,
        origin: lead.origin || null,
        personal_email: lead.personal_email || null
      }))

      // Add new leads to the existing leads array
      setDbLeads(prevLeads => {
        // Remove any existing leads with the same IDs to avoid duplicates
        const existingLeadIds = new Set(prevLeads.map((l: Lead) => l.id))
        const newLeads = normalizedMoreLeads.filter((l: any) => !existingLeadIds.has(l.id))
        return [...prevLeads, ...newLeads]
      })

      // Update pagination state
      setKanbanPagination(prev => ({
        ...prev,
        [status]: { 
          ...prev[status], 
          page: prev[status].page + 1,
          isLoading: false,
          hasMore: moreLeads.length === itemsPerPage
        }
      }))

    } catch (error) {
      console.error('Error loading more leads:', error)
      toast.error("Failed to load more leads")
      setKanbanPagination(prev => ({
        ...prev,
        [status]: { ...prev[status], isLoading: false }
      }))
    }
  }

  // Load total counts when switching to kanban view
  useEffect(() => {
    if (viewType === 'kanban' && !loading) {
      loadTotalCounts()
    }
  }, [viewType, loading, loadTotalCounts])

  // Cargar leads y datos relacionados
  useEffect(() => {
    async function loadSegments() {
      if (!currentSite?.id) return
      
      try {
        const response = await getSegments(currentSite.id)
        if (response.error) {
          console.error(response.error)
          return
        }
        
        if (response.segments) {
          setSegments(response.segments.map(s => ({ id: s.id, name: s.name })))
        }
      } catch (error) {
        console.error("Error loading segments:", error)
      }
    }
    
    async function loadCampaigns() {
      if (!currentSite?.id) return
      
      try {
        const result = await getCampaigns(currentSite.id)
        
        if (result.error) {
          console.error(result.error)
          return
        }
        
        setCampaigns(result.data || [])
      } catch (error) {
        console.error("Error loading campaigns:", error)
      }
    }

    loadLeads()
    loadSegments()
    loadCampaigns()
    
    // Invalidar cache de journey stages cuando se carga un nuevo site
    if (currentSite?.id) {
      setForceReload(prev => prev + 1)
    }
  }, [currentSite])
  
  // Cargar etapas del journey para cada lead
  useEffect(() => {
    const fetchJourneyStagesForLeads = async () => {
      if (!currentSite?.id || dbLeads.length === 0) {
        setIsLoadingJourneyStages(false)
        return
      }
      
      // Verificar si todos los leads ya están en cache
      const leadIds = dbLeads.map(lead => lead.id)
      const allLeadsInCache = leadIds.every(id => leadJourneyStagesCache[id])
      
      if (allLeadsInCache && forceReload === 0) {
        // Si todos están en cache, usar los valores cacheados sin mostrar loading
        const stages: Record<string, string> = {}
        dbLeads.forEach(lead => {
          stages[lead.id] = leadJourneyStagesCache[lead.id]
        })
        setLeadJourneyStages(stages)
        setIsLoadingJourneyStages(false)
        return
      }
      
      // Solo mostrar loading si realmente necesitamos hacer la consulta
      const uncachedLeads = dbLeads.filter(lead => !leadJourneyStagesCache[lead.id])
      
      if (uncachedLeads.length === 0 && forceReload === 0) {
        setIsLoadingJourneyStages(false)
        return
      }
      
      setIsLoadingJourneyStages(true)
      const stages: Record<string, string> = {}
      
      // Primero, llenar con datos del cache
      dbLeads.forEach(lead => {
        if (leadJourneyStagesCache[lead.id]) {
          stages[lead.id] = leadJourneyStagesCache[lead.id]
        }
      })
      
      try {
        // Solo consultar para leads que no están en cache
        const supabase = createClient()
        const uncachedLeadIds = uncachedLeads.map(lead => lead.id)
        
        // If no uncached leads, skip the query
        if (uncachedLeadIds.length === 0) {
          setLeadJourneyStages(stages)
          setIsLoadingJourneyStages(false)
          return
        }
        
        // Debug info before query
        console.log('🔍 Journey stages query params:', {
          uncachedLeadIds,
          siteId: currentSite.id,
          leadCount: uncachedLeadIds.length
        })

        // Try a simpler query first to test connection
        let allTasks = null
        let error = null

        try {
          // First, test if we can access the tasks table at all
          const testQuery = await supabase
            .from('tasks')
            .select('id')
            .eq('site_id', currentSite.id)
            .limit(1)

          if (testQuery.error) {
            console.error('Cannot access tasks table:', testQuery.error)
            throw new Error(`Tasks table access denied: ${testQuery.error.message}`)
          }

          // If test passes, do the full query
          const fullQuery = await supabase
            .from('tasks')
            .select('lead_id, stage, status, created_at, title, type')
            .in('lead_id', uncachedLeadIds)
            .in('status', ['completed', 'in_progress'])
            .eq('site_id', currentSite.id)

          allTasks = fullQuery.data
          error = fullQuery.error

        } catch (queryError) {
          error = queryError
          console.error('Query execution failed:', queryError)
        }

        console.log('🔍 Journey stages query result:', { 
          dataCount: allTasks?.length,
          hasError: !!error,
          errorType: typeof error
        })
        
        if (error) {
          console.warn('⚠️ Journey stages fetch failed, using fallback. Error details:', {
            error,
            message: error?.message || 'Unknown error',
            code: error?.code || 'Unknown code',
            details: error?.details || 'No details',
            hint: error?.hint || 'No hint',
            uncachedLeadIds,
            siteId: currentSite.id
          })
          
          // Set default stage for uncached leads (fallback behavior)
          uncachedLeads.forEach(lead => {
            stages[lead.id] = "not_contacted"
            leadJourneyStagesCache[lead.id] = "not_contacted"
          })
          
          // Don't throw or stop execution, just continue with defaults
        } else {
          // Procesar las tasks para encontrar la etapa más alta por lead
          const stageOrder = ["referral", "retention", "purchase", "decision", "consideration", "awareness"]
          
          // Agrupar tasks por lead_id
          const tasksByLead = allTasks?.reduce((acc: Record<string, any[]>, task: any) => {
            if (!acc[task.lead_id]) acc[task.lead_id] = []
            acc[task.lead_id].push(task)
            return acc
          }, {} as Record<string, any[]>) || {}
          
          // Procesar solo leads no cacheados
          uncachedLeads.forEach(lead => {
            const leadTasks = tasksByLead[lead.id] || []
            
            if (leadTasks.length === 0) {
              stages[lead.id] = "not_contacted"
            } else {
              // Encontrar la etapa más alta
              const highestStage = leadTasks
                .sort((a: any, b: any) => {
                  const aIndex = stageOrder.indexOf(a.stage)
                  const bIndex = stageOrder.indexOf(b.stage)
                  return aIndex - bIndex
                })[0]?.stage || "not_contacted"
              
              stages[lead.id] = highestStage
            }
            
            // Cachear el resultado
            leadJourneyStagesCache[lead.id] = stages[lead.id]
          })
        }
      } catch (error) {
        console.warn('⚠️ Journey stages processing failed, using fallback:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          type: typeof error,
          uncachedLeadsCount: uncachedLeads.length,
          siteId: currentSite.id
        })
        // Set default stage for uncached leads
        uncachedLeads.forEach(lead => {
          stages[lead.id] = "not_contacted"
          leadJourneyStagesCache[lead.id] = "not_contacted"
        })
      }
      
      setLeadJourneyStages(stages)
      setIsLoadingJourneyStages(false)
      
      // Limpiar leads que ya no están siendo recargados
      setReloadingLeads(prev => {
        const newSet = new Set(prev)
        Object.keys(stages).forEach(leadId => {
          if (stages[leadId]) {
            newSet.delete(leadId)
          }
        })
        return newSet
      })
    }
    
    fetchJourneyStagesForLeads()
  }, [dbLeads, currentSite?.id, forceReload])
  
  // Función para obtener leads filtrados
  const getFilteredLeads = (status: string) => {
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
    
    // Sort by created_at descending (newest first - más nuevo al más viejo)
    filtered = filtered.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime()
      const dateB = new Date(b.created_at).getTime()
      return dateB - dateA
    })
    
    return filtered
  }
  
  const filteredLeads = getFilteredLeads(activeTab)
  
  // Agrupar leads por empresa
  const companyGroups = useMemo(() => {
    const groups = groupLeadsByCompany(filteredLeads || [], leadJourneyStages || {}, expandedCompanies || {})
    
    // Log what companies are being shown on the page
    console.log(`📊 Page: Showing ${groups.length} companies for tab "${activeTab}"`)
    groups.forEach((group, index) => {
      console.log(`📊 Page Company ${index + 1}: "${group.companyName}" (${group.leadCount} leads, stage: ${group.mostAdvancedStage})`)
    })
    
    return groups
  }, [filteredLeads, leadJourneyStages, expandedCompanies, activeTab])
  
  const totalPages = Math.ceil((companyGroups?.length || 0) / itemsPerPage)
  
  // Funciones para cambiar de página
  function handlePageChange(page: number) {
    setCurrentPage(page)
  }

  // Reset página cuando cambia el tab
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  // Función para cambiar items por página
  function handleItemsPerPageChange(value: string) {
    setItemsPerPage(Number(value))
    setCurrentPage(1)
  }
  
  // Función para manejar la expansión/colapso de empresas
  const handleToggleCompanyExpansion = (companyKey: string) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyKey]: !prev[companyKey]
    }))
  }
  
  // Función para crear un nuevo lead
  const handleCreateLead = async (data: any) => {
    try {
      const result = await createLead({
        name: data.name,
        email: data.email,
        personal_email: data.personal_email,
        phone: data.phone,
        company: data.company,
        position: data.position,
        segment_id: data.segment_id,
        status: data.status,
        notes: data.notes,
        origin: data.origin,
        site_id: currentSite?.id || ""
      })

      if (result.error) {
        toast.error(result.error)
        return { error: result.error }
      }

      toast.success("Lead created successfully")
      
      // Recargar los leads
      safeReload(false, 'New lead created')
      
      return { lead: result.lead }
    } catch (error) {
      console.error("Error creating lead:", error)
      toast.error("Error creating lead")
      return { error: "Error creating lead" }
    }
  }

  // Función para actualizar un lead localmente
  const handleUpdateLead = (leadId: string, updates: Partial<Lead> & { invalidated?: boolean }) => {
    // Si el lead fue invalidado, removerlo completamente del estado
    if (updates.invalidated) {
      setDbLeads(prevLeads => prevLeads.filter(lead => lead.id !== leadId))
      return
    }
    
    setDbLeads(prevLeads => 
      prevLeads.map(lead => 
        lead.id === leadId 
          ? { ...lead, ...updates }
          : lead
      )
    )
  }

  // Función para eliminar un lead
  const handleDeleteLead = async (leadId: string) => {
    try {
      const result = await deleteLead(leadId)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Remover el lead del estado local
      setDbLeads(prevLeads => prevLeads.filter(lead => lead.id !== leadId))
      
      toast.success("Lead deleted successfully")
    } catch (error) {
      console.error("Error deleting lead:", error)
      toast.error("Error deleting lead")
    }
  }

  // Función para manejar cambios en el buscador
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1)
  }

  // Helper function to normalize company field to match UpdateLeadSchema requirements
  // Returns the normalized company or undefined if it should be omitted from the update
  const normalizeCompanyField = (lead: Lead): string | { name?: string; website?: string; industry?: string; size?: string; annual_revenue?: string; founded?: string; description?: string; address?: { street?: string; city?: string; state?: string; zipcode?: string; country?: string } } | null | undefined => {
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
      // Schema allows: name, website, industry, size, annual_revenue, founded, description, address
      // We only include fields that have valid string values (not null, not empty)
      const validFields = ['name', 'website', 'industry', 'size', 'annual_revenue', 'founded', 'description']
      
      for (const field of validFields) {
        const value = companyValue[field]
        // Only include if it's a non-empty string
        if (typeof value === 'string' && value.trim() !== '') {
          normalized[field] = value.trim()
        }
        // Explicitly skip null, undefined, empty strings, and any other types
      }
      
      console.log('🔍 normalizeCompanyField - Normalization result:', {
        originalKeys: Object.keys(companyValue),
        normalizedKeys: Object.keys(normalized),
        normalizedObject: normalized,
        hasInvalidFields: Object.keys(companyValue).some(key => !validFields.includes(key) && key !== 'address')
      })
      
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

  // Función para actualizar el estado de un lead (para la vista Kanban)
  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    const lead = dbLeads.find(l => l.id === leadId)
    if (!lead) return
    
    // Si el nuevo status es "converted" o "lost", mostrar el modal de atribución
    if (newStatus === "converted" || newStatus === "lost") {
      setPendingStatusChange({
        leadId,
        leadName: lead.name,
        newStatus
      })
      setShowAttributionModal(true)
      return
    }

    // Para otros statuses, actualizar directamente
    await updateLeadDirectly(leadId, newStatus, lead)
  }

  const updateLeadDirectly = async (leadId: string, newStatus: string, lead: Lead, attribution?: AttributionData) => {
    try {
      const normalizedCompany = normalizeCompanyField(lead)
      
      console.log('🔍 updateLeadDirectly - Debug info:', {
        leadId,
        newStatus,
        originalCompany: lead.company,
        normalizedCompany,
        companyType: typeof normalizedCompany,
        isUndefined: normalizedCompany === undefined,
        hasCompanyId: !!lead.company_id,
        companiesRelation: lead.companies
      })
      
      const updateData: any = {
        id: leadId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        position: lead.position,
        segment_id: lead.segment_id,
        status: newStatus as any,
        origin: lead.origin,
        site_id: currentSite?.id || "",
        ...(lead.attribution && !attribution && { attribution: lead.attribution })
      }

      // Only include company field if it's not undefined (undefined means we should omit it)
      if (normalizedCompany !== undefined) {
        updateData.company = normalizedCompany
      }

      if (attribution) {
        updateData.attribution = attribution
      }

      console.log('🔍 updateLeadDirectly - Sending updateData:', {
        ...updateData,
        company: updateData.company,
        companyStringified: JSON.stringify(updateData.company),
        hasCompanyField: 'company' in updateData,
        companyKeys: updateData.company && typeof updateData.company === 'object' ? Object.keys(updateData.company) : 'N/A'
      })

      const result = await updateLead(updateData)
      
      console.log('🔍 updateLeadDirectly - Result:', result)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Actualizamos el lead en el estado local
      setDbLeads(prevLeads => 
        prevLeads.map(l => 
          l.id === leadId ? { 
            ...l, 
            status: newStatus as any,
            ...(attribution && { attribution })
          } : l
        )
      );
      
      toast.success("Lead updated successfully")
    } catch (error) {
      console.error("Error updating lead status:", error)
      toast.error("Error updating lead status")
    }
  }

  const handleAttributionConfirm = async (attribution: AttributionData) => {
    if (!pendingStatusChange) return

    const lead = dbLeads.find(l => l.id === pendingStatusChange.leadId)
    if (!lead) return

    await updateLeadDirectly(
      pendingStatusChange.leadId, 
      pendingStatusChange.newStatus, 
      lead,
      attribution
    )

    setPendingStatusChange(null)
    setShowAttributionModal(false)
  }

  const handleAttributionCancel = () => {
    setPendingStatusChange(null)
    setShowAttributionModal(false)
  }

  // Función para manejar el clic en una fila o tarjeta
  const handleLeadClick = (lead: Lead) => {
    router.push(`/leads/${lead.id}`);
  };

  // Función para aplicar filtros
  const handleApplyFilters = (newFilters: LeadFilters) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }
  
  // Función para limpiar todos los filtros
  const handleClearFilters = () => {
    setFilters({
      status: [],
      segments: [],
      origin: [],
      journeyStages: []
    })
    setSearchQuery("")
    setCurrentPage(1)
  }
  
  // Función para abrir el modal de filtros
  const handleOpenFilterModal = () => {
    setIsFilterModalOpen(true)
  }
  
  return (
    <LeadsContext.Provider value={{ segments }}>
    <div className="flex-1 p-0">
      {/* Attribution Modal */}
      {pendingStatusChange && (pendingStatusChange.newStatus === "converted" || pendingStatusChange.newStatus === "lost") && (
        <AttributionModal
          isOpen={showAttributionModal}
          onOpenChange={setShowAttributionModal}
          leadName={pendingStatusChange.leadName}
          statusType={pendingStatusChange.newStatus as "converted" | "lost"}
          onConfirm={handleAttributionConfirm}
          onCancel={handleAttributionCancel}
        />
      )}
      
      {/* Modal de filtros */}
      <LeadFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        segments={segments}
      />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full space-y-6">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="all" className="text-sm font-medium">All Companies</TabsTrigger>
                  <TabsTrigger value="new" className="text-sm font-medium">New</TabsTrigger>
                  <TabsTrigger value="contacted" className="text-sm font-medium">Contacted</TabsTrigger>
                  <TabsTrigger value="qualified" className="text-sm font-medium">Qualified</TabsTrigger>
                  <TabsTrigger value="converted" className="text-sm font-medium">Converted</TabsTrigger>
                  <TabsTrigger value="lost" className="text-sm font-medium">Lost</TabsTrigger>
                </TabsList>
                <div className="relative w-64">
                  <Input 
                    data-command-k-input
                    placeholder="search" 
                    className="w-full" 
                    icon={<Search className="h-4 w-4 text-muted-foreground" />}
                    value={searchQuery}
                    onChange={handleSearchChange}
                  />
                  <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </div>
                <Button variant="secondary" className="h-9" onClick={handleOpenFilterModal}>
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
              <div className="ml-auto flex items-center gap-4">
                {(filters.status.length > 0 || filters.segments.length > 0 || filters.origin.length > 0) && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    <Badge variant="outline" className="rounded-full px-2 py-0">
                      {filters.status.length + filters.segments.length + filters.origin.length}
                    </Badge>
                    <span className="ml-2">Clear</span>
                  </Button>
                )}
                <ViewSelector currentView={viewType} onViewChange={setViewType} />
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            {loading ? (
              <LeadsTableSkeleton />
            ) : (
              <>
                {["all", "new", "contacted", "qualified", "converted", "lost"].map(tabValue => (
                  <TabsContent key={tabValue} value={tabValue} className="space-y-4">
                  {viewType === "table" ? (
                      <GroupedLeadsTable
                        companyGroups={companyGroups}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={searchTotalCount ?? allLeadsTotalCount ?? filteredLeads.length}
                        totalCompanies={companyGroups.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                      forceReload={forceReload}
                      invalidateJourneyStageCache={invalidateJourneyStageCache}
                      onUpdateLead={handleUpdateLead}
                      onDeleteLead={handleDeleteLead}
                      userData={userData}
                        onToggleCompanyExpansion={handleToggleCompanyExpansion}
                      segments={segments}
                        leadJourneyStages={leadJourneyStages}
                        isLoadingJourneyStages={isLoadingJourneyStages}
                        reloadingLeads={reloadingLeads}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                      onUpdateLead={handleUpdateLead}
                      userData={userData}
                      kanbanPagination={kanbanPagination}
                      onLoadMore={handleLoadMoreKanban}
                      totalCounts={totalCounts}
                    />
                  )}
                </TabsContent>
                ))}
              </>
            )}
          </div>
        </div>
      </Tabs>
      
    </div>
    </LeadsContext.Provider>
  )
} 