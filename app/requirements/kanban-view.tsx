import React, { useState, useEffect, useCallback } from 'react'
import type { DroppableProvided, DroppableStateSnapshot, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { useToast } from "@/app/components/ui/use-toast"
import { ClipboardList, Tag, CalendarIcon, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronRight, LayoutGrid, Target } from "@/app/components/ui/icons"
import { EmptyState } from "@/app/components/ui/empty-state"
import { Separator } from "@/app/components/ui/separator"
import { cn } from "@/lib/utils"

// Definimos los tipos de estado de los requisitos
const REQUIREMENT_STATUSES = [
  { id: 'backlog', name: 'Backlog' },
  { id: 'in-progress', name: 'In Progress' },
  { id: 'on-review', name: 'On Review' },
  { id: 'done', name: 'Done' },
  { id: 'validated', name: 'Validated' },
  { id: 'canceled', name: 'Canceled' }
]

// Colores para los diferentes estados
const STATUS_COLORS: Record<string, string> = {
  'backlog': 'bg-gray-100/20 text-gray-600 dark:text-gray-400 border-gray-300/30',
  'in-progress': 'bg-purple-100/20 text-purple-600 dark:text-purple-400 border-purple-300/30',
  'on-review': 'bg-blue-100/20 text-blue-600 dark:text-blue-400 border-blue-300/30',
  'done': 'bg-green-100/20 text-green-600 dark:text-green-400 border-green-300/30',
  'validated': 'bg-green-100/20 text-green-600 dark:text-green-400 border-green-300/30',
  'canceled': 'bg-red-100/20 text-red-600 dark:text-red-400 border-red-300/30'
}

// Colors for priorities
const PRIORITY_COLORS: Record<string, string> = {
  'high': 'bg-red-100/20 text-red-600 dark:text-red-400 border-red-300/30',
  'medium': 'bg-yellow-100/20 text-yellow-600 dark:text-yellow-400 border-yellow-300/30',
  'low': 'bg-blue-100/20 text-blue-600 dark:text-blue-400 border-blue-300/30'
}

// Helper to get completion status display (moved outside component)
const getCompletionStatusDisplay = (status: string) => {
  switch(status) {
    case 'completed': return 'Completed';
    case 'rejected': return 'Rejected';
    default: return 'Pending';
  }
}

// Determine if a card should be draggable (moved outside component)
const isDraggable = (requirement: { completionStatus: string }) => {
  return requirement.completionStatus === 'pending';
}

// Format date to a more readable format (moved outside component)
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  }).format(date);
}

// Interfaz para los filtros de requisitos
export interface RequirementFilters {
  priority: string[]
  status: string[]
  segments: string[]
  completionStatus: string[]
}

// Define type for requirement status
type RequirementStatusType = "backlog" | "in-progress" | "on-review" | "done" | "validated" | "canceled";
type CompletionStatusType = "pending" | "completed" | "rejected";

interface Requirement {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  status: RequirementStatusType
  completionStatus: CompletionStatusType
  source: string
  campaigns?: string[]
  campaignNames?: string[]
  budget: number | null
  createdAt: string
  segments: string[]
  segmentNames?: string[]
  isExpanded?: boolean
}

interface KanbanViewProps {
  requirements: Requirement[]
  onUpdateRequirementStatus: (requirementId: string, newStatus: RequirementStatusType) => Promise<void>
  segments: Array<{ id: string; name: string, description: string }>
  onRequirementClick: (requirement: Requirement) => void
  filters?: RequirementFilters
  onOpenFilters?: () => void
}

// CSS para texto vertical cuando la columna está colapsada
const KanbanColumnStyles = `
.kanban-writing-mode-vertical {
  writing-mode: vertical-lr;
  text-orientation: mixed;
  transform: rotate(180deg);
  white-space: nowrap;
  letter-spacing: 0.1em;
}
`;

