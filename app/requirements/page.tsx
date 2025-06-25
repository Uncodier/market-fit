"use client"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Checkbox } from "@/app/components/ui/checkbox"
import { PlusCircle, Filter, Search, ChevronDown, ChevronUp, XCircle, Check, Archive, RotateCcw, CheckCircle2, Ban, ClipboardList, FileText } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { Collapsible, CollapsibleContent } from "@/app/components/ui/collapsible"
import React, { useState, useEffect } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyState } from "@/app/components/ui/empty-state"
import { useToast } from "@/app/components/ui/use-toast"
import { CreateRequirementDialog } from "@/app/components/create-requirement-dialog"
import { createRequirement, updateRequirementStatus, updateCompletionStatus, updateRequirementPriority } from "./actions"
import { createClient } from "@/lib/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { type Segment } from "./types"
import { SearchInput } from "@/app/components/ui/search-input"
import { FilterModal, type RequirementFilters } from "@/app/components/ui/filter-modal"
import { KanbanView } from './kanban-view'
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/app/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { safeReload } from "@/app/utils/safe-reload"

// Constantes para estados
const REQUIREMENT_STATUS = {
  VALIDATED: "validated",
  IN_PROGRESS: "in-progress",
  ON_REVIEW: "on-review",
  DONE: "done",
  BACKLOG: "backlog",
  CANCELED: "canceled"
} as const;

const COMPLETION_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  REJECTED: "rejected"
} as const;

type RequirementStatusType = typeof REQUIREMENT_STATUS[keyof typeof REQUIREMENT_STATUS];
type CompletionStatusType = typeof COMPLETION_STATUS[keyof typeof COMPLETION_STATUS];

interface Requirement {
  id: string
  title: string
  description: string
  type: "content" | "design" | "research" | "follow_up" | "task" | "develop" | "analytics" | "testing" | "approval" | "coordination" | "strategy" | "optimization" | "automation" | "integration" | "planning" | "payment"
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
  metadata?: {
    payment_status?: {
      status: 'pending' | 'paid' | 'failed'
      amount_paid?: number
      amount_due?: number
      currency?: string
      payment_method?: string
      stripe_payment_intent_id?: string
      payment_date?: string
      invoice_number?: string
      outsourced?: boolean
      outsource_provider?: string
      outsource_contact?: string
    }
  }
  campaignOutsourced?: boolean
}

// Define el tipo para los datos de requisitos en Supabase
interface RequirementData {
  id: string
  title: string
  description: string
  type: "content" | "design" | "research" | "follow_up" | "task" | "develop" | "analytics" | "testing" | "approval" | "coordination" | "strategy" | "optimization" | "automation" | "integration" | "planning" | "payment"
  priority: "high" | "medium" | "low"
  status: RequirementStatusType
  completion_status: CompletionStatusType
  source: string
  budget: number | null
  created_at: string
  requirement_segments: Array<{ segment_id: string }> | null
  requirement_campaigns: Array<{ campaign_id: string }> | null
  metadata?: any
}

// Define la interfaz para el segmento en Supabase
interface SegmentData {
  id: string
  name: string
  description: string
}

