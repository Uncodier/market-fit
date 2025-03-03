"use client"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Checkbox } from "@/app/components/ui/checkbox"
import { PlusCircle, Filter, Search, ChevronDown, ChevronUp, XCircle, Check, Archive, RotateCcw, CheckCircle2, Ban } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { Collapsible, CollapsibleContent } from "@/app/components/ui/collapsible"
import React, { useState, useEffect } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyState } from "@/app/components/ui/empty-state"
import { useToast } from "@/app/components/ui/use-toast"
import { CreateRequirementDialog } from "@/app/components/create-requirement-dialog"
import { createRequirement, updateRequirementStatus, updateCompletionStatus } from "./actions"
import { createClient } from "@/lib/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { type Segment } from "./types"
import { SearchInput } from "@/app/components/ui/search-input"
import { FilterModal, type RequirementFilters } from "@/app/components/ui/filter-modal"

// Constantes para estados
const REQUIREMENT_STATUS = {
  VALIDATED: "validated",
  IN_PROGRESS: "in-progress",
  BACKLOG: "backlog"
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
  priority: "high" | "medium" | "low"
  status: RequirementStatusType
  completionStatus: CompletionStatusType
  source: string
  createdAt: string
  segments: string[]
  segmentNames?: string[]
}

// Define el tipo para los datos de requisitos en Supabase
interface RequirementData {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  status: RequirementStatusType
  completion_status: CompletionStatusType
  source: string
  created_at: string
  requirement_segments: Array<{ segment_id: string }> | null
}

// Define la interfaz para el segmento en Supabase
interface SegmentData {
  id: string
  name: string
  description: string
}

