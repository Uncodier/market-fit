import React, { useState } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Filter, ClipboardList } from "@/app/components/ui/icons"
import { EmptyState } from "@/app/components/ui/empty-state"

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

// Interfaz para los filtros de leads
export interface LeadFilters {
  status: string[]
  segments: string[]
  origin: string[]
}

interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  position: string | null
  segment_id: string | null
  status: "new" | "contacted" | "qualified" | "converted" | "lost"
  created_at: string
  origin: string | null
}

interface KanbanViewProps {
  leads: Lead[]
  onUpdateLeadStatus: (leadId: string, newStatus: string) => Promise<void>
  segments: Array<{ id: string; name: string }>
  onLeadClick: (lead: Lead) => void
  filters?: LeadFilters
  onOpenFilters?: () => void
}

export function KanbanView({ 
  leads, 
  onUpdateLeadStatus, 
  segments, 
  onLeadClick,
  filters,
  onOpenFilters
}: KanbanViewProps) {
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
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-5 gap-4">
            {LEAD_STATUSES.map(status => (
              <div key={status.id} className="flex flex-col h-full">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium text-sm">{status.name}</h3>
                  <Badge variant="outline">{leadsByStatus[status.id].length}</Badge>
                </div>
                
                <Droppable droppableId={status.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 rounded-md p-2 min-h-[500px] ${
                        snapshot.isDraggingOver 
                          ? 'bg-gray-100/80 dark:bg-primary/10' 
                          : 'bg-gray-50/80 dark:bg-[rgb(2,8,23)]/5'
                      }`}
                    >
                      <ScrollArea className="h-[500px] w-full pr-4">
                        {leadsByStatus[status.id].map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`mb-3 transition-all duration-200 hover:shadow-md hover:translate-y-[-2px] cursor-pointer ${
                                  snapshot.isDragging 
                                    ? 'shadow-lg dark:shadow-black/20 border-primary/20' 
                                    : ''
                                }`}
                                onClick={(e) => handleCardClick(e, lead)}
                              >
                                <CardHeader className="p-3 pb-0">
                                  <CardTitle className="text-sm font-medium">
                                    {lead.name}
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="p-3 pt-2">
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                    {lead.email}
                                  </div>
                                  {lead.company && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                      {lead.company}
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between mt-2">
                                    {lead.segment_id && (
                                      <Badge variant="secondary" className="text-xs">
                                        {getSegmentName(lead.segment_id)}
                                      </Badge>
                                    )}
                                    <Badge className={`text-xs ${STATUS_COLORS[lead.status]}`}>
                                      {lead.status}
                                    </Badge>
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
      )}
    </div>
  )
} 