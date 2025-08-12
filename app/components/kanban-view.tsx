"use client"

import React, { useState, useEffect, useContext, useMemo } from "react"
import { useSite } from "@/app/context/SiteContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Plus, X, Filter, ClipboardList, Mail, Search, Loader, CheckCircle2 } from "@/app/components/ui/icons"
import { Button } from "./ui/button"
import { cn } from "@/lib/utils"
import { Input } from "./ui/input"
import { Segment } from "@/app/leads/types"
import { updateLead } from "@/app/leads/actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Lead } from "@/app/leads/types"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { EmptyState } from "@/app/components/ui/empty-state"
import { JOURNEY_STAGES } from "@/app/leads/types"
import { Skeleton } from "@/app/components/ui/skeleton"
import { createClient } from "@/utils/supabase/client"
import { apiClient } from "@/app/services/api-client-service"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { assignLeadToUser } from "@/app/leads/actions"
import { useAuth } from "@/app/hooks/use-auth"
import { Sparkles, User as UserIcon } from "@/app/components/ui/icons"

// Definimos los tipos de estado de los leads
const LEAD_STATUSES = [
  { id: 'new', name: 'New' },
  { id: 'contacted', name: 'Contacted' },
  { id: 'qualified', name: 'Qualified' },
  { id: 'converted', name: 'Converted' },
  { id: 'lost', name: 'Lost' }
]

// Colores para los diferentes estados
const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  contacted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  qualified: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  converted: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
}

// Colores para las etapas del journey
const JOURNEY_STAGE_COLORS: Record<string, string> = {
  awareness: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  consideration: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  decision: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  purchase: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  retention: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  referral: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  not_contacted: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
}

// Interface for filtered view
export interface LeadFilters {
  status: string[]
  segments: string[]
  origin: string[]
  journeyStages: string[]
  searchQuery?: string
}

interface KanbanPaginationState {
  page: number
  hasMore: boolean
  isLoading: boolean
}

interface KanbanViewProps {
  leads: Lead[]
  onUpdateLeadStatus: (leadId: string, newStatus: string) => Promise<void>
  segments: Array<{ id: string; name: string }>
  onLeadClick: (lead: Lead) => void
  filters?: LeadFilters
  onOpenFilters?: () => void
  onUpdateLead?: (leadId: string, updates: Partial<Lead>) => void // Add callback for lead updates
  userData?: Record<string, { name: string, avatar_url: string | null }>
  kanbanPagination?: Record<string, KanbanPaginationState>
  onLoadMore?: (status: string) => void
  totalCounts?: Record<string, number>
}

// Cache de etapas para cada lead
const leadJourneyStagesCache: Record<string, string> = {};

