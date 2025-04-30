"use client"

import React, { useState, useEffect, useContext } from "react"
import { useSite } from "@/app/context/SiteContext"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Plus, X, Filter, ClipboardList } from "@/app/components/ui/icons"
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
import { getTasksByLeadId } from "@/app/leads/tasks/actions"
import { JOURNEY_STAGES } from "@/app/leads/types"

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
  searchQuery?: string
}

interface KanbanViewProps {
  leads: Lead[]
  onUpdateLeadStatus: (leadId: string, newStatus: string) => Promise<void>
  segments: Array<{ id: string; name: string }>
  onLeadClick: (lead: Lead) => void
  filters?: LeadFilters
  onOpenFilters?: () => void
}

// Cache de etapas para cada lead
const leadJourneyStagesCache: Record<string, string> = {};

export function KanbanView({ 
  leads, 
  onUpdateLeadStatus, 
  segments, 
  onLeadClick,
  filters,
  onOpenFilters
}: KanbanViewProps) {
  const { currentSite } = useSite()
  const [leadJourneyStages, setLeadJourneyStages] = useState<Record<string, string>>({})
  const [isLoadingJourneyStages, setIsLoadingJourneyStages] = useState(true)
  
  // Organizamos los leads por estado
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
    
    return leadsByStatus
  }
  
  const [leadsByStatus, setLeadsByStatus] = useState(getLeadsByStatus())
  
  // Función para obtener el nombre del segmento
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || "Unknown Segment"
  }
  
  // Función para obtener el nombre de la compañía
  const getCompanyName = (company: { name?: string; website?: string; industry?: string; size?: string } | string | null) => {
    if (!company) return null
    if (typeof company === 'string') return company
    return company.name || null
  }
  
  // Cargar etapas del journey para cada lead
  useEffect(() => {
    const fetchJourneyStagesForLeads = async () => {
      if (!currentSite?.id || leads.length === 0) {
        setIsLoadingJourneyStages(false)
        return
      }
      
      setIsLoadingJourneyStages(true)
      const stages: Record<string, string> = {}
      
      // Usar promesas en paralelo para mejorar el rendimiento
      const promises = leads.map(async (lead) => {
        // Si ya tenemos la etapa en el cache, no hacemos una nueva petición
        if (leadJourneyStagesCache[lead.id]) {
          stages[lead.id] = leadJourneyStagesCache[lead.id]
          return
        }
        
        try {
          const result = await getTasksByLeadId(lead.id)
          
          if (result.error || !result.tasks) {
            stages[lead.id] = "not_contacted"
            return
          }
          
          // Ordenar las etapas del journey por prioridad
          const stageOrder = ["referral", "retention", "purchase", "decision", "consideration", "awareness"]
          
          // Encontrar la etapa más alta
          const highestStage = result.tasks
            .filter(task => task.status === "completed")
            .sort((a, b) => {
              const aIndex = stageOrder.indexOf(a.stage)
              const bIndex = stageOrder.indexOf(b.stage)
              return aIndex - bIndex
            })[0]?.stage || "not_contacted"
          
          stages[lead.id] = highestStage
          leadJourneyStagesCache[lead.id] = highestStage
        } catch (error) {
          console.error(`Error fetching tasks for lead ${lead.id}:`, error)
          stages[lead.id] = "not_contacted"
        }
      })
      
      await Promise.all(promises)
      setLeadJourneyStages(stages)
      setIsLoadingJourneyStages(false)
    }
    
    fetchJourneyStagesForLeads()
  }, [leads, currentSite?.id])
  
  // Obtener el nombre legible de una etapa
  const getJourneyStageName = (stageId: string) => {
    if (stageId === "not_contacted") return "Unaware"
    return JOURNEY_STAGES.find(stage => stage.id === stageId)?.label || "Unknown"
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
                <div key={status.id} className="flex flex-col h-full w-[280px]">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-medium text-sm">{status.name}</h3>
                    <Badge variant="outline">{leadsByStatus[status.id].length}</Badge>
                  </div>
                  
                  <Droppable droppableId={status.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-1 rounded-md p-2 min-h-[500px]",
                          snapshot.isDraggingOver 
                            ? 'bg-gray-100/80 dark:bg-primary/10' 
                            : 'bg-gray-50/80 dark:bg-[rgb(2,8,23)]/5'
                        )}
                      >
                        <ScrollArea className="h-[500px] w-full pr-4">
                          {leadsByStatus[status.id].map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "mb-3 transition-all duration-200 hover:shadow-md hover:translate-y-[-2px] cursor-pointer",
                                    snapshot.isDragging 
                                      ? 'shadow-lg dark:shadow-black/20 border-primary/20' 
                                      : ''
                                  )}
                                  onClick={(e) => handleCardClick(e, lead)}
                                >
                                  <CardHeader className="p-3 pb-0">
                                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                                      {lead.name}
                                      <Badge className={`text-xs ${
                                        JOURNEY_STAGE_COLORS[leadJourneyStages[lead.id] || 'not_contacted']
                                      }`}>
                                        {getJourneyStageName(leadJourneyStages[lead.id] || 'not_contacted')}
                                      </Badge>
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="p-3 pt-2">
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                      {lead.email}
                                    </div>
                                    {lead.company && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                        {getCompanyName(lead.company)}
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between mt-2">
                                      {lead.segment_id && (
                                        <Badge variant="secondary" className="text-xs">
                                          {getSegmentName(lead.segment_id)}
                                        </Badge>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </ScrollArea>
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