function RequirementCard({ requirement, onUpdateStatus, onUpdateCompletionStatus }: { 
  requirement: Requirement, 
  onUpdateStatus: (id: string, status: RequirementStatusType) => Promise<void>,
  onUpdateCompletionStatus: (id: string, status: CompletionStatusType) => Promise<void>
}) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isUpdatingCompletion, setIsUpdatingCompletion] = useState(false)
  const { toast } = useToast()

  const priorityColors = {
    high: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200",
    medium: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
    low: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200"
  }

  const statusColors = {
    [REQUIREMENT_STATUS.VALIDATED]: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
    [REQUIREMENT_STATUS.IN_PROGRESS]: "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200",
    [REQUIREMENT_STATUS.BACKLOG]: "bg-gray-50 text-gray-700 hover:bg-gray-50 border-gray-200"
  }

  const completionStatusColors = {
    [COMPLETION_STATUS.COMPLETED]: "bg-green-50 text-green-700 border-green-300",
    [COMPLETION_STATUS.REJECTED]: "bg-red-50 text-red-700 border-red-300",
    [COMPLETION_STATUS.PENDING]: "bg-yellow-50 text-yellow-700 border-yellow-300"
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

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="w-full"
    >
      <div 
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Card className="border border-border hover:border-foreground/20 transition-colors overflow-hidden">
          <div className="flex items-center pl-6 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-center p-2">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <CardContent className="flex-1 p-6 flex flex-col lg:flex-row items-start lg:items-center gap-4">
              <div className="w-full lg:w-1/4 min-w-[200px] max-w-full lg:max-w-[300px] mb-4 lg:mb-0">
                <h3 className="font-semibold text-lg truncate">{requirement.title}</h3>
                <p className="text-sm text-muted-foreground/80 truncate">{requirement.description}</p>
              </div>
              <div className="flex flex-wrap gap-6 w-full lg:w-3/4 justify-start lg:justify-between">
                <div className="min-w-[120px] sm:min-w-[100px] p-2 rounded-lg">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Priority</p>
                  <Badge variant="secondary" className={priorityColors[requirement.priority]}>
                    {requirement.priority.charAt(0).toUpperCase() + requirement.priority.slice(1)}
                  </Badge>
                </div>
                <div className="min-w-[120px] sm:min-w-[100px] p-2 rounded-lg">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Status</p>
                  <Badge variant="secondary" className={statusColors[requirement.status]}>
                    {requirement.status === REQUIREMENT_STATUS.IN_PROGRESS 
                      ? "In Progress" 
                      : requirement.status.charAt(0).toUpperCase() + requirement.status.slice(1)}
                  </Badge>
                </div>
                <div className="min-w-[120px] sm:min-w-[100px] p-2 rounded-lg">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Source</p>
                  <p className="text-sm font-medium truncate">{requirement.source}</p>
                </div>
                <div className="min-w-[120px] sm:min-w-[100px] p-2 rounded-lg">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Created</p>
                  <p className="text-sm font-medium">{new Date(requirement.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="min-w-[140px] sm:min-w-[120px] p-2 rounded-lg">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Completion</p>
                  <div className={`px-3 py-1 text-sm font-medium rounded-md border-2 text-center ${completionStatusColors[requirement.completionStatus]}`}>
                    {requirement.completionStatus.charAt(0).toUpperCase() + requirement.completionStatus.slice(1)}
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
          <CollapsibleContent>
            <CardContent className="pt-6 pb-6 px-6 border-t" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-6">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <div className="font-medium text-sm">Description</div>
                    <div className="text-sm text-muted-foreground">{requirement.description}</div>
                  </div>
                  <div className="grid gap-2">
                    <div className="font-medium text-sm">Segments</div>
                    <div className="flex flex-wrap gap-2">
                      {requirement.segmentNames?.map((segment) => (
                        <Badge
                          key={segment}
                          variant="secondary"
                          className="px-3 py-1 text-xs font-medium bg-gray-100/80 text-gray-700 hover:bg-gray-200/80 transition-colors border border-gray-200/50"
                        >
                          {segment}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                  {requirement.completionStatus === COMPLETION_STATUS.PENDING && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto bg-gray-50 hover:bg-gray-100 border-gray-200 transition-all duration-200 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpdateStatus(REQUIREMENT_STATUS.BACKLOG)
                        }}
                        disabled={isUpdatingStatus || isUpdatingCompletion}
                      >
                        <Archive className="h-4 w-4 text-gray-600" />
                        <span className="font-medium">Move to Backlog</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto bg-green-50 hover:bg-green-100 text-green-700 border-green-200 transition-all duration-200 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpdateCompletionStatus(COMPLETION_STATUS.COMPLETED)
                        }}
                        disabled={isUpdatingStatus || isUpdatingCompletion}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Mark as Done</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-700 border-red-200 transition-all duration-200 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpdateCompletionStatus(COMPLETION_STATUS.REJECTED)
                        }}
                        disabled={isUpdatingStatus || isUpdatingCompletion}
                      >
                        <Ban className="h-4 w-4" />
                        <span className="font-medium">Reject</span>
                      </Button>
                    </>
                  )}
                  {requirement.completionStatus === COMPLETION_STATUS.COMPLETED && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto bg-gray-50 hover:bg-gray-100 border-gray-200 transition-all duration-200 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpdateStatus(REQUIREMENT_STATUS.BACKLOG)
                        }}
                        disabled={isUpdatingStatus || isUpdatingCompletion}
                      >
                        <Archive className="h-4 w-4 text-gray-600" />
                        <span className="font-medium">Move to Backlog</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 transition-all duration-200 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpdateCompletionStatus(COMPLETION_STATUS.PENDING)
                        }}
                        disabled={isUpdatingStatus || isUpdatingCompletion}
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span className="font-medium">Return to Pending</span>
                      </Button>
                    </>
                  )}
                  {requirement.completionStatus === COMPLETION_STATUS.REJECTED && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto bg-gray-50 hover:bg-gray-100 border-gray-200 transition-all duration-200 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpdateStatus(REQUIREMENT_STATUS.BACKLOG)
                        }}
                        disabled={isUpdatingStatus || isUpdatingCompletion}
                      >
                        <Archive className="h-4 w-4 text-gray-600" />
                        <span className="font-medium">Move to Backlog</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 transition-all duration-200 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpdateCompletionStatus(COMPLETION_STATUS.PENDING)
                        }}
                        disabled={isUpdatingStatus || isUpdatingCompletion}
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span className="font-medium">Return to Pending</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </div>
    </Collapsible>
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
  const [filteredRequirements, setFilteredRequirements] = useState<Requirement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Estado de filtros avanzados
  const [filters, setFilters] = useState<RequirementFilters>({
    priority: [],
    completionStatus: [],
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
          .select("*, requirement_segments(segment_id)")
          .eq("site_id", siteId);
        
        if (requirementError) {
          throw new Error(`Error loading requirements: ${requirementError.message}`);
        }
        
        // Map segments to expected format
        const segments = (segmentData || []).map((segment: SegmentData) => ({
          id: segment.id,
          name: segment.name,
          description: segment.description || "",
        }));
        
        // Map requirements to expected format
        const requirements = (requirementData || []).map((req: any) => {
          // Extract related segment IDs
          const segmentIds = (req.requirement_segments || []).map((sr: any) => sr.segment_id);
          
          // Get segment names
          const segmentNames = segments
            .filter((segment: SegmentData) => segmentIds.includes(segment.id))
            .map((segment: SegmentData) => segment.name);
          
          return {
            id: req.id,
            title: req.title,
            description: req.description || "",
            priority: req.priority || "medium",
            status: req.status || "backlog",
            completionStatus: req.completion_status || "pending",
            source: req.source || "",
            createdAt: req.created_at || new Date().toISOString(),
            segments: segmentIds,
            segmentNames: segmentNames
          };
        });
        
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

  // Filtramos los requisitos por búsqueda, tab y filtros avanzados
  useEffect(() => {
    let filtered = [...requirements];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(req => 
        (req.title || "").toLowerCase().includes(query) ||
        (req.description || "").toLowerCase().includes(query) ||
        (req.source || "").toLowerCase().includes(query) ||
        (req.segmentNames || []).some(segment => 
          (segment || "").toLowerCase().includes(query)
        )
      );
    }
    
    // Apply tab filter
    if (activeTab !== "all") {
      const normalizedTab = activeTab.toLowerCase();
      filtered = filtered.filter(req => {
        if (normalizedTab === "validated") return req.status === REQUIREMENT_STATUS.VALIDATED;
        if (normalizedTab === "in-progress") return req.status === REQUIREMENT_STATUS.IN_PROGRESS;
        if (normalizedTab === "backlog") return req.status === REQUIREMENT_STATUS.BACKLOG;
        return true;
      });
    }
    
    // Apply advanced filters
    if (filters.priority.length > 0) {
      filtered = filtered.filter(req => filters.priority.includes(req.priority));
    }
    
    if (filters.completionStatus.length > 0) {
      filtered = filtered.filter(req => filters.completionStatus.includes(req.completionStatus));
    }
    
    if (filters.segments.length > 0) {
      filtered = filtered.filter(req => 
        req.segments.some(segmentId => filters.segments.includes(segmentId))
      );
    }
    
    setFilteredRequirements(filtered);
  }, [requirements, searchQuery, activeTab, filters]);
  
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
  );

  // Restaurando el componente LoadingState original
  const LoadingState = () => (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <Card key={i} className="overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row items-start gap-4">
              <div className="w-full lg:w-1/4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="flex flex-wrap gap-6 w-full lg:w-3/4">
                <div className="min-w-[120px]">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="min-w-[120px]">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="min-w-[120px]">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="min-w-[120px]">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="min-w-[120px]">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  const EmptyResults = () => (
    <div className="flex flex-col items-center justify-center p-8 text-center h-[300px]">
      <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-xl font-medium mb-2">No requirements found</h3>
      <p className="text-muted-foreground max-w-md mb-4">
        {searchQuery
          ? "No results for your search. Try with other terms."
          : requirements.length > 0 
            ? `There are ${requirements.length} requirements in the database, but none match the current filter (${activeTab}).`
            : "No requirements created yet. Create a new one to start."
        }
      </p>
      <Button 
        onClick={() => window.location.reload()} 
        variant="outline"
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Reload data
      </Button>
    </div>
  );

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

  return (
    <div className="flex-1 p-0">
      {/* Loading indicator */}
      {isLoading && (
        <div className="fixed bottom-4 right-4 bg-blue-100 text-blue-800 p-4 rounded-md shadow-md z-50 animate-pulse">
          Loading requirements...
        </div>
      )}
      
      {/* Modal de filtros */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        segments={segments}
        completionStatusOptions={[COMPLETION_STATUS.PENDING, COMPLETION_STATUS.COMPLETED, COMPLETION_STATUS.REJECTED]}
      />
      
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <TabsList className="w-full">
                  <TabsTrigger value="all">All Requirements</TabsTrigger>
                  <TabsTrigger value="validated">Validated</TabsTrigger>
                  <TabsTrigger value="in-progress">In Progress</TabsTrigger>
                  <TabsTrigger value="backlog">Backlog</TabsTrigger>
                </TabsList>
              </div>
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
              {/* Indicador de filtros activos */}
              {(filters.priority.length > 0 || filters.completionStatus.length > 0 || filters.segments.length > 0) && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  <Badge variant="outline" className="rounded-full px-2 py-0">
                    {filters.priority.length + filters.completionStatus.length + filters.segments.length}
                  </Badge>
                  <span className="ml-2">Clear filters</span>
                </Button>
              )}
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            {/* Rendering for all tabs */}
            {["all", "validated", "in-progress", "backlog"].map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-4 min-h-[300px]">
                {/* Case 1: No site selected */}
                {!currentSite ? (
                  <NoSiteSelected />
                ) : 
                /* Case 2: Visible error */
                visibleError ? (
                  <div className="p-4 border border-red-300 bg-red-50 rounded-md text-red-800 mb-4">
                    <h3 className="font-semibold mb-2">Error loading requirements</h3>
                    <p>{visibleError}</p>
                    <button 
                      onClick={() => window.location.reload()} 
                      className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md"
                    >
                      Retry
                    </button>
                  </div>
                ) : 
                /* Case 3: Loading */
                isLoading ? (
                  <LoadingState />
                ) : 
                /* Case 4: No filtered requirements to show */
                filteredRequirements.length === 0 ? (
                  <EmptyResults />
                ) : 
                /* Case 5: Show requirements */
                (
                  <div className="space-y-2">
                    {filteredRequirements.map((requirement) => (
                      <RequirementCard 
                        key={requirement.id} 
                        requirement={requirement} 
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateCompletionStatus={handleUpdateCompletionStatus}
                      />
                    ))}
                  </div>
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