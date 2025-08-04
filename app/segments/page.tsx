"use client"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { ChevronDown, ChevronRight, ChevronUp, Copy, Globe, PlusCircle, Search, HelpCircle } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible"
import { useState, useEffect, useCallback, useRef } from "react"
import { Badge } from "@/app/components/ui/badge"
import { Switch } from "@/app/components/ui/switch"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/app/components/ui/dialog"
import { getSegments, createSegment, type SegmentResponse, updateSegmentUrl, updateSegmentStatus } from "./actions"
import { EmptyState } from "@/app/components/ui/empty-state"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { Segment } from "@/app/types/segments"
import { useRouter } from "next/navigation"


type AdPlatform = "facebook" | "google" | "linkedin" | "twitter"

// Función auxiliar para manejar valores no disponibles
function getDisplayValue(value: string | number | null | undefined, type: 'text' | 'number' = 'text'): string {
  if (value === undefined || value === null || value === '') return 'N/A'
  if (type === 'number' && typeof value === 'number') return value.toLocaleString()
  return String(value)
}

// Función auxiliar para manejar keywords vacíos
function getKeywords(segment: Segment, platform: AdPlatform): string[] {
  return segment.analysis?.[platform] || []
}

// Función auxiliar para manejar hot topics vacíos
function getHotTopics(segment: Segment, type: 'blog' | 'newsletter'): string[] {
  return segment.topics?.[type] || []
}