export function KanbanView({ 
  leads, 
  onUpdateLeadStatus, 
  segments, 
  onLeadClick,
  filters,
  onOpenFilters,
  onUpdateLead,
  userData,
  kanbanPagination = {},
  onLoadMore,
  totalCounts = {}
}: KanbanViewProps) {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const [leadJourneyStages, setLeadJourneyStages] = useState<Record<string, string>>({})
  const [isLoadingJourneyStages, setIsLoadingJourneyStages] = useState(false) // Iniciamos en false
  const [loadingActions, setLoadingActions] = useState<Record<string, 'research' | 'followup' | null>>({})
  const [successActions, setSuccessActions] = useState<Record<string, 'research' | 'followup' | null>>({})
  const [assigningLeads, setAssigningLeads] = useState<Record<string, boolean>>({})
  
  // Crear una key estable basada en los IDs de los leads para evitar re-renders innecesarios
  const leadsKey = useMemo(() => {
    return leads.map(lead => lead.id).sort().join(',')
  }, [leads])
  
  // Organizamos los leads por estado con paginación
  const getLeadsByStatus = () => {
    const leadsByStatus: Record<string, Lead[]> = {}
    
    // Inicializamos todas las columnas, incluso las vacías
    LEAD_STATUSES.forEach(status => {
      leadsByStatus[status.id] = []
    })
    
    // Agrupamos los leads por estado
    leads.forEach(lead => {
      if (leadsByStatus[lead.status]) {
        leadsByStatus[lead.status].push(lead)
      }
    })

    // Apply pagination: show up to 50 leads per column initially, then load more
    LEAD_STATUSES.forEach(status => {
      const pagination = kanbanPagination[status.id]
      if (pagination) {
        const itemsPerPage = 50
        const maxItems = pagination.page * itemsPerPage
        leadsByStatus[status.id] = leadsByStatus[status.id].slice(0, maxItems)
      }
    })
    
    return leadsByStatus
  }

  // Helper function to check if there are more leads to load for a status
  const hasMoreLeads = (statusId: string) => {
    const allStatusLeads = leads.filter(lead => lead.status === statusId)
    const pagination = kanbanPagination[statusId]
    if (!pagination) return false
    
    const itemsPerPage = 50
    const maxItems = pagination.page * itemsPerPage
    
    // Show load more if we have more leads than currently displayed or pagination indicates more available
    return allStatusLeads.length >= maxItems || pagination.hasMore
  }
  
  const [leadsByStatus, setLeadsByStatus] = useState(getLeadsByStatus())
  
  // Función para obtener el nombre del segmento
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || "Unknown Segment"
  }
  
  // Función para obtener el nombre de la compañía
  const getCompanyName = (lead: Lead) => {
    // Si existe companies (joined data), usar eso
    if (lead.companies && lead.companies.name) {
      return lead.companies.name
    }
    // Fallback al campo company existente
    if (lead.company && typeof lead.company === 'object' && lead.company.name) {
      return lead.company.name
    }
    if (typeof lead.company === 'string') {
      return lead.company
    }
    return null
  }
  
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
        
        // If no uncached leads, skip the query
        if (uncachedLeadIds.length === 0) {
          setLeadJourneyStages(stages)
          setIsLoadingJourneyStages(false)
          return
        }
        
        console.log('🔍 KanbanView: Journey stages query params:', {
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
            console.warn('KanbanView: Cannot access tasks table:', testQuery.error)
            throw new Error(`Tasks table access denied: ${testQuery.error.message}`)
          }

          // If test passes, do the full query
          const fullQuery = await supabase
            .from('tasks')
            .select('lead_id, stage, status')
            .in('lead_id', uncachedLeadIds)
            .eq('status', 'completed')
            .eq('site_id', currentSite.id)

          allTasks = fullQuery.data
          error = fullQuery.error

        } catch (queryError) {
          error = queryError
          console.warn('KanbanView: Query execution failed:', queryError)
        }

        console.log('🔍 KanbanView: Journey stages query result:', { 
          dataCount: allTasks?.length,
          hasError: !!error,
          errorType: typeof error
        })
        
        if (error) {
          console.warn('⚠️ KanbanView: Journey stages fetch failed, using fallback. Error details:', {
            error,
            message: (error as any)?.message || 'Unknown error',
            code: (error as any)?.code || 'Unknown code',
            details: (error as any)?.details || 'No details',
            hint: (error as any)?.hint || 'No hint',
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
        console.warn('⚠️ KanbanView: Journey stages processing failed, using fallback:', {
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
    }
    
    fetchJourneyStagesForLeads()
  }, [leadsKey, currentSite?.id]) // Usar leadsKey en lugar de leads
  
  // Obtener el nombre legible de una etapa
  const getJourneyStageName = (stageId: string) => {
    if (stageId === "not_contacted") return "Unaware"
    return JOURNEY_STAGES.find(stage => stage.id === stageId)?.label || "Unknown"
  }

  // Función para llamar API de research
  const handleLeadResearch = async (leadId: string) => {
    setLoadingActions(prev => ({ ...prev, [leadId]: 'research' }))
    
    try {
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

  // Función para asignar un lead al usuario actual
  const handleAssignLead = async (leadId: string) => {
    if (!user?.id || !currentSite?.id) {
      toast.error("User not authenticated or site not selected")
      return
    }

    setAssigningLeads(prev => ({ ...prev, [leadId]: true }))
    
    try {
      const result = await assignLeadToUser(leadId, user.id, currentSite.id)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      toast.success("Lead assigned successfully")
      
      // Actualizar el lead localmente para reflejar el cambio inmediatamente
      onUpdateLead?.(leadId, { assignee_id: user.id })
      
    } catch (error) {
      console.error('Error assigning lead:', error)
      toast.error("Failed to assign lead")
    } finally {
      setAssigningLeads(prev => ({ ...prev, [leadId]: false }))
    }
  }
  
  // Función para alternar asignación entre usuario actual y IA
  const handleToggleAssignee = async (leadId: string) => {
    if (!user?.id || !currentSite?.id) {
      toast.error("User not authenticated or site not selected")
      return
    }

    const lead = leads.find(l => l.id === leadId)
    if (!lead) return

    setAssigningLeads(prev => ({ ...prev, [leadId]: true }))
    
    try {
      // Si el lead está asignado a mí, asignar a IA (null)
      // Si no está asignado a mí, asignar a mí
      const newAssigneeId = lead.assignee_id === user.id ? null : user.id
      
      if (newAssigneeId === null) {
        // Asignar a IA usando updateLead
        const result = await updateLead({
          id: leadId,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          position: lead.position,
          segment_id: lead.segment_id,
          status: lead.status,
          origin: lead.origin,
          site_id: currentSite.id,
          assignee_id: null
        })
        
        if (result.error) {
          toast.error(result.error)
          return
        }
        
        toast.success("Lead assigned to AI Team")
      } else {
        // Asignar a usuario actual
        const result = await assignLeadToUser(leadId, user.id, currentSite.id)
        
        if (result.error) {
          toast.error(result.error)
          return
        }
        
        toast.success("Lead assigned to you")
      }
      
      // Actualizar el lead localmente
      onUpdateLead?.(leadId, { assignee_id: newAssigneeId })
      
    } catch (error) {
      console.error('Error toggling assignee:', error)
      toast.error("Failed to update assignee")
    } finally {
      setAssigningLeads(prev => ({ ...prev, [leadId]: false }))
    }
  }

  // Actualizamos los leads cuando cambia la prop leads
  React.useEffect(() => {
    setLeadsByStatus(getLeadsByStatus())
  }, [leads])
  
  // Manejador para cuando se completa un arrastre
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    
    // Si no hay destino o el destino es el mismo que el origen, no hacemos nada
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      return
    }
    
    // Obtenemos el lead que se está moviendo
    const lead = leads.find(l => l.id === draggableId)
    if (!lead) return
    
    // Actualizamos el estado localmente para una respuesta inmediata en la UI
    const newLeadsByStatus = {...leadsByStatus}
    
    // Removemos el lead de su columna actual
    newLeadsByStatus[source.droppableId] = newLeadsByStatus[source.droppableId].filter(
      l => l.id !== draggableId
    )
    
    // Creamos una copia del lead con el nuevo estado
    const updatedLead = {...lead, status: destination.droppableId as any}
    
    // Insertamos el lead en la nueva columna en la posición correcta
    newLeadsByStatus[destination.droppableId] = [
      ...newLeadsByStatus[destination.droppableId].slice(0, destination.index),
      updatedLead,
      ...newLeadsByStatus[destination.droppableId].slice(destination.index)
    ]
    
    // Actualizamos el estado local
    setLeadsByStatus(newLeadsByStatus)
    
    try {
      // Llamamos a la función para actualizar el estado en la base de datos
      await onUpdateLeadStatus(draggableId, destination.droppableId)
    } catch (error) {
      // Si hay un error, revertimos el cambio local
      toast.error("Error updating lead status")
      setLeadsByStatus(getLeadsByStatus())
    }
  }

  // Manejador para el clic en una tarjeta
  const handleCardClick = (e: React.MouseEvent, lead: Lead) => {
    // Evitamos que el clic se propague al draggable
    e.stopPropagation();
    onLeadClick(lead);
  }
  
  // Check if there are no leads at all
  const hasNoLeads = leads.length === 0
  
  return (
    <div className="w-full">
      {hasNoLeads ? (
        <EmptyState
          icon={<ClipboardList className="h-12 w-12 text-primary" />}
          title="No leads found"
          description="There are no leads matching your current filters or you haven't created any leads yet."
          hint="Try clearing your filters or create a new lead to get started."
        />
      ) : (
        <div className="overflow-x-auto pb-8">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="inline-flex gap-4 pb-4 min-h-[200px]">
              {LEAD_STATUSES.map(status => (
                <div key={status.id} className="flex flex-col h-full min-w-[260px] w-auto">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-medium text-sm">{status.name}</h3>
                    <Badge variant="outline">{totalCounts[status.id] !== undefined ? totalCounts[status.id] : leadsByStatus[status.id].length}</Badge>
                  </div>
                  
                  <Droppable droppableId={status.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-1 rounded-md p-2 min-h-[200px]",
                          snapshot.isDraggingOver 
                            ? 'bg-gray-100/80 dark:bg-primary/10' 
                            : 'bg-gray-50/80 dark:bg-[rgb(2,8,23)]/5'
                        )}
                      >
                        <div className="space-y-3">
                          {leadsByStatus[status.id].map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "w-[320px] transition-all duration-200 hover:shadow-md hover:translate-y-[-2px] cursor-pointer",
                                    snapshot.isDragging 
                                      ? 'shadow-lg dark:shadow-black/20 border-primary/20' 
                                      : ''
                                  )}
                                  onClick={(e) => handleCardClick(e, lead)}
                                >
                                  <CardHeader className="px-3 h-[50px] flex flex-row items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <CardTitle className="text-sm font-medium truncate" title={lead.name}>
                                        {lead.name}
                                      </CardTitle>
                                    </div>
                                    <div className="flex-shrink-0 m-0" style={{ marginBottom: '6px' }}>
                                      {isLoadingJourneyStages ? (
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                      ) : (
                                        <Badge className={`text-xs m-0 ${
                                          JOURNEY_STAGE_COLORS[leadJourneyStages[lead.id] || 'not_contacted']
                                        }`}>
                                          {getJourneyStageName(leadJourneyStages[lead.id] || 'not_contacted')}
                                        </Badge>
                                      )}
                                    </div>
                                  </CardHeader>
                                  <div className="border-t border-gray-100 dark:border-gray-800 mx-3"></div>
                                  <CardContent className="p-3 pt-2 pb-0">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate" title={lead.email}>
                                      {lead.email}
                                    </div>
                                    {lead.phone && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate" title={lead.phone}>
                                        {lead.phone}
                                      </div>
                                    )}
                                      {getCompanyName(lead) && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate" title={getCompanyName(lead) || ''}>
                                          {getCompanyName(lead)}
                                        </div>
                                      )}
                                    <div className="flex items-center justify-between mt-2 mb-3">
                                      {lead.segment_id && (
                                        <Badge variant="secondary" className="text-xs truncate max-w-[200px]" title={getSegmentName(lead.segment_id)}>
                                          {getSegmentName(lead.segment_id)}
                                        </Badge>
                                      )}
                                    </div>
                                    {/* AI Actions Footer */}
                                    <div className="flex items-center justify-between pt-2 pb-2 border-t border-gray-100 dark:border-gray-800">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 font-medium">AI Actions</span>
                                      </div>
                                      <div className="flex gap-1">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`h-6 w-6 ${successActions[lead.id] === 'research' ? 'bg-green-100 text-green-700' : ''}`}
                                                disabled={loadingActions[lead.id] === 'research'}
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  e.preventDefault()
                                                  handleLeadResearch(lead.id)
                                                }}
                                              >
                                                {loadingActions[lead.id] === 'research' ? (
                                                  <Loader className="h-3 w-3" />
                                                ) : successActions[lead.id] === 'research' ? (
                                                  <CheckCircle2 className="h-3 w-3" />
                                                ) : (
                                                  <Search className="h-3 w-3" />
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
                                                className={`h-6 w-6 ${successActions[lead.id] === 'followup' ? 'bg-green-100 text-green-700' : ''}`}
                                                disabled={loadingActions[lead.id] === 'followup'}
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  e.preventDefault()
                                                  handleLeadFollowUp(lead.id)
                                                }}
                                              >
                                                {loadingActions[lead.id] === 'followup' ? (
                                                  <Loader className="h-3 w-3" />
                                                ) : successActions[lead.id] === 'followup' ? (
                                                  <CheckCircle2 className="h-3 w-3" />
                                                ) : (
                                                  <Mail className="h-3 w-3" />
                                                )}
                                                <span className="sr-only">Lead Follow Up</span>
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Intelligent follow-up</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                        {/* Assignee action button - only show if no assignee */}
                                        {!lead.assignee_id && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
                                                  disabled={assigningLeads[lead.id]}
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    e.preventDefault()
                                                    handleAssignLead(lead.id)
                                                  }}
                                                >
                                                  {assigningLeads[lead.id] ? (
                                                    <Loader className="h-3 w-3" />
                                                  ) : (
                                                    <Sparkles className="h-3 w-3" />
                                                  )}
                                                  <span className="sr-only">Assign to me</span>
                                                </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Assign to me</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                        {/* Assignee indicator - always show */}
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              {lead.assignee_id ? (
                                                <button
                                                  className="flex items-center space-x-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                                                  disabled={assigningLeads[lead.id]}
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    e.preventDefault()
                                                    handleToggleAssignee(lead.id)
                                                  }}
                                                >
                                                  {assigningLeads[lead.id] ? (
                                                    <Loader className="h-3 w-3" />
                                                  ) : (
                                                    <UserIcon className="h-3 w-3" />
                                                  )}
                                                  <span className="text-xs font-medium">
                                                    {lead.assignee_id === user?.id 
                                                      ? 'You' 
                                                      : userData?.[lead.assignee_id]?.name || 'Assigned'}
                                                  </span>
                                                </button>
                                              ) : (
                                                <button
                                                  className="flex items-center space-x-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors cursor-pointer"
                                                  disabled={assigningLeads[lead.id]}
                                                  onClick={(e) => {
                                                    e.stopPropagation()
                                                    e.preventDefault()
                                                    handleToggleAssignee(lead.id)
                                                  }}
                                                >
                                                  {assigningLeads[lead.id] ? (
                                                    <Loader className="h-3 w-3" />
                                                  ) : (
                                                    <Sparkles className="h-3 w-3" />
                                                  )}
                                                  <span className="text-xs font-medium">AI</span>
                                                </button>
                                              )}
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Click to {lead.assignee_id === user?.id 
                                                ? 'assign to AI Team' 
                                                : 'assign to me'}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          
                          {/* Load More Button */}
                          {hasMoreLeads(status.id) && onLoadMore && (
                            <div className="flex justify-center mt-2 px-2">
                              <Button
                                variant="outline"
                                onClick={() => onLoadMore(status.id)}
                                disabled={kanbanPagination[status.id]?.isLoading}
                                className="w-full max-w-xs"
                                size="sm"
                              >
                                {kanbanPagination[status.id]?.isLoading ? (
                                  <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                                    <span>Loading</span>
                                  </div>
                                ) : "Load More"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        </div>
      )}
    </div>
  )
} 