function RequirementCard({ requirement, onUpdateStatus, onUpdateCompletionStatus, onUpdatePriority }: { 
  requirement: Requirement, 
  onUpdateStatus: (id: string, status: RequirementStatusType) => Promise<void>,
  onUpdateCompletionStatus: (id: string, status: CompletionStatusType) => Promise<void>,
  onUpdatePriority: (id: string, priority: "high" | "medium" | "low") => Promise<void>
}) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isUpdatingCompletion, setIsUpdatingCompletion] = useState(false)
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false)
  const { toast } = useToast()

  const priorityColors = {
    high: "bg-red-100/20 text-red-600 dark:text-red-400 hover:bg-red-100/30 border-red-300/30",
    medium: "bg-yellow-100/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100/30 border-yellow-300/30",
    low: "bg-blue-100/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100/30 border-blue-300/30"
  }

  const statusColors = {
    [REQUIREMENT_STATUS.VALIDATED]: "bg-green-100/20 text-green-600 dark:text-green-400 hover:bg-green-100/30 border-green-300/30",
    [REQUIREMENT_STATUS.IN_PROGRESS]: "bg-purple-100/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100/30 border-purple-300/30",
    [REQUIREMENT_STATUS.ON_REVIEW]: "bg-blue-100/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100/30 border-blue-300/30",
    [REQUIREMENT_STATUS.DONE]: "bg-green-100/20 text-green-600 dark:text-green-400 hover:bg-green-100/30 border-green-300/30",
    [REQUIREMENT_STATUS.BACKLOG]: "bg-gray-100/20 text-gray-600 dark:text-gray-400 hover:bg-gray-100/30 border-gray-300/30",
    [REQUIREMENT_STATUS.CANCELED]: "bg-red-100/20 text-red-600 dark:text-red-400 hover:bg-red-100/30 border-red-300/30"
  }

  const completionStatusColors = {
    [COMPLETION_STATUS.COMPLETED]: "bg-green-100/20 text-green-600 dark:text-green-400 border-green-300/30",
    [COMPLETION_STATUS.REJECTED]: "bg-red-100/20 text-red-600 dark:text-red-400 border-red-300/30",
    [COMPLETION_STATUS.PENDING]: "bg-yellow-100/20 text-yellow-600 dark:text-yellow-400 border-yellow-300/30"
  }

  const handleUpdateStatus = async (status: RequirementStatusType) => {
    try {
      setIsUpdatingStatus(true)
      await onUpdateStatus(requirement.id, status)
      toast({
        title: "Status updated",
        description: `The requirement has been moved to ${
          status === REQUIREMENT_STATUS.VALIDATED ? "Validated" : 
          status === REQUIREMENT_STATUS.IN_PROGRESS ? "In Progress" :
          status === REQUIREMENT_STATUS.ON_REVIEW ? "On Review" :
          status === REQUIREMENT_STATUS.DONE ? "Done" :
          status === REQUIREMENT_STATUS.CANCELED ? "Canceled" :
          "Backlog"
        }`,
      })
    } catch (error) {
      toast({
        title: "Error",
        variant: "destructive",
        description: "Error al actualizar el estado del requisito",
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleUpdateCompletionStatus = async (status: CompletionStatusType) => {
    try {
      setIsUpdatingCompletion(true)
      await onUpdateCompletionStatus(requirement.id, status)
      toast({
        title: "Estado actualizado",
        description: `El estado de finalización ha sido actualizado a ${
          status === COMPLETION_STATUS.PENDING ? "Pendiente" : 
          status === COMPLETION_STATUS.COMPLETED ? "Completado" : 
          "Rechazado"
        }`,
      })
    } catch (error) {
      toast({
        title: "Error",
        variant: "destructive",
        description: "Error al actualizar el estado de finalización",
      })
    } finally {
      setIsUpdatingCompletion(false)
    }
  }

  const handleUpdatePriority = async (priority: "high" | "medium" | "low") => {
    try {
      setIsUpdatingPriority(true)
      await onUpdatePriority(requirement.id, priority)
      toast({
        title: "Priority updated",
        description: `The requirement priority has been updated to ${
          priority === "high" ? "High" : 
          priority === "medium" ? "Medium" : "Low"
        }`,
      })
    } catch (error) {
      toast({
        title: "Error",
        variant: "destructive",
        description: "Error al actualizar la prioridad del requisito",
      })
    } finally {
      setIsUpdatingPriority(false)
    }
  }

  // Function to navigate to requirement details
  const router = useRouter()
  const navigateToDetails = () => {
    router.push(`/requirements/${requirement.id}`);
  }

  return (
    <Card 
      className="border border-border hover:border-foreground/20 transition-colors overflow-hidden cursor-pointer"
      onClick={navigateToDetails}
    >
      <div className="flex items-center hover:bg-muted/50 transition-colors w-full">
        <CardContent className="flex-1 p-4 w-full overflow-x-auto">
          <div className="flex items-start gap-4 min-w-[1200px]">
            <div className="w-[500px] min-w-[500px] pr-2 flex-grow">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg truncate">{requirement.title}</h3>
                {requirement.completionStatus === COMPLETION_STATUS.COMPLETED || requirement.completionStatus === COMPLETION_STATUS.REJECTED ? (
                  <Badge variant="secondary" className={`${priorityColors[requirement.priority]} bg-opacity-30 hover:bg-opacity-30 cursor-not-allowed`}>
                    {requirement.priority.charAt(0).toUpperCase() + requirement.priority.slice(1)}
                  </Badge>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                        <Badge variant="secondary" className={priorityColors[requirement.priority]}>
                          {requirement.priority.charAt(0).toUpperCase() + requirement.priority.slice(1)}
                        </Badge>
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        disabled={isUpdatingPriority}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdatePriority("high");
                        }}
                      >
                        <div className="w-2 h-2 rounded-full mr-2 bg-red-500"></div>
                        High Priority
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        disabled={isUpdatingPriority}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdatePriority("medium");
                        }}
                      >
                        <div className="w-2 h-2 rounded-full mr-2 bg-yellow-500"></div>
                        Medium Priority
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        disabled={isUpdatingPriority}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdatePriority("low");
                        }}
                      >
                        <div className="w-2 h-2 rounded-full mr-2 bg-blue-500"></div>
                        Low Priority
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {isUpdatingPriority && (
                  <span className="text-xs text-muted-foreground animate-pulse">Updating...</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground/80 line-clamp-1">{requirement.description}</p>
            </div>
            <div className="w-[100px] min-w-[100px] flex-shrink-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Type</p>
              <div className="flex justify-center">
                <Badge variant="outline" className={`text-xs ${
                  requirement.type === 'content' ? 'bg-blue-100/20 text-blue-600 dark:text-blue-400 border-blue-300/30' :
                  requirement.type === 'design' ? 'bg-purple-100/20 text-purple-600 dark:text-purple-400 border-purple-300/30' :
                  requirement.type === 'research' ? 'bg-indigo-100/20 text-indigo-600 dark:text-indigo-400 border-indigo-300/30' :
                  requirement.type === 'follow_up' ? 'bg-yellow-100/20 text-yellow-600 dark:text-yellow-400 border-yellow-300/30' :
                  requirement.type === 'task' ? 'bg-green-100/20 text-green-600 dark:text-green-400 border-green-300/30' :
                  requirement.type === 'develop' ? 'bg-red-100/20 text-red-600 dark:text-red-400 border-red-300/30' :
                  requirement.type === 'analytics' ? 'bg-teal-100/20 text-teal-600 dark:text-teal-400 border-teal-300/30' :
                  requirement.type === 'testing' ? 'bg-orange-100/20 text-orange-600 dark:text-orange-400 border-orange-300/30' :
                  requirement.type === 'approval' ? 'bg-emerald-100/20 text-emerald-600 dark:text-emerald-400 border-emerald-300/30' :
                  requirement.type === 'coordination' ? 'bg-cyan-100/20 text-cyan-600 dark:text-cyan-400 border-cyan-300/30' :
                  requirement.type === 'strategy' ? 'bg-violet-100/20 text-violet-600 dark:text-violet-400 border-violet-300/30' :
                  requirement.type === 'optimization' ? 'bg-lime-100/20 text-lime-600 dark:text-lime-400 border-lime-300/30' :
                  requirement.type === 'automation' ? 'bg-sky-100/20 text-sky-600 dark:text-sky-400 border-sky-300/30' :
                  requirement.type === 'integration' ? 'bg-rose-100/20 text-rose-600 dark:text-rose-400 border-rose-300/30' :
                  requirement.type === 'planning' ? 'bg-amber-100/20 text-amber-600 dark:text-amber-400 border-amber-300/30' :
                  'bg-pink-100/20 text-pink-600 dark:text-pink-400 border-pink-300/30'
                }`}>
                  {requirement.type === 'follow_up' ? 'Follow Up' : requirement.type.charAt(0).toUpperCase() + requirement.type.slice(1)}
                </Badge>
              </div>
            </div>
            <div className="w-[120px] min-w-[120px] flex-shrink-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Campaign</p>
              <p className="text-sm font-medium truncate text-center">
                {requirement.campaignNames && requirement.campaignNames.length > 0 
                  ? requirement.campaignNames[0] 
                  : "No campaign"}
              </p>
            </div>
            <div className="w-[100px] min-w-[100px] flex-shrink-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Status</p>
              <div className="flex justify-center">
                {requirement.completionStatus === COMPLETION_STATUS.COMPLETED || requirement.completionStatus === COMPLETION_STATUS.REJECTED ? (
                  <Badge 
                    variant="secondary" 
                    className={`${statusColors[requirement.status]} bg-opacity-30 hover:bg-opacity-30 cursor-not-allowed`}
                  >
                    {requirement.status === REQUIREMENT_STATUS.IN_PROGRESS 
                      ? "In Progress" 
                      : requirement.status === REQUIREMENT_STATUS.ON_REVIEW
                        ? "On Review"
                        : requirement.status === REQUIREMENT_STATUS.DONE
                          ? "Done"
                          : requirement.status === REQUIREMENT_STATUS.CANCELED
                            ? "Canceled"
                            : requirement.status === REQUIREMENT_STATUS.VALIDATED
                              ? "Validated"
                              : "Backlog"}
                  </Badge>
                ) : (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                        <Badge variant="secondary" className={statusColors[requirement.status]}>
                          {requirement.status === REQUIREMENT_STATUS.IN_PROGRESS 
                            ? "In Progress" 
                            : requirement.status === REQUIREMENT_STATUS.ON_REVIEW
                              ? "On Review"
                              : requirement.status === REQUIREMENT_STATUS.DONE
                                ? "Done"
                                : requirement.status === REQUIREMENT_STATUS.CANCELED
                                  ? "Canceled"
                                  : requirement.status === REQUIREMENT_STATUS.VALIDATED
                                    ? "Validated"
                                    : "Backlog"}
                        </Badge>
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        disabled={isUpdatingStatus}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(REQUIREMENT_STATUS.BACKLOG);
                        }}
                      >
                        <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.BACKLOG].split(" ")[0]}`}></div>
                        Backlog
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        disabled={isUpdatingStatus}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(REQUIREMENT_STATUS.IN_PROGRESS);
                        }}
                      >
                        <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.IN_PROGRESS].split(" ")[0]}`}></div>
                        In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        disabled={isUpdatingStatus}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(REQUIREMENT_STATUS.ON_REVIEW);
                        }}
                      >
                        <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.ON_REVIEW].split(" ")[0]}`}></div>
                        On Review
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        disabled={isUpdatingStatus}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(REQUIREMENT_STATUS.DONE);
                        }}
                      >
                        <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.DONE].split(" ")[0]}`}></div>
                        Done
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        disabled={isUpdatingStatus}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(REQUIREMENT_STATUS.VALIDATED);
                        }}
                      >
                        <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.VALIDATED].split(" ")[0]}`}></div>
                        Validated
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="cursor-pointer"
                        disabled={isUpdatingStatus}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUpdateStatus(REQUIREMENT_STATUS.CANCELED);
                        }}
                      >
                        <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.CANCELED].split(" ")[0]}`}></div>
                        Canceled
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {isUpdatingStatus && (
                  <span className="text-xs text-muted-foreground animate-pulse block mt-1">Updating...</span>
                )}
              </div>
            </div>
            <div className="w-[80px] min-w-[80px] flex-shrink-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Budget</p>
              <div className="flex justify-center">
                {(requirement.metadata?.payment_status?.outsourced && requirement.metadata.payment_status.status === 'paid') || 
                 requirement.campaignOutsourced ? (
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">Paid</span>
                ) : requirement.budget ? (
                  <span className="text-sm font-medium">${requirement.budget.toLocaleString()}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">N/A</span>
                )}
              </div>
            </div>
            <div className="w-[180px] min-w-[180px] flex-shrink-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Segments</p>
              <div className="flex items-center gap-1 justify-center">
                {requirement.segmentNames && requirement.segmentNames.length > 0 ? (
                  requirement.segmentNames.length > 1 ? (
                    <>
                      <Badge variant="outline" className="text-xs max-w-[120px] truncate">
                        {requirement.segmentNames[0]}
                      </Badge>
                      <Badge variant="outline" className="text-xs shrink-0">
                        +{requirement.segmentNames.length - 1}
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-xs max-w-[160px] truncate">
                      {requirement.segmentNames[0]}
                    </Badge>
                  )
                ) : (
                  <span className="text-sm text-muted-foreground">No segments</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

/**
 * Limpia un UUID de comillas extras o caracteres no válidos
 * @param id Posible UUID con formato incorrecto
 * @returns UUID limpio o string vacía si no es válido
 */
function cleanUUID(id: string | null): string {
  if (!id) return "";
  
  // Eliminar comillas extras si existen
  let cleaned = id.replace(/["']/g, '')
  
  // Verificar el formato básico de UUID después de limpiar
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleaned)) {
    return cleaned
  }
  
  // Caso especial para "default" u otros valores especiales
  if (cleaned === "default") return cleaned
  
  console.warn("UUID inválido después de limpieza:", id, "->", cleaned)
  return ""
}

// Define tipos para la caché (fuera del componente)
type CacheData = {
  segments: Segment[],
  requirements: Requirement[],
  timestamp: number,
  lastUpdated: number
};

type CacheStore = {
  [key: string]: CacheData;
};

export default function RequirementsPage() {
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string; description: string }>>([])
  const [filteredRequirements, setFilteredRequirements] = useState<Requirement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  
  // View mode state (list or kanban)
  const [viewMode, setViewMode] = useState<ViewType>("table")
  
  // Estado de filtros avanzados
  const [filters, setFilters] = useState<RequirementFilters>({
    priority: [],
    completionStatus: [],
    status: [],
    segments: []
  })
  
  // Estado para controlar la visualización del modal de filtros
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  
  // Estado de error visible al usuario
  const [visibleError, setVisibleError] = useState<string | null>(null)
  
  // Usar refs para los estados que no necesitan re-renderizar el componente
  const loadAttemptsRef = React.useRef(0)
  const isMountedRef = React.useRef(true)
  const isLoadingDataRef = React.useRef(false)
  const siteLoadedRef = React.useRef<string | null>(null)
  
  // Referencia para guardar el caché por sitio con sistema de invalidación basado en tiempo
  const dataCacheBySiteRef = React.useRef<CacheStore>({});
  
  // Para la referencia al input de búsqueda
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  
  const { toast } = useToast()
  const { currentSite } = useSite()
  
  // Funciones de utilidad para manejar la caché de forma segura
  const getCacheForSite = (siteId: string): CacheData | null => {
    if (!siteId || typeof siteId !== 'string') return null;
    return dataCacheBySiteRef.current[siteId] || null;
  };
  
  const setCacheForSite = (siteId: string, data: CacheData): void => {
    if (!siteId || typeof siteId !== 'string') return;
    dataCacheBySiteRef.current[siteId] = data;
  };
  
  // Forzar una recarga de datos (útil después de operaciones de actualización)
  const invalidateCache = React.useCallback((siteId: string): void => {
    if (!siteId || typeof siteId !== 'string') return;
    
    const cache = getCacheForSite(siteId);
    if (cache) {
      setCacheForSite(siteId, {
        ...cache,
        lastUpdated: 0
      });
    }
  }, []);

  // Configurar cleanup al desmontar
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Efecto de carga de datos (simplificado)
  useEffect(() => {
    // Si no hay sitio seleccionado, no cargamos nada
    if (!currentSite) {
      setIsLoading(false);
      return;
    }
    
    // Si el ID del sitio no es válido, mostramos error
    const siteId = currentSite?.id;
    if (!siteId) {
      setVisibleError("Invalid site ID");
      setIsLoading(false);
      return;
    }
    
    // Función de carga simplificada
    const loadDataSimple = async () => {
      try {
        const supabase = createClient();
        
        // Verify that the site exists
        const { data: siteData, error: siteError } = await supabase
          .from("sites")
          .select("id, name")
          .eq("id", siteId)
          .single();
          
        if (siteError || !siteData) {
          throw new Error("The selected site does not exist or you don't have access to it");
        }
        
        // Load segments
        const { data: segmentData, error: segmentError } = await supabase
          .from("segments")
          .select("*")
          .eq("site_id", siteId);
        
        if (segmentError) {
          throw new Error(`Error loading segments: ${segmentError.message}`);
        }
        
        // Load requirements - FIXING THE QUERY
        const { data: requirementData, error: requirementError } = await supabase
          .from("requirements")
          .select("*, requirement_segments(segment_id), campaign_requirements(campaign_id), metadata")
          .eq("site_id", siteId);
        
        if (requirementError) {
          throw new Error(`Error loading requirements: ${requirementError.message}`);
        }
        
        // Load campaigns to get their names and metadata
        const { data: campaignData, error: campaignError } = await supabase
          .from("campaigns")
          .select("id, title, metadata")
          .eq("site_id", siteId);
        
        if (campaignError) {
          console.warn("Error loading campaigns:", campaignError.message);
          // We don't throw here to not block the requirements loading
        }
        
        // Map segments to expected format
        const segments = (segmentData || []).map((segment: SegmentData) => ({
          id: segment.id,
          name: segment.name,
          description: segment.description || "",
        }));
        
        // Create a campaigns map for quick lookup
        const campaignsMap = new Map<string, string>();
        const campaignsOutsourcedMap = new Map<string, boolean>();
        if (campaignData && campaignData.length > 0) {
          campaignData.forEach((campaign: { id: string, title: string, metadata?: any }) => {
            campaignsMap.set(campaign.id, campaign.title);
            campaignsOutsourcedMap.set(campaign.id, campaign.metadata?.payment_status?.outsourced || false);
          });
        }
        
        // Map requirements to expected format
        const requirements = (requirementData || []).map((req: any) => {
          // Extract related segment IDs
          const segmentIds = (req.requirement_segments || []).map((sr: any) => sr.segment_id);
          
          // Get segment names
          const segmentNames = segments
            .filter((segment: any) => segmentIds.includes(segment.id))
            .map((segment: any) => segment.name);
          
          // Extract related campaign IDs
          const campaignIds = (req.campaign_requirements || []).map((cr: any) => cr.campaign_id);
          
          // Get campaign names
          const campaignNames = campaignIds
            .filter((id: string) => campaignsMap.has(id))
            .map((id: string) => campaignsMap.get(id) || "");
          
          // Check if any of the related campaigns is outsourced
          const campaignOutsourced = campaignIds.some((id: string) => 
            campaignsOutsourcedMap.get(id) === true
          );
          
          return {
            id: req.id,
            title: req.title,
            description: req.description || "",
            type: req.type || "task",
            priority: req.priority || "medium",
            status: req.status || "backlog",
            completionStatus: req.completion_status || "pending",
            source: req.source || "",
            budget: req.budget || null,
            createdAt: req.created_at || new Date().toISOString(),
            segments: segmentIds,
            segmentNames: segmentNames,
            campaigns: campaignIds,
            campaignNames: campaignNames,
            metadata: req.metadata || {},
            campaignOutsourced: campaignOutsourced
          };
        });
        
        // Save campaigns for the dropdown
        const formattedCampaigns = (campaignData || []).map((campaign: { id: string; title: string; description?: string }) => ({
          id: campaign.id,
          title: campaign.title,
          description: campaign.description || ""
        }));
        setCampaigns(formattedCampaigns);
        
        // Update state
        setSegments(segments);
        setRequirements(requirements);
        
        // Reset loading state
        setIsLoading(false);
        
      } catch (error: any) {
        setVisibleError(error.message || "Error loading data");
        setIsLoading(false);
      }
    };
    
    setIsLoading(true);
    loadDataSimple();
    
    return () => {
      // Limpieza
    };
  }, [currentSite]);

  // Manejar actualización de estados con invalidación de caché
  const handleUpdateStatus = async (id: string, status: RequirementStatusType) => {
    try {
      const { error } = await updateRequirementStatus(id, status)
      
      if (error) {
        throw new Error(error)
      }
      
      // Actualizar el estado local
      setRequirements(prevReqs => 
        prevReqs.map(req => 
          req.id === id ? { ...req, status } : req
        )
      )
      
      // Invalidar caché si hay un sitio seleccionado
      if (currentSite?.id) {
        const siteId = cleanUUID(currentSite.id);
        if (siteId) {
          invalidateCache(siteId);
        }
      }
      
    } catch (error) {
      console.error("Error al actualizar el estado:", error)
      toast({
        title: "Error",
        variant: "destructive",
        description: error instanceof Error ? error.message : "Error al actualizar el estado",
      })
      throw error
    }
  }

  // Manejar actualización de estados de finalización con invalidación de caché
  const handleUpdateCompletionStatus = async (id: string, completionStatus: CompletionStatusType) => {
    try {
      const { error } = await updateCompletionStatus(id, completionStatus)
      
      if (error) {
        throw new Error(error)
      }
      
      // Actualizar el estado local
      setRequirements(prevReqs => 
        prevReqs.map(req => 
          req.id === id ? { ...req, completionStatus } : req
        )
      )
      
      // Invalidar caché si hay un sitio seleccionado
      if (currentSite?.id) {
        const siteId = cleanUUID(currentSite.id);
        if (siteId) {
          invalidateCache(siteId);
        }
      }
      
    } catch (error) {
      console.error("Error al actualizar el estado de finalización:", error)
      toast({
        title: "Error",
        variant: "destructive",
        description: error instanceof Error ? error.message : "Error al actualizar el estado de finalización",
      })
      throw error
    }
  }

  // Manejar actualización de prioridad con invalidación de caché
  const handleUpdatePriority = async (id: string, priority: "high" | "medium" | "low") => {
    try {
      const { error } = await updateRequirementPriority(id, priority)
      
      if (error) {
        throw new Error(error)
      }
      
      // Actualizar el estado local
      setRequirements(prevReqs => 
        prevReqs.map(req => 
          req.id === id ? { ...req, priority } : req
        )
      )
      
      // Invalidar caché si hay un sitio seleccionado
      if (currentSite?.id) {
        const siteId = cleanUUID(currentSite.id);
        if (siteId) {
          invalidateCache(siteId);
        }
      }
      
    } catch (error) {
      console.error("Error al actualizar la prioridad:", error)
      toast({
        title: "Error",
        variant: "destructive",
        description: error instanceof Error ? error.message : "Error al actualizar la prioridad",
      })
      throw error
    }
  }

  // Efecto para filtrar los requisitos según la pestaña activa y otros filtros
  useEffect(() => {
    if (!requirements || requirements.length === 0) {
      setFilteredRequirements([]);
      return;
    }

    // Obtener requisitos que coinciden con los criterios de búsqueda
    let filtered = [...requirements];

    // Filtrar por texto de búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(req => 
        req.title.toLowerCase().includes(query) || 
        req.description.toLowerCase().includes(query) ||
        (req.campaignNames && req.campaignNames.some(name => name.toLowerCase().includes(query)))
      );
    }

    // Aplicar filtros avanzados si están definidos
    if (filters.priority.length > 0) {
      filtered = filtered.filter(req => filters.priority.includes(req.priority));
    }

    if (filters.segments.length > 0) {
      filtered = filtered.filter(req => 
        req.segments.some(segId => filters.segments.includes(segId))
      );
    }

    if (filters.completionStatus.length > 0) {
      filtered = filtered.filter(req => 
        filters.completionStatus.includes(req.completionStatus)
      );
    }
    
    if (filters.status.length > 0) {
      filtered = filtered.filter(req => 
        filters.status.includes(req.status)
      );
    }

    // Filtrar según la pestaña activa
    if (activeTab !== "all") {
      switch (activeTab) {
        case "pending":
          filtered = filtered.filter(req => req.completionStatus === COMPLETION_STATUS.PENDING);
          break;
        case "completed":
          filtered = filtered.filter(req => req.completionStatus === COMPLETION_STATUS.COMPLETED);
          break;
        case "rejected":
          filtered = filtered.filter(req => req.completionStatus === COMPLETION_STATUS.REJECTED);
          break;
      }
    }

    // Ordenar por prioridad: high, medium, low
    filtered.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    setFilteredRequirements(filtered);
  }, [requirements, activeTab, searchQuery, filters]);

  // Security mechanism to prevent indefinite loading
  useEffect(() => {
    if (isLoading) {
      const timeoutId = setTimeout(() => {
        // If still loading after 10 seconds, force reset
        if (isLoading) {
          setIsLoading(false);
          
          // If no data, show an error
          if (requirements.length === 0) {
            setVisibleError("Loading time exceeded. Please try again.");
          }
        }
      }, 10000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, requirements.length]);

  // Componentes de estado
  const NoSiteSelected = () => (
    <div className="flex flex-col items-center justify-center p-8 text-center h-[300px]">
      <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-xl font-medium mb-2">No site selected</h3>
      <p className="text-muted-foreground max-w-md">
        Please create or select a site to manage its requirements.
      </p>
    </div>
  )

  const LoadingState = () => (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <Card key={i} className="overflow-hidden border border-border">
          <div className="flex items-center hover:bg-muted/50 transition-colors w-full">
            <div className="flex-1 p-4 w-full overflow-x-auto">
              <div className="flex items-start gap-4 min-w-[1200px]">
                <div className="w-[500px] min-w-[500px] pr-2 flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                </div>
                <div className="w-[100px] min-w-[100px] flex-shrink-0">
                  <Skeleton className="h-3 w-8 mb-1 mx-auto" />
                  <Skeleton className="h-6 w-16 mx-auto" />
                </div>
                <div className="w-[120px] min-w-[120px] flex-shrink-0">
                  <Skeleton className="h-3 w-16 mb-1 mx-auto" />
                  <Skeleton className="h-4 w-20 mx-auto" />
                </div>
                <div className="w-[100px] min-w-[100px] flex-shrink-0">
                  <Skeleton className="h-3 w-12 mb-1 mx-auto" />
                  <Skeleton className="h-6 w-20 mx-auto" />
                </div>
                <div className="w-[80px] min-w-[80px] flex-shrink-0">
                  <Skeleton className="h-3 w-12 mb-1 mx-auto" />
                  <Skeleton className="h-4 w-16 mx-auto" />
                </div>
                <div className="w-[180px] min-w-[180px] flex-shrink-0">
                  <Skeleton className="h-3 w-16 mb-1 mx-auto" />
                  <div className="flex items-center gap-1 justify-center">
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-8" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )

  const EmptyResults = () => {
    // Determinar el mensaje adecuado según el contexto
    const getTabName = (tab: string): string => {
      switch (tab) {
        case "validated": return "validated requirements";
        case "in-progress": return "in-progress requirements";
        case "backlog": return "backlog requirements";
        default: return "all requirements";
      }
    };
    const tabName = getTabName(activeTab);
    
    return (
      <EmptyState
        icon={<ClipboardList className="w-24 h-24 text-primary/40" />}
        title={searchQuery ? "No matching requirements found" : "No requirements found"}
        description={
          searchQuery 
            ? "No results for your search. Try with other terms."
            : requirements.length > 0 
              ? `There are ${requirements.length} requirements in the database, but none match the current filter (${tabName}).`
              : "No requirements created yet. Create a new one to start."
        }
      />
    );
  };

  // Función de búsqueda
  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  // Función para aplicar filtros avanzados
  const handleApplyFilters = (newFilters: RequirementFilters) => {
    setFilters(newFilters);
  };

  // Función para limpiar todos los filtros
  const handleClearFilters = () => {
    setFilters({
      priority: [],
      completionStatus: [],
      status: [],
      segments: []
    });
    setSearchQuery("");
    setActiveTab("all");
    
    // Resetear el campo de búsqueda
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
  };

  // Función para abrir el modal de filtros
  const handleOpenFilterModal = () => {
    setIsFilterModalOpen(true);
  };

  // Función para manejar el clic en un requisito (usado en la vista Kanban)
  const handleRequirementClick = (requirement: Requirement) => {
    // Navegar a la vista de detalles del requisito
    window.location.href = `/requirements/${requirement.id}`;
  }

  return (
    <div className="flex-1 p-0">
      {/* Modal de filtros */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        segments={segments}
        completionStatusOptions={[COMPLETION_STATUS.PENDING, COMPLETION_STATUS.COMPLETED, COMPLETION_STATUS.REJECTED]}
        statusOptions={[REQUIREMENT_STATUS.IN_PROGRESS, REQUIREMENT_STATUS.ON_REVIEW, REQUIREMENT_STATUS.DONE, REQUIREMENT_STATUS.BACKLOG, REQUIREMENT_STATUS.CANCELED]}
      />
      
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="all">All Requirements</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                  <TabsTrigger value="rejected">Rejected</TabsTrigger>
                </TabsList>
                <SearchInput
                  placeholder="Search requirements..."
                  value={searchQuery}
                  onSearch={handleSearch}
                  ref={searchInputRef}
                  className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                />
                <Button variant="outline" onClick={handleOpenFilterModal}>
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </div>
              <div className="ml-auto flex items-center gap-4">
                {/* Indicador de filtros activos */}
                {(filters.priority.length > 0 || filters.completionStatus.length > 0 || filters.segments.length > 0) && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    <Badge variant="outline" className="rounded-full px-2 py-0">
                      {filters.priority.length + filters.completionStatus.length + filters.segments.length}
                    </Badge>
                    <span className="ml-2">Clear filters</span>
                  </Button>
                )}
                <ViewSelector currentView={viewMode} onViewChange={setViewMode} />
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            {/* Rendering for all tabs */}
            {["all", "pending", "completed", "rejected"].map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-4 min-h-[300px]">
                {/* Case 1: Loading or initial state - prioritize loading over no site selected */}
                {isLoading || (!currentSite && !visibleError) ? (
                  <LoadingState />
                ) : 
                /* Case 2: Visible error */
                visibleError ? (
                  <div className="p-4 border border-red-300 bg-red-50 rounded-md text-red-800 mb-4">
                    <h3 className="font-semibold mb-2">Error loading requirements</h3>
                    <p>{visibleError}</p>
                    <button 
                      onClick={() => safeReload(false, 'Requirements page error retry')} 
                      className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md"
                    >
                      Retry
                    </button>
                  </div>
                ) : 
                /* Case 3: No site selected (only show this when we're sure there's no site and not loading) */
                !currentSite ? (
                  <NoSiteSelected />
                ) : 
                /* Case 4: Still processing data - show loading if we have requirements but no filtered results yet */
                (requirements.length > 0 && filteredRequirements.length === 0) ? (
                  <LoadingState />
                ) :
                /* Case 5: No filtered requirements to show */
                filteredRequirements.length === 0 ? (
                  <EmptyResults />
                ) : 
                /* Case 6: Show requirements - List or Kanban view */
                viewMode === "table" ? (
                  <div className="space-y-2">
                    {filteredRequirements.map((requirement) => (
                      <RequirementCard 
                        key={requirement.id} 
                        requirement={requirement} 
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateCompletionStatus={handleUpdateCompletionStatus}
                        onUpdatePriority={handleUpdatePriority}
                      />
                    ))}
                  </div>
                ) : (
                  <KanbanView
                    requirements={filteredRequirements}
                    onUpdateRequirementStatus={(id, status) => 
                      handleUpdateStatus(id, status as RequirementStatusType)
                    }
                    segments={segments}
                    onRequirementClick={handleRequirementClick}
                    filters={filters}
                    onOpenFilters={handleOpenFilterModal}
                  />
                )}
              </TabsContent>
            ))}
          </div>
        </div>
      </Tabs>
    </div>
  )
}

// Exportamos esto para usarlo en el topbar
export { createRequirement } from "./actions"

// Exportamos también el tipo Segment
export type { Segment } from "./types"

// Ya no exportamos el componente para usarlo en el topbar, lo importan directamente
// export { CreateRequirementDialog } 