export function KanbanView({ 
  requirements, 
  onUpdateRequirementStatus, 
  segments, 
  onRequirementClick,
  filters,
  onOpenFilters
}: KanbanViewProps) {
  const { toast } = useToast()
  
  // Estado para controlar qué columnas están colapsadas
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  
  // Función para alternar el estado de colapso de una columna
  const toggleColumn = (columnId: string) => {
    setCollapsedColumns(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  };
  
  // Organizamos los requisitos por estado - Convertida a useCallback para estabilidad
  const getRequirementsByStatus = useCallback(() => {
    const requirementsByStatus: Record<string, Requirement[]> = {}
    
    // Inicializamos todas las columnas, incluso las vacías
    REQUIREMENT_STATUSES.forEach(status => {
      requirementsByStatus[status.id] = []
    })
    
    // Agrupamos los requisitos por estado
    requirements.forEach(requirement => {
      if (requirementsByStatus[requirement.status]) {
        requirementsByStatus[requirement.status].push(requirement)
      }
    })
    
    return requirementsByStatus
  }, [requirements])
  
  const [requirementsByStatus, setRequirementsByStatus] = useState(() => getRequirementsByStatus())
  
  // Actualizamos los requisitos cuando cambia la prop requirements
  useEffect(() => {
    setRequirementsByStatus(getRequirementsByStatus())
  }, [getRequirementsByStatus])
  
  // Manejador para cuando se completa un arrastre
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    
    // Si no hay destino o el destino es el mismo que el origen, no hacemos nada
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      return
    }
    
    // Obtenemos el requisito que se está moviendo
    const requirement = requirements.find(r => r.id === draggableId)
    if (!requirement) return
    
    // Actualizamos el estado localmente para una respuesta inmediata en la UI
    const newRequirementsByStatus = {...requirementsByStatus}
    
    // Removemos el requisito de su columna actual
    newRequirementsByStatus[source.droppableId] = newRequirementsByStatus[source.droppableId].filter(
      r => r.id !== draggableId
    )
    
    // Creamos una copia del requisito con el nuevo estado
    const updatedRequirement = {...requirement, status: destination.droppableId as any}
    
    // Insertamos el requisito en la nueva columna en la posición correcta
    newRequirementsByStatus[destination.droppableId] = [
      ...newRequirementsByStatus[destination.droppableId].slice(0, destination.index),
      updatedRequirement,
      ...newRequirementsByStatus[destination.droppableId].slice(destination.index)
    ]
    
    // Actualizamos el estado local
    setRequirementsByStatus(newRequirementsByStatus)
    
    try {
      // Llamamos a la función para actualizar el estado en la base de datos
      await onUpdateRequirementStatus(draggableId, destination.droppableId as any)
      
      toast({
        title: "Status updated",
        description: `Requirement moved to ${REQUIREMENT_STATUSES.find(s => s.id === destination.droppableId)?.name}`,
      })
    } catch (error) {
      // Si hay un error, revertimos el cambio local
      toast({
        title: "Error",
        variant: "destructive",
        description: "Error updating requirement status",
      })
      setRequirementsByStatus(getRequirementsByStatus())
    }
  }

  // Manejador para el clic en una tarjeta - Convertida a useCallback para estabilidad
  const handleCardClick = useCallback((e: React.MouseEvent, requirement: Requirement) => {
    // Evitamos que el clic se propague al draggable
    e.stopPropagation();
    onRequirementClick(requirement);
  }, [onRequirementClick]);
  
  // Check if there are no requirements at all
  const hasNoRequirements = requirements.length === 0
    
  return (
    <div className="w-full">
      <style>{KanbanColumnStyles}</style>
      {hasNoRequirements ? (
        <EmptyState
          icon={<ClipboardList className="h-12 w-12 text-primary" />}
          title="No requirements found"
          description="There are no requirements matching your current filters or you haven't created any requirements yet."
          hint="Try clearing your filters or create a new requirement to get started."
        />
      ) : (
        <div className="overflow-auto">
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="inline-flex gap-4 pb-4">
              {REQUIREMENT_STATUSES.map(status => {
                const isCollapsed = collapsedColumns[status.id] || false;
                return (
                  <div 
                    key={status.id} 
                    className={cn(
                      "flex flex-col h-full transition-all duration-300 ease-in-out",
                      isCollapsed ? "w-12" : "w-[295px]"
                    )}
                  >
                    <div 
                      className="mb-2 flex items-center justify-between p-2 cursor-pointer hover:bg-muted/70 rounded-md transition-colors"
                      onClick={() => toggleColumn(status.id)}
                    >
                      {isCollapsed ? (
                        <div className="flex flex-col items-center w-full">
                          <ChevronRight className="h-4 w-4 text-muted-foreground mb-1.5" />
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full mb-2">
                            {requirementsByStatus[status.id].length}
                          </span>
                          <div className="kanban-writing-mode-vertical text-xs text-muted-foreground">
                            {status.name.split("").join(" ")}
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-medium text-sm">{status.name}</h3>
                          </div>
                          <Badge variant="outline">{requirementsByStatus[status.id].length}</Badge>
                        </>
                      )}
                    </div>
                    
                    {!isCollapsed && (
                      <Droppable droppableId={status.id}>
                        {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex-1 rounded-md p-2 min-h-[500px] w-full ${
                              snapshot.isDraggingOver 
                                ? 'bg-gray-100/80 dark:bg-primary/10' 
                                : 'bg-gray-50/80 dark:bg-[rgb(2,8,23)]/5'
                            }`}
                          >
                            <ScrollArea className="h-[500px] w-full">
                              {requirementsByStatus[status.id].map((requirement, index) => (
                                <Draggable 
                                  key={requirement.id} 
                                  draggableId={requirement.id} 
                                  index={index}
                                  isDragDisabled={!isDraggable(requirement)}
                                >
                                  {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                                    <div className="w-full mb-3">
                                      <Card
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`transition-all duration-200 hover:shadow-md hover:translate-y-[-2px] cursor-pointer w-full ${
                                          snapshot.isDragging 
                                            ? 'shadow-lg dark:shadow-black/20 border-primary/20' 
                                            : ''
                                        } ${!isDraggable(requirement) ? 'opacity-80' : ''}`}
                                        onClick={(e) => handleCardClick(e, requirement)}
                                      >
                                        <CardHeader className="p-3 pb-1 space-y-0">
                                          <CardTitle className="text-sm font-medium flex items-start justify-between gap-2 w-full">
                                            <div className="min-w-0 flex-1">
                                              <span className="truncate">{requirement.title}</span>
                                            </div>
                                            <Badge className={`text-xs whitespace-nowrap flex-shrink-0 ${PRIORITY_COLORS[requirement.priority]}`}>
                                              {requirement.priority.charAt(0).toUpperCase() + requirement.priority.slice(1)}
                                            </Badge>
                                          </CardTitle>
                                        </CardHeader>
                                        
                                        <CardContent className="p-3 pt-1 space-y-2 w-full">
                                          {/* Description section with icon */}
                                          <div className="flex gap-1.5 items-start w-full">
                                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 break-words min-w-0 flex-1">
                                              {requirement.description}
                                            </p>
                                          </div>
                                          
                                          <Separator className="my-1" />
                                          
                                          {/* Status badges with icons - Stacked layout for smaller column width */}
                                          <div className="flex flex-col gap-1.5 w-full">
                                            <div className="flex items-center justify-between w-full">
                                              <div className="flex items-center gap-1.5">
                                                <Target className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                                <span className="text-xs text-muted-foreground truncate flex-1">
                                                  {requirement.campaignNames && requirement.campaignNames.length > 0 
                                                    ? requirement.campaignNames[0]
                                                    : "No campaign"}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1.5">
                                                <svg 
                                                  xmlns="http://www.w3.org/2000/svg" 
                                                  width="16" 
                                                  height="16" 
                                                  viewBox="0 0 24 24" 
                                                  fill="none" 
                                                  stroke="currentColor" 
                                                  strokeWidth="2" 
                                                  strokeLinecap="round" 
                                                  strokeLinejoin="round" 
                                                  className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0"
                                                >
                                                  <circle cx="12" cy="12" r="10"/>
                                                  <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
                                                  <path d="M12 18V6"/>
                                                </svg>
                                                <span className="text-xs text-muted-foreground truncate">
                                                  {requirement.budget ? `$${requirement.budget.toLocaleString()}` : "No budget"}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {/* Segments section with tags icon */}
                                          {requirement.segmentNames && requirement.segmentNames.length > 0 && (
                                            <div className="flex items-start gap-1.5 w-full">
                                              <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                                              <div className="flex flex-wrap gap-1 min-w-0 flex-1">
                                                {requirement.segmentNames.slice(0, 1).map(segmentName => (
                                                  <Badge 
                                                    key={segmentName}
                                                    variant="secondary" 
                                                    className="text-xs max-w-full truncate bg-gray-100/20 text-gray-700 dark:text-gray-300 border-gray-300/30"
                                                  >
                                                    {segmentName}
                                                  </Badge>
                                                ))}
                                                {requirement.segmentNames.length > 1 && (
                                                  <Badge 
                                                    variant="secondary" 
                                                    className="text-xs bg-gray-100/20 text-gray-700 dark:text-gray-300 border-gray-300/30"
                                                  >
                                                    +{requirement.segmentNames.length - 1}
                                                  </Badge>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                        </CardContent>
                                      </Card>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </ScrollArea>
                          </div>
                        )}
                      </Droppable>
                    )}
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        </div>
      )}
    </div>
  )
}

function KanbanRequirementCard({
  requirement,
  provided,
  snapshot,
  onClick
}: {
  requirement: Requirement,
  provided: DraggableProvided,
  snapshot: DraggableStateSnapshot,
  onClick: (requirement: Requirement) => void
}) {
  const [isExpanded, setIsExpanded] = useState(!!requirement.isExpanded)
  
  // Toggle expanded state and update the requirement object
  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    setIsExpanded((prev) => {
      const newExpandedState = !prev
      requirement.isExpanded = newExpandedState
      return newExpandedState
    })
  }
  
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={() => onClick(requirement)}
      className={cn(
        "mb-2 p-3 rounded-md border shadow-sm bg-card",
        snapshot.isDragging ? "border-primary/50 shadow-md" : "border-border",
        !isDraggable(requirement) ? "opacity-75" : "",
        "cursor-pointer transition-all duration-200 hover:border-primary/50"
      )}
      style={{
        ...provided.draggableProps.style
      }}
    >
      <div className="flex items-center justify-between">
        <h4 className="font-medium truncate max-w-[250px]">{requirement.title}</h4>
        <Badge className={`capitalize ${PRIORITY_COLORS[requirement.priority]}`}>{requirement.priority}</Badge>
      </div>
      
      {/* Descripción colapsable */}
      <div 
        className={cn(
          "text-sm text-muted-foreground mt-2",
          isExpanded ? "" : "line-clamp-2"
        )}
      >
        {requirement.description}
        {!isExpanded && requirement.description.length > 120 && (
          <button 
            className="text-xs text-primary ml-1"
            onClick={toggleExpand}
          >
            Show more
          </button>
        )}
      </div>
      
      {/* Badges y metadatos */}
      <div className="flex flex-wrap items-center gap-2 mt-2">
        {requirement.budget != null && (
          <Badge variant="outline" className="bg-muted/20">
            ${requirement.budget.toLocaleString()}
          </Badge>
        )}
        
        <Badge variant="outline" className="bg-muted/20 text-muted-foreground text-xs">
          <CalendarIcon className="w-3 h-3 mr-1" />
          {formatDate(requirement.createdAt)}
        </Badge>
        
        <Badge 
          variant="outline" 
          className={`flex items-center gap-1 ${requirement.completionStatus === 'completed' 
            ? 'bg-green-100/20 text-green-600 dark:text-green-400 border-green-300/30' 
            : requirement.completionStatus === 'rejected' 
              ? 'bg-red-100/20 text-red-600 dark:text-red-400 border-red-300/30' 
              : 'bg-blue-100/20 text-blue-600 dark:text-blue-400 border-blue-300/30'
          }`}
        >
          {requirement.completionStatus === 'completed' 
            ? <CheckCircle2 className="w-3 h-3" /> 
            : requirement.completionStatus === 'rejected' 
              ? <AlertCircle className="w-3 h-3" /> 
              : <Clock className="w-3 h-3" />
          }
          {getCompletionStatusDisplay(requirement.completionStatus)}
        </Badge>
      </div>
      
      {/* Segment information */}
      {requirement.segmentNames && requirement.segmentNames.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {requirement.segmentNames.slice(0, 3).map((segment, i) => (
            <span
              key={`${requirement.id}-segment-${i}`}
              className="px-1.5 py-0.5 text-xs rounded-full bg-muted/20 text-muted-foreground"
            >
              {segment}
            </span>
          ))}
          {requirement.segmentNames.length > 3 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-muted/20 text-muted-foreground">
              +{requirement.segmentNames.length - 3} more
            </span>
          )}
        </div>
      )}
      
      {/* Campaign information */}
      {requirement.campaignNames && requirement.campaignNames.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 border-t pt-2">
          <span className="text-xs text-muted-foreground mr-1">Campaigns:</span>
          {requirement.campaignNames.slice(0, 2).map((campaign, i) => (
            <span
              key={`${requirement.id}-campaign-${i}`}
              className="px-1.5 py-0.5 text-xs rounded-full bg-purple-100/20 text-purple-600 dark:text-purple-400 border border-purple-300/30"
            >
              {campaign}
            </span>
          ))}
          {requirement.campaignNames.length > 2 && (
            <span className="px-1.5 py-0.5 text-xs rounded-full bg-muted/20 text-muted-foreground">
              +{requirement.campaignNames.length - 2} more
            </span>
          )}
        </div>
      )}
    </div>
  )
} 