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
import { getLeads, createLead, updateLead } from "./actions"
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu"
import { MoreHorizontal, Eye, Trash2 } from "@/app/components/ui/icons"
import { createClient } from "@/utils/supabase/client"
import { AttributionModal } from "@/app/leads/components/AttributionModal"
import { safeReload } from "@/app/utils/safe-reload"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"

// Cache de etapas para cada lead
const leadJourneyStagesCache: Record<string, string> = {};

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

// Obtener el nombre legible de una etapa
const getJourneyStageName = (stageId: string) => {
  if (stageId === "not_contacted") return "Unaware"
  return JOURNEY_STAGES.find(stage => stage.id === stageId)?.label || "Unknown"
}

interface LeadsTableProps {
  leads: Lead[]
  currentPage: number
  itemsPerPage: number
  totalLeads: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onLeadClick: (lead: Lead) => void
}

function LeadsTable({ 
  leads,
  currentPage,
  itemsPerPage,
  totalLeads,
  onPageChange,
  onItemsPerPageChange,
  onLeadClick
}: LeadsTableProps) {
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalLeads / itemsPerPage)
  const { segments } = useLeadsContext()
  const { currentSite } = useSite()
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [leadJourneyStages, setLeadJourneyStages] = useState<Record<string, string>>({})
  const [isLoadingJourneyStages, setIsLoadingJourneyStages] = useState(false) // Iniciamos en false y solo activamos cuando sea necesario
  const [loadingActions, setLoadingActions] = useState<Record<string, 'research' | 'followup' | null>>({})
  const [successActions, setSuccessActions] = useState<Record<string, 'research' | 'followup' | null>>({})
  
  // Crear una key estable basada en los IDs de los leads para evitar re-renders innecesarios
  const leadsKey = useMemo(() => {
    return leads.map(lead => lead.id).sort().join(',')
  }, [leads])
  
  // Cargar etapas del journey para cada lead
  useEffect(() => {
    const fetchJourneyStagesForLeads = async () => {
      if (!currentSite?.id || leads.length === 0) {
        setIsLoadingJourneyStages(false)
        return
      }
      
      // Verificar si todos los leads ya están en cache
      const leadIds = leads.map(lead => lead.id)
      const allLeadsInCache = leadIds.every(id => leadJourneyStagesCache[id])
      
      if (allLeadsInCache) {
        // Si todos están en cache, usar los valores cacheados sin mostrar loading
        const stages: Record<string, string> = {}
        leads.forEach(lead => {
          stages[lead.id] = leadJourneyStagesCache[lead.id]
        })
        setLeadJourneyStages(stages)
        setIsLoadingJourneyStages(false)
        return
      }
      
      // Solo mostrar loading si realmente necesitamos hacer la consulta
      const uncachedLeads = leads.filter(lead => !leadJourneyStagesCache[lead.id])
      if (uncachedLeads.length === 0) {
        setIsLoadingJourneyStages(false)
        return
      }
      
      setIsLoadingJourneyStages(true)
      const stages: Record<string, string> = {}
      
      // Primero, llenar con datos del cache
      leads.forEach(lead => {
        if (leadJourneyStagesCache[lead.id]) {
          stages[lead.id] = leadJourneyStagesCache[lead.id]
        }
      })
      
      try {
        // Solo consultar para leads que no están en cache
        const supabase = createClient()
        const uncachedLeadIds = uncachedLeads.map(lead => lead.id)
        
        // Obtener todas las tasks completadas solo de leads no cacheados
        const { data: allTasks, error } = await supabase
          .from('tasks')
          .select('lead_id, stage, status')
          .in('lead_id', uncachedLeadIds)
          .eq('status', 'completed')
          .eq('site_id', currentSite.id)
        
        if (error) {
          console.error('Error fetching tasks:', error)
          // Set default stage for uncached leads
          uncachedLeads.forEach(lead => {
            stages[lead.id] = "not_contacted"
            leadJourneyStagesCache[lead.id] = "not_contacted"
          })
        } else {
          // Procesar las tasks para encontrar la etapa más alta por lead
          const stageOrder = ["referral", "retention", "purchase", "decision", "consideration", "awareness"]
          
          // Agrupar tasks por lead_id
          const tasksByLead = allTasks?.reduce((acc, task) => {
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
                .sort((a, b) => {
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
        console.error('Error in fetchJourneyStagesForLeads:', error)
        // Set default stage for uncached leads
        uncachedLeads.forEach(lead => {
          stages[lead.id] = "not_contacted"
          leadJourneyStagesCache[lead.id] = "not_contacted"
        })
      }
      
      setLeadJourneyStages(stages)
      setIsLoadingJourneyStages(false)
    }
    
    fetchJourneyStagesForLeads()
  }, [leadsKey, currentSite?.id]) // Usar leadsKey en lugar de leads para evitar re-renders innecesarios
  
  // Función para llamar API de research
  const handleLeadResearch = async (leadId: string) => {
    setLoadingActions(prev => ({ ...prev, [leadId]: 'research' }))
    
    try {
      // Use the same pattern as leadFollowUp - call external API server
      const { apiClient } = await import('@/app/services/api-client-service')
      
      const response = await apiClient.post('/api/workflow/leadResearch', {
        lead_id: leadId,
        user_id: currentSite?.user_id,
        site_id: currentSite?.id
      })
      
      if (response.success) {
        setSuccessActions(prev => ({ ...prev, [leadId]: 'research' }))
        setTimeout(() => {
          setSuccessActions(prev => ({ ...prev, [leadId]: null }))
        }, 2000)
        toast.success("Lead research initiated successfully")
      } else {
        throw new Error(response.error?.message || 'Failed to initiate lead research')
      }
    } catch (error) {
      console.error('Error calling lead research API:', error)
      toast.error("Failed to initiate lead research")
    } finally {
      setLoadingActions(prev => ({ ...prev, [leadId]: null }))
    }
  }

  // Función para llamar API de follow up
  const handleLeadFollowUp = async (leadId: string) => {
    setLoadingActions(prev => ({ ...prev, [leadId]: 'followup' }))
    
    try {
      // Use the same pattern as leadFollowUp - call external API server
      const { apiClient } = await import('@/app/services/api-client-service')
      
      const response = await apiClient.post('/api/workflow/leadFollowUp', {
        lead_id: leadId,
        user_id: currentSite?.user_id,
        site_id: currentSite?.id
      })
      
      if (response.success) {
        setSuccessActions(prev => ({ ...prev, [leadId]: 'followup' }))
        setTimeout(() => {
          setSuccessActions(prev => ({ ...prev, [leadId]: null }))
        }, 2000)
        toast.success("Lead follow-up initiated successfully")
      } else {
        throw new Error(response.error?.message || 'Failed to initiate lead follow-up')
      }
    } catch (error) {
      console.error('Error calling lead follow-up API:', error)
      toast.error("Failed to initiate lead follow-up")
    } finally {
      setLoadingActions(prev => ({ ...prev, [leadId]: null }))
    }
  }
  
  // Debug logs
  console.log('Leads:', leads)
  console.log('Segments:', segments)
  console.log('Journey Stages:', leadJourneyStages)
  
  // Función para obtener el nombre del segmento
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
    if (!segments || !Array.isArray(segments)) return "Unknown Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || "Unknown Segment"
  }

  // Función para truncar texto largo
  const truncateText = (text: any, maxLength: number = 15) => {
    if (!text) return "-"
    if (typeof text === 'object') {
      if (text.name) return String(text.name)
      return "-"
    }
    const stringValue = String(text)
    if (stringValue.length <= maxLength) return stringValue
    return `${stringValue.substring(0, maxLength)}...`
  }

  const statusStyles = {
    new: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
    contacted: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200", 
    qualified: "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200",
    converted: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
    lost: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
  }
  
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Name</TableHead>
            <TableHead className="w-[150px]">Company</TableHead>
            <TableHead className="w-[120px]">Segment</TableHead>
            <TableHead className="w-[100px]">Status</TableHead>
            <TableHead className="w-[120px]">Journey Stage</TableHead>
            <TableHead className="text-right w-[100px]">AI Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {leads.length > 0 ? (
              leads.map((lead) => {
                // Debug log for each lead
                console.log('Rendering lead:', lead)
                return (
                  <TableRow 
                    key={lead.id}
                    className={`group hover:bg-muted/50 transition-colors cursor-pointer ${selectedLead?.id === lead.id ? 'bg-primary/10 hover:bg-primary/15' : ''}`}
                    onClick={() => onLeadClick(lead)}
                  >
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium text-sm">{String(lead.name || '')}</p>
                        <p className="text-xs text-muted-foreground">{String(lead.email || '')}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {truncateText(lead.company)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {truncateText(getSegmentName(lead.segment_id))}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusStyles[lead.status]}`}>
                        {String(lead.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {isLoadingJourneyStages ? (
                        <Skeleton className="h-5 w-16 rounded-full" />
                      ) : (
                        <Badge className={`${JOURNEY_STAGE_COLORS[leadJourneyStages[lead.id] || 'not_contacted']}`}>
                          {getJourneyStageName(leadJourneyStages[lead.id] || 'not_contacted')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={loadingActions[lead.id] === 'research'}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleLeadResearch(lead.id)
                                }}
                                className={`${successActions[lead.id] === 'research' ? 'bg-green-100 text-green-700' : ''}`}
                              >
                                {loadingActions[lead.id] === 'research' ? (
                                  <Loader className="h-4 w-4" />
                                ) : successActions[lead.id] === 'research' ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <Search className="h-4 w-4" />
                                )}
                                <span className="sr-only">Lead Research</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Research lead</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={loadingActions[lead.id] === 'followup'}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleLeadFollowUp(lead.id)
                                }}
                                className={`${successActions[lead.id] === 'followup' ? 'bg-green-100 text-green-700' : ''}`}
                              >
                                {loadingActions[lead.id] === 'followup' ? (
                                  <Loader className="h-4 w-4" />
                                ) : successActions[lead.id] === 'followup' ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <Mail className="h-4 w-4" />
                                )}
                                <span className="sr-only">Lead Follow Up</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Intelligent follow-up</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <EmptyCard
                    icon={<Users className="h-16 w-16 text-muted-foreground" />}
                    title="No leads found"
                    description="There are no leads to display."
                  />
                </TableCell>
              </TableRow>
            )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{Math.min(indexOfFirstItem + 1, totalLeads)}</span> to <span className="font-medium">{Math.min(indexOfFirstItem + itemsPerPage, totalLeads)}</span> of <span className="font-medium">{totalLeads}</span> leads
          </p>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={onItemsPerPageChange}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={itemsPerPage.toString()} />
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 20, 50].map((value) => (
                <SelectItem key={value} value={value.toString()}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(page)}
                className={`!min-w-0 h-8 w-8 p-0 font-medium transition-colors ${
                  currentPage === page 
                    ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {page}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
            className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    </Card>
  )
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
            <TableHead className="w-[200px]">
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead className="w-[150px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[120px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[100px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[120px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="text-right w-[100px]">
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
                  <Skeleton className="h-3 w-48" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
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
    origin: []
  })
  const { currentSite } = useSite()
  const [showAttributionModal, setShowAttributionModal] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    leadId: string
    leadName: string
    newStatus: string
  } | null>(null)
  
  // Initialize command+k hook
  useCommandK()
  
  // Función para obtener el nombre del segmento
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
    if (!segments || !Array.isArray(segments)) return "Unknown Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || "Unknown Segment"
  }
  
  // Estilos para los diferentes estados
  const statusStyles = {
    new: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
    contacted: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200", 
    qualified: "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200",
    converted: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
    lost: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
  }
  
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
      const normalizedLeads = result.leads?.map(lead => ({
        ...lead,
        origin: lead.origin || null // Asegurarnos que origin esté definido
      })) || []
      
      setDbLeads(normalizedLeads)
    } catch (error) {
      console.error("Error loading leads:", error)
      toast.error("Error loading leads")
    } finally {
      setLoading(false)
    }
  }

  // Cargar leads desde la base de datos
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
  }, [currentSite])
  
  const getFilteredLeads = (status: string) => {
    if (!dbLeads) return []
    
    // First filter by status
    let filtered = dbLeads
    if (status !== "all") {
      filtered = filtered.filter(lead => lead.status === status)
    }
    
    // Then filter by search query if it exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(lead => 
        lead.name.toLowerCase().includes(query) || 
        lead.email.toLowerCase().includes(query) || 
        (lead.company && lead.company.toLowerCase().includes(query)) ||
        (lead.position && lead.position.toLowerCase().includes(query)) ||
        (lead.phone && lead.phone.toLowerCase().includes(query)) ||
        (lead.origin && lead.origin.toLowerCase().includes(query))
      )
    }
    
    // Apply advanced filters
    if (filters.status.length > 0) {
      filtered = filtered.filter(lead => filters.status.includes(lead.status))
    }
    
    if (filters.segments.length > 0) {
      filtered = filtered.filter(lead => 
        lead.segment_id && filters.segments.includes(lead.segment_id)
      )
    }
    
    if (filters.origin.length > 0) {
      filtered = filtered.filter(lead => 
        lead.origin && filters.origin.includes(lead.origin)
      )
    }
    
    return filtered
  }
  
  const filteredLeads = getFilteredLeads(activeTab)
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage)
  
  // Calcular los leads que se mostrarán en la página actual
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentLeads = filteredLeads.slice(indexOfFirstItem, indexOfLastItem)
  
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
  
  // Función para crear un nuevo lead
  const handleCreateLead = async (data: any) => {
    try {
      const result = await createLead({
        name: data.name,
        email: data.email,
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

  // Función para manejar cambios en el buscador
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1) // Reset a la primera página cuando se busca
  }

  // Función para actualizar el estado de un lead (para la vista Kanban)
  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    const lead = dbLeads.find(l => l.id === leadId)
    if (!lead) return
    
    // Si el nuevo status es "converted", mostrar el modal de atribución
    if (newStatus === "converted") {
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
      const updateData: any = {
        id: leadId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        position: lead.position,
        segment_id: lead.segment_id,
        status: newStatus as any,
        origin: lead.origin,
        site_id: currentSite?.id || "",
        // Preserve existing attribution data unless explicitly provided
        ...(lead.attribution && !attribution && { attribution: lead.attribution })
      }

      if (attribution) {
        updateData.attribution = attribution
      }

      const result = await updateLead(updateData)
      
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
    setCurrentPage(1) // Reset a la primera página cuando se aplican filtros
  }
  
  // Función para limpiar todos los filtros
  const handleClearFilters = () => {
    setFilters({
      status: [],
      segments: [],
      origin: []
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
      <AttributionModal
        isOpen={showAttributionModal}
        onOpenChange={setShowAttributionModal}
        leadName={pendingStatusChange?.leadName || ""}
        onConfirm={handleAttributionConfirm}
        onCancel={handleAttributionCancel}
      />
      
      {/* Modal de filtros */}
      <LeadFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        segments={segments}
      />
      
      <Tabs defaultValue={activeTab} className="h-full space-y-6">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="all" className="text-sm font-medium">All Leads</TabsTrigger>
                  <TabsTrigger value="new" className="text-sm font-medium">New</TabsTrigger>
                  <TabsTrigger value="contacted" className="text-sm font-medium">Contacted</TabsTrigger>
                  <TabsTrigger value="qualified" className="text-sm font-medium">Qualified</TabsTrigger>
                  <TabsTrigger value="converted" className="text-sm font-medium">Converted</TabsTrigger>
                  <TabsTrigger value="lost" className="text-sm font-medium">Lost</TabsTrigger>
                </TabsList>
                <div className="relative w-64">
                  <Input 
                    data-command-k-input
                    placeholder="Search leads..." 
                    className="w-full" 
                    icon={<Search className="h-4 w-4 text-muted-foreground" />}
                    value={searchQuery}
                    onChange={handleSearchChange}
                  />
                  <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </div>
                <Button variant="outline" onClick={handleOpenFilterModal}>
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </div>
              <div className="ml-auto flex items-center gap-4">
                {(filters.status.length > 0 || filters.segments.length > 0 || filters.origin.length > 0) && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    <Badge variant="outline" className="rounded-full px-2 py-0">
                      {filters.status.length + filters.segments.length + filters.origin.length}
                    </Badge>
                    <span className="ml-2">Clear filters</span>
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
                <TabsContent value="all" className="space-y-4">
                  {viewType === "table" ? (
                    <LeadsTable
                      leads={currentLeads}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={filteredLeads.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                    />
                  )}
                </TabsContent>
                
                <TabsContent value="new" className="space-y-4">
                  {viewType === "table" ? (
                    <LeadsTable
                      leads={currentLeads}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={filteredLeads.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                    />
                  )}
                </TabsContent>
                
                <TabsContent value="contacted" className="space-y-4">
                  {viewType === "table" ? (
                    <LeadsTable
                      leads={currentLeads}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={filteredLeads.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                    />
                  )}
                </TabsContent>
                
                <TabsContent value="qualified" className="space-y-4">
                  {viewType === "table" ? (
                    <LeadsTable
                      leads={currentLeads}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={filteredLeads.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                    />
                  )}
                </TabsContent>
                
                <TabsContent value="converted" className="space-y-4">
                  {viewType === "table" ? (
                    <LeadsTable
                      leads={currentLeads}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={filteredLeads.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                    />
                  )}
                </TabsContent>
                
                <TabsContent value="lost" className="space-y-4">
                  {viewType === "table" ? (
                    <LeadsTable
                      leads={currentLeads}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={filteredLeads.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                    />
                  )}
                </TabsContent>
              </>
            )}
          </div>
        </div>
      </Tabs>
      
    </div>
    </LeadsContext.Provider>
  )
} 