// Componente reutilizable para la tarjeta de segmento
function SegmentCard({
  segment,
  isExpanded,
  onToggle,
  activeSegments,
  toggleSegmentStatus,
  selectedAdPlatforms,
  handlePlatformChange,
  copiedStates,
  copyToClipboard,
  copySegmentUrl,
  iframeLoading,
  handleIframeLoad,
  handleConfigureUrl,
  navigateToSegmentDetail
}: {
  segment: Segment;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  activeSegments: Record<string, boolean>;
  toggleSegmentStatus: (id: string) => void;
  selectedAdPlatforms: Record<string, AdPlatform>;
  handlePlatformChange: (id: string, platform: AdPlatform) => void;
  copiedStates: Record<string, { keywords: boolean, url: boolean }>;
  copyToClipboard: (segmentId: string, keywords: string[]) => void;
  copySegmentUrl: (segmentId: string) => void;
  iframeLoading: Record<string, boolean>;
  handleIframeLoad: (id: string) => void;
  handleConfigureUrl: (segmentId: string) => void;
  navigateToSegmentDetail: (id: string) => void;
}) {
  return (
    <Collapsible
      key={segment.id}
      open={isExpanded}
      onOpenChange={() => {}} // Disable automatic toggle
      className="w-full"
    >
      <div 
        className="cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          navigateToSegmentDetail(segment.id);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle(segment.id);
        }}
      >
        <Card className="border border-border hover:border-foreground/20 transition-colors overflow-hidden">
          <div className="flex items-center hover:bg-muted/50 transition-colors w-full">
            <CardContent className="flex-1 p-4 w-full overflow-x-auto">
              <div className="flex items-start gap-4 min-w-[1000px]">
                <div className="w-[500px] min-w-[500px] pr-2 flex-grow">
                  <h3 className="font-semibold text-lg truncate">{segment.name}</h3>
                  <p className="text-sm text-muted-foreground/80 truncate">
                    {segment.description || 'No description available'}
                  </p>
                </div>
                <div className="w-[120px] min-w-[120px] flex-shrink-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Audience</p>
                  <p className="text-sm font-medium truncate text-center">{getDisplayValue(segment.audience)}</p>
                </div>
                <div className="w-[80px] min-w-[80px] flex-shrink-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Language</p>
                  <p className="text-sm font-medium text-center">{segment.language ? segment.language.toUpperCase() : 'N/A'}</p>
                </div>
                <div className="w-[80px] min-w-[80px] flex-shrink-0 hidden lg:block">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Size</p>
                  <p className="text-sm font-medium text-center">{getDisplayValue(segment.size, 'number')}</p>
                </div>
                <div className="w-[80px] min-w-[80px] flex-shrink-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Engagement</p>
                  <p className="text-sm font-medium text-center">{segment.engagement ? `${segment.engagement}%` : 'N/A'}</p>
                </div>
                <div className="w-[120px] min-w-[120px] flex-shrink-0 pl-4" onClick={(e) => e.stopPropagation()}>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-center">Status</p>
                  <div className="flex items-center justify-center gap-0.5">
                    <span className={`text-xs font-medium text-center truncate ${activeSegments[segment.id] ? 'text-green-500' : 'text-yellow-500'}`}>
                      {activeSegments[segment.id] ? "Active" : "Draft"}
                    </span>
                    <Switch 
                      checked={activeSegments[segment.id]} 
                      onCheckedChange={() => toggleSegmentStatus(segment.id)}
                      className="data-[state=checked]:bg-[#90ff17] data-[state=checked]:hover:bg-[#90ff17] bg-muted hover:bg-muted flex-shrink-0 ml-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-6 px-6 border-t" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => copySegmentUrl(segment.id)}
                      className="flex items-center justify-center hover:bg-secondary/80 transition-colors relative min-w-[160px]"
                      disabled={!segment.url || copiedStates[segment.id]?.url}
                    >
                      <div className="flex items-center justify-center min-w-0">
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        <span className="transition-all duration-200">
                          {copiedStates[segment.id]?.url ? "Copied!" : "Copy Segment URL"}
                        </span>
                      </div>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleConfigureUrl(segment.id)}
                      className="flex items-center justify-center hover:bg-secondary/80 transition-colors relative min-w-[160px]"
                    >
                      <div className="flex items-center justify-center min-w-0">
                        <Globe className="h-3.5 w-3.5 mr-1.5" />
                        <span className="transition-all duration-200">
                          Set Segment URL
                        </span>
                      </div>
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="flex items-center justify-center hover:bg-primary/10 transition-all duration-200 relative min-w-[160px]"
                    >
                      <div className="flex items-center justify-center min-w-0">
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          className="h-3.5 w-3.5 mr-1.5"
                        >
                          <path d="M12 2a10 10 0 1 0 10 10H12V2z" />
                          <path d="M12 2a10 10 0 0 1 10 10h-10V2z" />
                          <path d="M12 22v-10h10" />
                          <path d="M7 7l5 5" />
                        </svg>
                        <span className="transition-all duration-200">
                          Personalize with AI
                        </span>
                      </div>
                    </Button>
                  </div>
                </div>
                <div className="relative mt-6 border-t pt-4">
                  <div className="w-full h-[500px] bg-background rounded-md border">
                    {iframeLoading[segment.id] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground/20"></div>
                      </div>
                    )}
                    {segment.url ? (
                      <div className="relative w-full h-[500px] overflow-hidden flex items-center justify-center">
                        <iframe
                          src={segment.url}
                          className="absolute w-[150%] h-[150%] origin-center rounded-md"
                          style={{ transform: 'scale(0.65)', transformOrigin: 'center' }}
                          onLoad={() => handleIframeLoad(segment.id)}
                          sandbox="allow-same-origin allow-scripts"
                          loading="lazy"
                          allow="fullscreen"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full space-y-4 p-6">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                          <Globe className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div className="text-center space-y-2">
                          <h3 className="font-semibold text-lg">No URL Available</h3>
                          <p className="text-sm text-muted-foreground max-w-md">
                            This segment doesn't have a URL configured yet. Once configured, you'll be able to preview the segment content here.
                          </p>
                        </div>
                        <Button 
                          variant="outline"
                          onClick={() => handleConfigureUrl(segment.id)}
                          className="mt-4"
                        >
                          Configure URL
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-4 mt-6 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-base">Hot Topics</h4>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="flex items-center justify-center hover:bg-primary/10 transition-all duration-200 relative"
                    >
                      <div className="flex items-center justify-center min-w-0">
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          className="h-3.5 w-3.5 mr-1.5"
                        >
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          <line x1="11" y1="8" x2="11" y2="14" />
                          <line x1="8" y1="11" x2="14" y2="11" />
                        </svg>
                        <span className="transition-all duration-200">
                          Discover with AI
                        </span>
                      </div>
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium text-muted-foreground">Blog Ideas</h5>
                      <div className="flex flex-wrap gap-2 bg-background/50 p-3 rounded-lg">
                        {getHotTopics(segment, 'blog').length > 0 ? (
                          getHotTopics(segment, 'blog').map((topic, idx) => (
                            <Badge 
                              key={idx} 
                              variant="secondary"
                              className="px-3 py-1 cursor-pointer hover:bg-secondary/80 transition-colors text-xs sm:text-sm"
                            >
                              {topic}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No blog topics available</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h5 className="text-sm font-medium text-muted-foreground">Newsletter Content</h5>
                      <div className="flex flex-wrap gap-2 bg-background/50 p-3 rounded-lg">
                        {getHotTopics(segment, 'newsletter').length > 0 ? (
                          getHotTopics(segment, 'newsletter').map((topic, idx) => (
                            <Badge 
                              key={idx}
                              variant="secondary"
                              className="px-3 py-1 cursor-pointer hover:bg-secondary/80 transition-colors text-xs sm:text-sm"
                            >
                              {topic}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No newsletter topics available</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </div>
    </Collapsible>
  )
}

function SegmentRowSkeleton() {
  return (
    <Card className="border border-border overflow-hidden">
      <div className="flex items-center">
        <CardContent className="flex-1 p-4 w-full overflow-x-auto">
          <div className="flex items-start gap-4 min-w-[1000px]">
            <div className="w-[500px] min-w-[500px] pr-2 flex-grow space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="w-[120px] min-w-[120px] flex-shrink-0">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4 mx-auto" />
            </div>
            <div className="w-[80px] min-w-[80px] flex-shrink-0">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-1/2 mx-auto" />
            </div>
            <div className="w-[80px] min-w-[80px] flex-shrink-0 hidden lg:block">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3 mx-auto" />
            </div>
            <div className="w-[80px] min-w-[80px] flex-shrink-0">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-1/2 mx-auto" />
            </div>
            <div className="w-[120px] min-w-[120px] flex-shrink-0 pl-4">
              <Skeleton className="h-4 w-full mb-2" />
              <div className="flex items-center justify-center gap-0.5">
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-5 w-10 rounded-full flex-shrink-0 ml-1" />
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([])
  const [filteredSegments, setFilteredSegments] = useState<Segment[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [selectedAdPlatforms, setSelectedAdPlatforms] = useState<Record<string, AdPlatform>>({})
  const [activeSegments, setActiveSegments] = useState<Record<string, boolean>>({})
  const [iframeLoading, setIframeLoading] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copiedStates, setCopiedStates] = useState<Record<string, { keywords: boolean, url: boolean }>>({})
  const { currentSite } = useSite()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [initialFetchDone, setInitialFetchDone] = useState(false)
  const [loadAttemptsCount, setLoadAttemptsCount] = useState(0)
  const router = useRouter()



  // Manejador de cambio del input
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  // Función para filtrar segmentos
  const filterSegments = useCallback((term: string) => {
    if (!term.trim()) {
      setFilteredSegments(segments)
      return
    }

    const searchLower = term.toLowerCase()
    const filtered = segments.filter(segment => 
      segment.name.toLowerCase().includes(searchLower) ||
      segment.description?.toLowerCase().includes(searchLower) ||
      segment.audience?.toLowerCase().includes(searchLower) ||
      segment.icp?.role?.toLowerCase().includes(searchLower) ||
      segment.icp?.company_size?.toLowerCase().includes(searchLower) ||
      segment.icp?.industry?.toLowerCase().includes(searchLower) ||
      segment.icp?.age_range?.toLowerCase().includes(searchLower) ||
      segment.icp?.pain_points?.some(painPoint => painPoint.toLowerCase().includes(searchLower)) ||
      segment.icp?.goals?.some(goal => goal.toLowerCase().includes(searchLower)) ||
      segment.icp?.budget?.toLowerCase().includes(searchLower) ||
      segment.icp?.decision_maker === true ||
      segment.icp?.location?.toLowerCase().includes(searchLower) ||
      segment.icp?.experience?.toLowerCase().includes(searchLower) ||
      segment.analysis?.[selectedAdPlatforms[segment.id] || "facebook"]?.some(keyword => 
        keyword.toLowerCase().includes(searchLower)
      )
    )
    setFilteredSegments(filtered)
  }, [segments, selectedAdPlatforms])

  // Función para recargar los segmentos
  const retryLoadSegments = () => {
    setError(null)
    setLoadAttemptsCount(prev => prev + 1)
  }

  // Efecto para manejar el atajo de teclado Command+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Efecto para actualizar los segmentos filtrados cuando cambia el término de búsqueda
  useEffect(() => {
    filterSegments(searchTerm)
  }, [searchTerm, filterSegments])

  // Efecto para inicializar los segmentos filtrados cuando se cargan los segmentos
  useEffect(() => {
    setFilteredSegments(segments)
  }, [segments])

  // Efecto para cargar los segmentos
  useEffect(() => {
    const fetchSegments = async () => {
      try {
        if (initialFetchDone && loadAttemptsCount === 0) return;
        
        setIsLoading(true);
        setError(null);
        
        // Verificar si tenemos un sitio seleccionado
        if (!currentSite?.id) {
          setIsLoading(false);
          return;
        }
        
        console.log("Cargando segmentos para el sitio:", currentSite.id);
        
        try {
          const result = await getSegments(currentSite.id);
          
          if (result.error) {
            setError(result.error);
            setIsLoading(false);
            return;
          }
          
          const loadedSegments = result.segments || [];
          console.log(`Se cargaron ${loadedSegments.length} segmentos`);
          
          // Procesar los segmentos cargados
          const processedSegments = loadedSegments.map((segment: any) => {
            // Procesar el ICP
            let icpObject = segment.icp;
            if (!icpObject || typeof icpObject === 'string') {
              icpObject = {
                role: typeof icpObject === 'string' ? icpObject : '',
                company_size: '',
                industry: '',
                age_range: '',
                pain_points: [],
                goals: [],
                budget: '',
                decision_maker: false,
                location: '',
                experience: ''
              };
            }
            
            // Crear el segmento procesado
            return {
              ...segment,
              // Usar analysis directamente ya que keywords ya no existe
              analysis: segment.analysis || null,
              // Usar topics directamente ya que hot_topics ya no existe
              topics: segment.topics || null,
              // Usar el ICP estructurado
              icp: icpObject
            };
          });
          
          // Actualizar el estado de segmentos
          setSegments(processedSegments as Segment[]);
          
          // Crear objetos para los estados
          const expandedRowsObj: Record<string, boolean> = {};
          const adPlatformsObj: Record<string, AdPlatform> = {};
          const activeSegmentsObj: Record<string, boolean> = {};
          const iframeLoadingObj: Record<string, boolean> = {};
          
          // Inicializar los estados para cada segmento
          processedSegments.forEach((segment: any) => {
            expandedRowsObj[segment.id] = false;
            adPlatformsObj[segment.id] = "facebook";
            activeSegmentsObj[segment.id] = segment.is_active;
            iframeLoadingObj[segment.id] = false;
          });
          
          // Actualizar los estados
          setExpandedRows(expandedRowsObj);
          setSelectedAdPlatforms(adPlatformsObj);
          setActiveSegments(activeSegmentsObj);
          setIframeLoading(iframeLoadingObj);
          
          // Marcar como completado
          setError(null);
          setInitialFetchDone(true);
        } catch (innerError) {
          console.error("Error llamando a getSegments:", innerError);
          setError("Error al cargar los segmentos. Por favor, intenta nuevamente.");
        }
      } catch (err) {
        console.error("Error loading segments:", err);
        setError("Error al cargar los segmentos. Por favor, intenta nuevamente.");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSegments();
  }, [currentSite?.id, initialFetchDone, loadAttemptsCount]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const navigateToSegmentDetail = (id: string) => {
    router.push(`/segments/${id}`)
  }

  const handlePlatformChange = (id: string, platform: AdPlatform) => {
    setSelectedAdPlatforms(prev => ({
      ...prev,
      [id]: platform
    }))
  }

  const toggleSegmentStatus = async (id: string) => {
    setActiveSegments(prev => {
      const newState = !prev[id]
      
      // Optimistic update
      const newActiveSegments = {
        ...prev,
        [id]: newState
      }
      
      // Actualizar en la base de datos
      updateSegmentStatus({
        segmentId: id,
        isActive: newState
      }).catch((error: Error) => {
        // Revertir en caso de error
        console.error('Error updating segment status:', error)
        setActiveSegments(prev)
      })
      
      return newActiveSegments
    })
  }

  const copyToClipboard = async (segmentId: string, keywords: string[]) => {
    try {
      await navigator.clipboard.writeText(keywords.join(", "))
      setCopiedStates(prev => ({
        ...prev,
        [segmentId]: {
          ...prev[segmentId],
          keywords: true
        }
      }))
      setTimeout(() => {
        setCopiedStates(prev => ({
          ...prev,
          [segmentId]: {
            ...prev[segmentId],
            keywords: false
          }
        }))
      }, 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  const copySegmentUrl = async (segmentId: string) => {
    try {
      const segment = segments.find(s => s.id === segmentId)
      if (!segment?.url) return

      await navigator.clipboard.writeText(segment.url)
      setCopiedStates(prev => ({
        ...prev,
        [segmentId]: {
          ...prev[segmentId],
          url: true
        }
      }))
      setTimeout(() => {
        setCopiedStates(prev => ({
          ...prev,
          [segmentId]: {
            ...prev[segmentId],
            url: false
          }
        }))
      }, 2000)
    } catch (err) {
      console.error('Error copying segment URL:', err)
    }
  }

  const viewExperiment = (id: string) => {
    // Esta función se implementaría para ver el experimento
    console.log(`Viewing experiment for segment ${id}`)
  }

  const handleIframeLoad = (id: string) => {
    setIframeLoading(prev => ({
      ...prev,
      [id]: false
    }))
  }

  const handleConfigureUrl = (segmentId: string) => {
    const segment = segments.find(s => s.id === segmentId)
    setSelectedSegmentId(segmentId)
    setUrlInput(segment?.url || "")
    setIsUrlModalOpen(true)
  }

  const handleSaveUrl = async () => {
    if (!selectedSegmentId) return
    
    try {
      setIsSaving(true)
      setSaveError(null)
      
      const result = await updateSegmentUrl({
        segmentId: selectedSegmentId,
        url: urlInput
      })
      
      if (result.error) {
        setSaveError(result.error)
        return
      }

      setSegments(prevSegments => 
        prevSegments.map(segment => 
          segment.id === selectedSegmentId 
            ? { ...segment, url: urlInput }
            : segment
        )
      )
      
      setIsUrlModalOpen(false)
      setSelectedSegmentId(null)
      setUrlInput("")
    } catch (err) {
      console.error("Error saving segment URL:", err)
      setSaveError("Error al guardar la URL del segmento")
    } finally {
      setIsSaving(false)
    }
  }

  const segmentsEmptyState = (
    <EmptyState
      title="No segments yet"
      description="Segments help you organize and target specific audience groups based on behavior and engagement."
      features={[
        {
          title: "Marketing",
          items: [
            "Create targeted campaigns",
            "Optimize ad performance"
          ]
        },
        {
          title: "Content",
          items: [
            "Generate blog ideas",
            "Plan newsletters"
          ]
        }
      ]}
      hint='Click "New Segment" in the top bar to create your first segment'
    />
  )

  if (isLoading) {
    return (
      <div className="flex-1 p-0">
        <Tabs defaultValue="all">
          <StickyHeader>
            <div className="px-16 pt-0">
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-8">
                  <TabsList>
                    <TabsTrigger value="all">All Segments</TabsTrigger>
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="draft">Draft</TabsTrigger>
                  </TabsList>
                  <div className="relative w-64">
                    <Input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search segments..."
                      className="w-full"
                      value={searchTerm}
                      onChange={handleSearchChange}
                      icon={<Search className="h-4 w-4 text-muted-foreground" />}
                    />
                    <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                      <span className="text-xs">⌘</span>K
                    </kbd>
                  </div>
                </div>
                <div className="ml-auto">
                  {/* Any other buttons would go here */}
                </div>
              </div>
            </div>
          </StickyHeader>
          <div className="p-8 space-y-4">
            <div className="px-8">
              <TabsContent value="all" className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <SegmentRowSkeleton key={index} />
                ))}
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-4">
          <p className="text-red-500 mb-4">{error}</p>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ocurrió un error al cargar los segmentos. Esto puede deberse a problemas de conexión.
            </p>
            <p className="text-xs text-muted-foreground">
              Sitio actual: {currentSite ? `${currentSite.name} (${currentSite.id})` : 'Ninguno seleccionado'}
            </p>
            <Button 
              variant="outline" 
              onClick={retryLoadSegments}
            >
              Intentar nuevamente
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="all">All Segments</TabsTrigger>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="draft">Draft</TabsTrigger>
                </TabsList>
                <div className="relative w-64">
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search segments..."
                    className="w-full"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    icon={<Search className="h-4 w-4 text-muted-foreground" />}
                  />
                  <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </div>
              </div>
              <div className="ml-auto">
                {/* Buttons are handled by TopBarActions */}
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            <TabsContent value="all" className="space-y-4">
              {filteredSegments.length === 0 && searchTerm ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <p className="text-muted-foreground">No se encontraron segmentos que coincidan con "{searchTerm}"</p>
                </div>
              ) : filteredSegments.length === 0 ? (
                segmentsEmptyState
              ) : (
                <div className="space-y-2">
                  {filteredSegments.map((segment) => (
                    <SegmentCard
                      key={segment.id}
                      segment={segment}
                      isExpanded={expandedRows[segment.id]}
                      onToggle={toggleRow}
                      activeSegments={activeSegments}
                      toggleSegmentStatus={toggleSegmentStatus}
                      selectedAdPlatforms={selectedAdPlatforms}
                      handlePlatformChange={handlePlatformChange}
                      copiedStates={copiedStates}
                      copyToClipboard={copyToClipboard}
                      copySegmentUrl={copySegmentUrl}
                      iframeLoading={iframeLoading}
                      handleIframeLoad={handleIframeLoad}
                      handleConfigureUrl={handleConfigureUrl}
                      navigateToSegmentDetail={navigateToSegmentDetail}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="active" className="space-y-4">
              {segments.filter(segment => activeSegments[segment.id]).length === 0 ? (
                segmentsEmptyState
              ) : (
                <div className="space-y-2">
                  {segments
                    .filter((segment: Segment) => activeSegments[segment.id])
                    .map((segment: Segment) => (
                      <SegmentCard
                        key={segment.id}
                        segment={segment}
                        isExpanded={expandedRows[segment.id]}
                        onToggle={toggleRow}
                        activeSegments={activeSegments}
                        toggleSegmentStatus={toggleSegmentStatus}
                        selectedAdPlatforms={selectedAdPlatforms}
                        handlePlatformChange={handlePlatformChange}
                        copiedStates={copiedStates}
                        copyToClipboard={copyToClipboard}
                        copySegmentUrl={copySegmentUrl}
                        iframeLoading={iframeLoading}
                        handleIframeLoad={handleIframeLoad}
                        handleConfigureUrl={handleConfigureUrl}
                        navigateToSegmentDetail={navigateToSegmentDetail}
                      />
                    ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="draft" className="space-y-4">
              {segments.filter(segment => !activeSegments[segment.id]).length === 0 ? (
                segmentsEmptyState
              ) : (
                <div className="space-y-2">
                  {segments
                    .filter((segment: Segment) => !activeSegments[segment.id])
                    .map((segment: Segment) => (
                      <SegmentCard
                        key={segment.id}
                        segment={segment}
                        isExpanded={expandedRows[segment.id]}
                        onToggle={toggleRow}
                        activeSegments={activeSegments}
                        toggleSegmentStatus={toggleSegmentStatus}
                        selectedAdPlatforms={selectedAdPlatforms}
                        handlePlatformChange={handlePlatformChange}
                        copiedStates={copiedStates}
                        copyToClipboard={copyToClipboard}
                        copySegmentUrl={copySegmentUrl}
                        iframeLoading={iframeLoading}
                        handleIframeLoad={handleIframeLoad}
                        handleConfigureUrl={handleConfigureUrl}
                        navigateToSegmentDetail={navigateToSegmentDetail}
                      />
                    ))}
                </div>
              )}
            </TabsContent>
          </div>
        </div>
      </Tabs>
      <Dialog open={isUrlModalOpen} onOpenChange={setIsUrlModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Configure Segment URL</DialogTitle>
            <DialogDescription>
              Enter the URL where this segment's content can be previewed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <div className="relative">
                <Globe className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                <Input
                  id="url"
                  placeholder="https://example.com/segment-preview"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full h-12 pl-10"
                  disabled={isSaving}
                />
              </div>
              {saveError && (
                <p className="text-sm text-red-500 mt-2">{saveError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsUrlModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveUrl}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-r-foreground" />
                  Saving...
                </>
              ) : (
                'Save URL'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}