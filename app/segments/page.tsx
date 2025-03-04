"use client"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { ChevronDown, ChevronRight, ChevronUp, Copy, Globe, PlusCircle, Search } from "@/app/components/ui/icons"
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

type AdPlatform = "facebook" | "google" | "linkedin" | "twitter"

interface Segment {
  id: string
  name: string
  description: string | null
  audience: string | null
  language: string | null
  size: number | null
  engagement: number | null
  created_at: string
  url: string | null
  keywords: Record<string, string[]> | null
  hot_topics: {
    blog: string[]
    newsletter: string[]
  } | null
  is_active: boolean
}

const segments: Segment[] = [
  {
    id: "1",
    name: "Early Adopters",
    description: "Tech-savvy users who are first to try new products",
    audience: "Tech Enthusiasts",
    language: "en",
    size: 2500,
    engagement: 78,
    created_at: "2023-10-15",
    url: null,
    keywords: {
      facebook: ["innovation", "tech trends", "early access", "beta testing", "product launch"],
      google: ["new technology", "tech innovation", "early adopter", "beta program", "tech preview"],
      linkedin: ["technology pioneers", "innovation leaders", "early tech adopters", "product beta", "tech trends"],
      twitter: ["#TechTrends", "#Innovation", "#EarlyAdopter", "#ProductLaunch", "#BetaTesting"]
    },
    hot_topics: {
      blog: [
        "The Future of Tech: What Early Adopters Are Loving",
        "5 Emerging Technologies Worth Your Attention",
        "Why Beta Testing is Critical for Product Success",
        "Innovation Trends: A Deep Dive into Early Adoption",
        "From Early Adopter to Product Champion"
      ],
      newsletter: [
        "Weekly Tech Radar: What's Hot in Innovation",
        "Beta Testing Opportunities Roundup",
        "Early Access Exclusive Updates",
        "Innovation Insider Weekly Brief"
      ]
    },
    is_active: true
  },
  {
    id: "2",
    name: "Enterprise Decision Makers",
    description: "C-level executives in large corporations",
    audience: "Enterprise",
    language: "en",
    size: 1200,
    engagement: 45,
    created_at: "2023-11-02",
    url: null,
    keywords: {
      facebook: ["enterprise solutions", "executive leadership", "corporate strategy", "business transformation", "C-suite"],
      google: ["enterprise software", "executive decision makers", "C-level", "corporate leadership", "business strategy"],
      linkedin: ["enterprise leadership", "executive decision making", "C-suite professionals", "corporate strategy", "business transformation"],
      twitter: ["#EnterpriseTech", "#ExecutiveLeadership", "#CorporateStrategy", "#BusinessTransformation", "#CSuite"]
    },
    hot_topics: {
      blog: [
        "Digital Transformation: A C-Suite Perspective",
        "Enterprise Strategy in the AI Era",
        "Leadership Insights: Navigating Corporate Change",
        "The Future of Enterprise Technology",
        "Strategic Decision Making in Uncertain Times"
      ],
      newsletter: [
        "Executive Brief: Weekly Market Insights",
        "Enterprise Technology Trends",
        "C-Suite Strategy Digest",
        "Corporate Innovation Weekly"
      ]
    },
    is_active: true
  },
  {
    id: "3",
    name: "Small Business Owners",
    description: "Entrepreneurs and small business operators",
    audience: "SMB",
    language: "en",
    size: 3800,
    engagement: 62,
    created_at: "2023-11-18",
    url: null,
    keywords: {
      facebook: ["small business", "entrepreneur", "business growth", "local business", "startup"],
      google: ["small business solutions", "entrepreneur tools", "business growth strategies", "local business marketing", "startup resources"],
      linkedin: ["small business network", "entrepreneur community", "business growth", "local business owners", "startup founders"],
      twitter: ["#SmallBusiness", "#Entrepreneur", "#BusinessGrowth", "#LocalBusiness", "#Startup"]
    },
    hot_topics: {
      blog: [
        "Small Business Growth Strategies for 2024",
        "How to Scale Your Local Business",
        "Essential Tools for Modern Entrepreneurs",
        "From Startup to Success: Real Stories",
        "Marketing on a Budget: SMB Guide"
      ],
      newsletter: [
        "Weekly SMB Success Stories",
        "Local Business Opportunities",
        "Entrepreneur's Resource Roundup",
        "Small Business Tech Updates"
      ]
    },
    is_active: true
  },
  {
    id: "4",
    name: "Marketing Professionals",
    description: "Marketing managers and specialists",
    audience: "B2B",
    language: "en",
    size: 2100,
    engagement: 56,
    created_at: "2023-12-05",
    url: null,
    keywords: {
      facebook: ["marketing strategy", "digital marketing", "marketing tools", "campaign management", "marketing ROI"],
      google: ["marketing professionals", "digital marketing tools", "marketing strategy", "campaign optimization", "marketing analytics"],
      linkedin: ["marketing leadership", "digital marketing experts", "marketing strategy", "campaign management", "marketing analytics"],
      twitter: ["#MarketingStrategy", "#DigitalMarketing", "#MarketingTools", "#CampaignManagement", "#MarketingROI"]
    },
    hot_topics: {
      blog: [
        "Digital Marketing Trends to Watch",
        "AI in Marketing: A Practical Guide",
        "Data-Driven Marketing Strategies",
        "Content Marketing Excellence",
        "Marketing Analytics Deep Dive"
      ],
      newsletter: [
        "Marketing Tech Weekly",
        "Campaign Performance Insights",
        "Digital Marketing Innovation Digest",
        "Marketing Analytics Report"
      ]
    },
    is_active: true
  },
  {
    id: "5",
    name: "Product Managers",
    description: "Product leaders in tech companies",
    audience: "Tech",
    language: "en",
    size: 1800,
    engagement: 71,
    created_at: "2024-01-10",
    url: null,
    keywords: {
      facebook: ["product management", "product strategy", "product development", "user experience", "product roadmap"],
      google: ["product management tools", "product strategy framework", "product development process", "UX design", "product roadmap planning"],
      linkedin: ["product leadership", "product strategy", "product development", "user experience design", "product roadmap"],
      twitter: ["#ProductManagement", "#ProductStrategy", "#ProductDevelopment", "#UXDesign", "#ProductRoadmap"]
    },
    hot_topics: {
      blog: [
        "Product-Led Growth Strategies",
        "Building User-Centric Products",
        "Product Metrics That Matter",
        "From MVP to Enterprise Product",
        "Product Strategy in the AI Era"
      ],
      newsletter: [
        "Product Innovation Weekly",
        "UX Research Insights",
        "Product Management Trends",
        "Tech Product Leaders Digest"
      ]
    },
    is_active: true
  },
]

// Función auxiliar para manejar valores no disponibles
function getDisplayValue(value: string | number | null | undefined, type: 'text' | 'number' = 'text'): string {
  if (value === undefined || value === null || value === '') return 'N/A'
  if (type === 'number' && typeof value === 'number') return value.toLocaleString()
  return String(value)
}

// Función auxiliar para manejar keywords vacíos
function getKeywords(segment: Segment, platform: AdPlatform): string[] {
  return segment.keywords?.[platform] || []
}

// Función auxiliar para manejar hot topics vacíos
function getHotTopics(segment: Segment, type: 'blog' | 'newsletter'): string[] {
  return segment.hot_topics?.[type] || []
}

function SegmentRowSkeleton() {
  return (
    <Card className="border border-border overflow-hidden">
      <div className="flex items-center pl-6">
        <div className="flex items-center justify-center p-2">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardContent className="flex-1 p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="w-full lg:w-[320px] min-w-[280px] max-w-[320px] mb-4 lg:mb-0 shrink-0 space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-[180px_100px_120px_120px_120px_160px] gap-2 sm:gap-4 w-full lg:max-w-[900px]">
            <div className="p-2 rounded-lg">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="p-2 rounded-lg">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="hidden lg:block p-2 rounded-lg">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="p-2 rounded-lg">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="hidden lg:block p-2 rounded-lg">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="bg-background/50 p-2 rounded-lg col-span-2 sm:col-span-2 lg:col-span-1">
              <Skeleton className="h-4 w-full mb-2" />
              <div className="flex items-center justify-end gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-10 rounded-full" />
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
      segment.keywords?.[selectedAdPlatforms[segment.id] || "facebook"]?.some(keyword => 
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

  // Efecto para cargar los segmentos - Usando Supabase directamente como en la función getSegments original
  useEffect(() => {
    const fetchSegments = async () => {
      try {
        if (initialFetchDone && loadAttemptsCount === 0) return;
        
        setIsLoading(true);
        setError(null);
        
        // Verificar si tenemos un sitio seleccionado
        if (!currentSite?.id) {
          setError("Por favor, selecciona un sitio primero");
          setIsLoading(false);
          return;
        }
        
        console.log("Cargando segmentos para el sitio:", currentSite.id);
        
        // Volver a usar getSegments que sabemos que funciona
        try {
          const result = await getSegments(currentSite.id);
          
          console.log("Resultado de getSegments:", result);
          
          if (result.error) {
            setError(result.error);
            setIsLoading(false);
            return;
          }
          
          const loadedSegments = result.segments || [];
          console.log(`Se cargaron ${loadedSegments.length} segmentos`);
          
          setSegments(loadedSegments);
          
          // Inicializar estados para los nuevos segmentos
          const newExpandedRows: Record<string, boolean> = {}
          const newSelectedAdPlatforms: Record<string, AdPlatform> = {}
          const newActiveSegments: Record<string, boolean> = {}
          const newIframeLoading: Record<string, boolean> = {}
          
          loadedSegments.forEach((segment: Segment) => {
            newExpandedRows[segment.id] = false
            newSelectedAdPlatforms[segment.id] = "facebook"
            newActiveSegments[segment.id] = segment.is_active
            newIframeLoading[segment.id] = false
          })
          
          setExpandedRows(newExpandedRows)
          setSelectedAdPlatforms(newSelectedAdPlatforms)
          setActiveSegments(newActiveSegments)
          setIframeLoading(newIframeLoading)
          
          // Si llegamos aquí, todo fue exitoso, así que limpiamos cualquier error
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
                <div className="flex-1">
                  <TabsList className="w-full">
                    <TabsTrigger value="all">All Segments</TabsTrigger>
                    <TabsTrigger value="active">Active</TabsTrigger>
                    <TabsTrigger value="draft">Draft</TabsTrigger>
                  </TabsList>
                </div>
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
          {error.includes("selecciona un sitio") ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Por favor, selecciona un sitio en el selector de la barra de navegación para ver los segmentos disponibles.
              </p>
              <p className="text-xs text-muted-foreground">
                Sitio actual: {currentSite ? `${currentSite.name} (${currentSite.id})` : 'Ninguno seleccionado'}
              </p>
              <p className="text-xs text-muted-foreground">
                Si no tienes sitios, primero debes crear uno en la sección de sitios.
              </p>
            </div>
          ) : (
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
          )}
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
              <div className="flex-1">
                <TabsList className="w-full">
                  <TabsTrigger value="all">All Segments</TabsTrigger>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="draft">Draft</TabsTrigger>
                </TabsList>
              </div>
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
                <div className="space-y-4">
                  {filteredSegments.map((segment) => (
                    <Collapsible
                      key={segment.id}
                      open={expandedRows[segment.id]}
                      onOpenChange={() => toggleRow(segment.id)}
                      className="w-full"
                    >
                      <div 
                        className="cursor-pointer"
                        onClick={() => toggleRow(segment.id)}
                      >
                        <Card className="border border-border hover:border-foreground/20 transition-colors overflow-hidden">
                          <div className="flex items-center pl-6 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-center p-2">
                              {expandedRows[segment.id] ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                            <CardContent className="flex-1 p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                              <div className="w-full lg:w-[320px] min-w-[280px] max-w-[320px] mb-4 lg:mb-0 shrink-0">
                                <h3 className="font-semibold text-lg truncate">{segment.name}</h3>
                                <p className="text-sm text-muted-foreground/80 truncate">
                                  {segment.description || 'No description available'}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-[180px_100px_120px_120px_120px_160px] gap-2 sm:gap-4 w-full lg:max-w-[900px]">
                                <div className="p-2 rounded-lg">
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Audience</p>
                                  <p className="text-sm font-medium truncate text-right">{getDisplayValue(segment.audience)}</p>
                                </div>
                                <div className="p-2 rounded-lg">
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Language</p>
                                  <p className="text-sm font-medium text-right">{segment.language ? segment.language.toUpperCase() : 'N/A'}</p>
                                </div>
                                <div className="hidden lg:block p-2 rounded-lg">
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Size</p>
                                  <p className="text-sm font-medium text-right">{getDisplayValue(segment.size, 'number')}</p>
                                </div>
                                <div className="p-2 rounded-lg">
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Engagement</p>
                                  <p className="text-sm font-medium text-right">{segment.engagement ? `${segment.engagement}%` : 'N/A'}</p>
                                </div>
                                <div className="hidden lg:block p-2 rounded-lg">
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Created</p>
                                  <p className="text-sm font-medium text-right">
                                    {segment.created_at ? new Date(segment.created_at).toLocaleDateString() : 'N/A'}
                                  </p>
                                </div>
                                <div onClick={(e) => e.stopPropagation()} className="bg-transparent p-2 rounded-lg col-span-2 sm:col-span-2 lg:col-span-1">
                                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Status</p>
                                  <div className="flex items-center justify-end gap-2">
                                    <span className={`text-sm font-medium ${activeSegments[segment.id] ? 'text-green-500' : 'text-yellow-500'}`}>
                                      {activeSegments[segment.id] ? "Active" : "Draft"}
                                    </span>
                                    <Switch 
                                      checked={activeSegments[segment.id]} 
                                      onCheckedChange={() => toggleSegmentStatus(segment.id)}
                                      className="data-[state=checked]:bg-[#90ff17] data-[state=checked]:hover:bg-[#90ff17] bg-muted hover:bg-muted"
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
                                  <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <p className="text-sm font-medium">Ad Platform</p>
                                    <Select
                                      value={selectedAdPlatforms[segment.id]}
                                      onValueChange={(value: AdPlatform) => handlePlatformChange(segment.id, value)}
                                    >
                                      <SelectTrigger className="w-full sm:w-[180px] h-8">
                                        <SelectValue placeholder="Select platform" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="facebook">Facebook Ads</SelectItem>
                                        <SelectItem value="google">Google Ads</SelectItem>
                                        <SelectItem value="linkedin">LinkedIn Ads</SelectItem>
                                        <SelectItem value="twitter">Twitter Ads</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => copyToClipboard(segment.id, getKeywords(segment, selectedAdPlatforms[segment.id]))}
                                      className="flex items-center justify-center hover:bg-secondary/80 transition-colors relative min-w-[160px]"
                                      disabled={copiedStates[segment.id]?.keywords}
                                    >
                                      <div className="flex items-center justify-center min-w-0">
                                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                                        <span className="transition-all duration-200">
                                          {copiedStates[segment.id]?.keywords ? "Copied!" : "Copy to Clipboard"}
                                        </span>
                                      </div>
                                    </Button>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={() => copySegmentUrl(segment.id)}
                                      className="flex items-center justify-center hover:bg-secondary/80 transition-colors relative min-w-[160px]"
                                      disabled={!segment.url || copiedStates[segment.id]?.url}
                                    >
                                      <div className="flex items-center justify-center min-w-0">
                                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                                        <span className={`transition-all duration-200 ${copiedStates[segment.id]?.url ? "text-green-500" : ""}`}>
                                          {copiedStates[segment.id]?.url ? "Copied!" : "Copy Segment URL"}
                                        </span>
                                      </div>
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <div className="my-2">
                                    <h4 className="font-medium text-base">Keywords for {selectedAdPlatforms[segment.id].charAt(0).toUpperCase() + selectedAdPlatforms[segment.id].slice(1)} Ads</h4>
                                  </div>
                                  <div className="flex flex-wrap gap-2 bg-background/50 p-3 rounded-lg">
                                    {getKeywords(segment, selectedAdPlatforms[segment.id]).length > 0 ? (
                                      getKeywords(segment, selectedAdPlatforms[segment.id]).map((keyword, idx) => (
                                        <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                                          {keyword}
                                        </Badge>
                                      ))
                                    ) : (
                                      <p className="text-sm text-muted-foreground">No keywords available</p>
                                    )}
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
                                          className="absolute w-[200%] h-[200%] origin-center rounded-md"
                                          style={{ transform: 'scale(0.5)', transformOrigin: 'center' }}
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
                                  <h4 className="font-medium text-base">Hot Topics</h4>
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
                                              onClick={() => console.log('Clicked blog topic:', topic)}
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
                                              onClick={() => console.log('Clicked newsletter topic:', topic)}
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
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="active" className="space-y-4">
              {segments.filter(segment => (segment.engagement ?? 0) > 60).length === 0 ? (
                segmentsEmptyState
              ) : (
                <div className="space-y-4">
                  {segments
                    .filter((segment: Segment) => (segment.engagement ?? 0) > 60)
                    .map((segment: Segment) => (
                      <Collapsible
                        key={segment.id}
                        open={expandedRows[segment.id]}
                        onOpenChange={() => toggleRow(segment.id)}
                        className="w-full"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => toggleRow(segment.id)}
                        >
                          <Card className="border border-border hover:border-foreground/20 transition-colors overflow-hidden">
                            <div className="flex items-center pl-6 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center justify-center p-2">
                                {expandedRows[segment.id] ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <CardContent className="flex-1 p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                                <div className="w-full lg:w-[320px] min-w-[280px] max-w-[320px] mb-4 lg:mb-0 shrink-0">
                                  <h3 className="font-semibold text-lg truncate">{segment.name}</h3>
                                  <p className="text-sm text-muted-foreground/80 truncate">
                                    {segment.description || 'No description available'}
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-[180px_100px_120px_120px_120px_160px] gap-2 sm:gap-4 w-full lg:max-w-[900px]">
                                  <div className="p-2 rounded-lg">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Audience</p>
                                    <p className="text-sm font-medium truncate text-right">{getDisplayValue(segment.audience)}</p>
                                  </div>
                                  <div className="p-2 rounded-lg">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Language</p>
                                    <p className="text-sm font-medium text-right">{segment.language ? segment.language.toUpperCase() : 'N/A'}</p>
                                  </div>
                                  <div className="hidden lg:block p-2 rounded-lg">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Size</p>
                                    <p className="text-sm font-medium text-right">{getDisplayValue(segment.size, 'number')}</p>
                                  </div>
                                  <div className="p-2 rounded-lg">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Engagement</p>
                                    <p className="text-sm font-medium text-right">{segment.engagement ? `${segment.engagement}%` : 'N/A'}</p>
                                  </div>
                                  <div className="hidden lg:block p-2 rounded-lg">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Created</p>
                                    <p className="text-sm font-medium text-right">
                                      {segment.created_at ? new Date(segment.created_at).toLocaleDateString() : 'N/A'}
                                    </p>
                                  </div>
                                  <div onClick={(e) => e.stopPropagation()} className="bg-transparent p-2 rounded-lg col-span-2 sm:col-span-2 lg:col-span-1">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Status</p>
                                    <div className="flex items-center justify-end gap-2">
                                      <span className={`text-sm font-medium ${activeSegments[segment.id] ? 'text-green-500' : 'text-yellow-500'}`}>
                                        {activeSegments[segment.id] ? "Active" : "Draft"}
                                      </span>
                                      <Switch 
                                        checked={activeSegments[segment.id]} 
                                        onCheckedChange={() => toggleSegmentStatus(segment.id)}
                                        className="data-[state=checked]:bg-[#90ff17] data-[state=checked]:hover:bg-[#90ff17] bg-muted hover:bg-muted"
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
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                      <p className="text-sm font-medium">Ad Platform</p>
                                      <Select
                                        value={selectedAdPlatforms[segment.id]}
                                        onValueChange={(value: AdPlatform) => handlePlatformChange(segment.id, value)}
                                      >
                                        <SelectTrigger className="w-full sm:w-[180px] h-8">
                                          <SelectValue placeholder="Select platform" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="facebook">Facebook Ads</SelectItem>
                                          <SelectItem value="google">Google Ads</SelectItem>
                                          <SelectItem value="linkedin">LinkedIn Ads</SelectItem>
                                          <SelectItem value="twitter">Twitter Ads</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => copyToClipboard(segment.id, getKeywords(segment, selectedAdPlatforms[segment.id]))}
                                        className="flex items-center justify-center hover:bg-secondary/80 transition-colors relative min-w-[160px]"
                                        disabled={copiedStates[segment.id]?.keywords}
                                      >
                                        <div className="flex items-center justify-center min-w-0">
                                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                                          <span className="transition-all duration-200">
                                            {copiedStates[segment.id]?.keywords ? "Copied!" : "Copy to Clipboard"}
                                          </span>
                                        </div>
                                      </Button>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => copySegmentUrl(segment.id)}
                                        className="flex items-center justify-center hover:bg-secondary/80 transition-colors relative min-w-[160px]"
                                        disabled={!segment.url || copiedStates[segment.id]?.url}
                                      >
                                        <div className="flex items-center justify-center min-w-0">
                                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                                          <span className={`transition-all duration-200 ${copiedStates[segment.id]?.url ? "text-green-500" : ""}`}>
                                            {copiedStates[segment.id]?.url ? "Copied!" : "Copy Segment URL"}
                                          </span>
                                        </div>
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <div className="my-2">
                                      <h4 className="font-medium text-base">Keywords for {selectedAdPlatforms[segment.id].charAt(0).toUpperCase() + selectedAdPlatforms[segment.id].slice(1)} Ads</h4>
                                    </div>
                                    <div className="flex flex-wrap gap-2 bg-background/50 p-3 rounded-lg">
                                      {getKeywords(segment, selectedAdPlatforms[segment.id]).length > 0 ? (
                                        getKeywords(segment, selectedAdPlatforms[segment.id]).map((keyword, idx) => (
                                          <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                                            {keyword}
                                          </Badge>
                                        ))
                                      ) : (
                                        <p className="text-sm text-muted-foreground">No keywords available</p>
                                      )}
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
                                            className="absolute w-[200%] h-[200%] origin-center rounded-md"
                                            style={{ transform: 'scale(0.5)', transformOrigin: 'center' }}
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
                                    <h4 className="font-medium text-base">Hot Topics</h4>
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
                                                onClick={() => console.log('Clicked blog topic:', topic)}
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
                                                onClick={() => console.log('Clicked newsletter topic:', topic)}
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
                    ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="draft" className="space-y-4">
              {segments.filter(segment => (segment.engagement ?? 0) <= 60).length === 0 ? (
                segmentsEmptyState
              ) : (
                <div className="space-y-4">
                  {segments
                    .filter((segment: Segment) => (segment.engagement ?? 0) <= 60)
                    .map((segment: Segment) => (
                      <Collapsible
                        key={segment.id}
                        open={expandedRows[segment.id]}
                        onOpenChange={() => toggleRow(segment.id)}
                        className="w-full"
                      >
                        <div 
                          className="cursor-pointer"
                          onClick={() => toggleRow(segment.id)}
                        >
                          <Card className="border border-border hover:border-foreground/20 transition-colors overflow-hidden">
                            <div className="flex items-center pl-6 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center justify-center p-2">
                                {expandedRows[segment.id] ? (
                                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <CardContent className="flex-1 p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                                <div className="w-full lg:w-[320px] min-w-[280px] max-w-[320px] mb-4 lg:mb-0 shrink-0">
                                  <h3 className="font-semibold text-lg truncate">{segment.name}</h3>
                                  <p className="text-sm text-muted-foreground/80 truncate">
                                    {segment.description || 'No description available'}
                                  </p>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-[180px_100px_120px_120px_120px_160px] gap-2 sm:gap-4 w-full lg:max-w-[900px]">
                                  <div className="p-2 rounded-lg">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Audience</p>
                                    <p className="text-sm font-medium truncate text-right">{getDisplayValue(segment.audience)}</p>
                                  </div>
                                  <div className="p-2 rounded-lg">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Language</p>
                                    <p className="text-sm font-medium text-right">{segment.language ? segment.language.toUpperCase() : 'N/A'}</p>
                                  </div>
                                  <div className="hidden lg:block p-2 rounded-lg">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Size</p>
                                    <p className="text-sm font-medium text-right">{getDisplayValue(segment.size, 'number')}</p>
                                  </div>
                                  <div className="p-2 rounded-lg">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Engagement</p>
                                    <p className="text-sm font-medium text-right">{segment.engagement ? `${segment.engagement}%` : 'N/A'}</p>
                                  </div>
                                  <div className="hidden lg:block p-2 rounded-lg">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Created</p>
                                    <p className="text-sm font-medium text-right">
                                      {segment.created_at ? new Date(segment.created_at).toLocaleDateString() : 'N/A'}
                                    </p>
                                  </div>
                                  <div onClick={(e) => e.stopPropagation()} className="bg-transparent p-2 rounded-lg col-span-2 sm:col-span-2 lg:col-span-1">
                                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1 text-right">Status</p>
                                    <div className="flex items-center justify-end gap-2">
                                      <span className={`text-sm font-medium ${activeSegments[segment.id] ? 'text-green-500' : 'text-yellow-500'}`}>
                                        {activeSegments[segment.id] ? "Active" : "Draft"}
                                      </span>
                                      <Switch 
                                        checked={activeSegments[segment.id]} 
                                        onCheckedChange={() => toggleSegmentStatus(segment.id)}
                                        className="data-[state=checked]:bg-[#90ff17] data-[state=checked]:hover:bg-[#90ff17] bg-muted hover:bg-muted"
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
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                      <p className="text-sm font-medium">Ad Platform</p>
                                      <Select
                                        value={selectedAdPlatforms[segment.id]}
                                        onValueChange={(value: AdPlatform) => handlePlatformChange(segment.id, value)}
                                      >
                                        <SelectTrigger className="w-full sm:w-[180px] h-8">
                                          <SelectValue placeholder="Select platform" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="facebook">Facebook Ads</SelectItem>
                                          <SelectItem value="google">Google Ads</SelectItem>
                                          <SelectItem value="linkedin">LinkedIn Ads</SelectItem>
                                          <SelectItem value="twitter">Twitter Ads</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => copyToClipboard(segment.id, getKeywords(segment, selectedAdPlatforms[segment.id]))}
                                        className="flex items-center justify-center hover:bg-secondary/80 transition-colors relative min-w-[160px]"
                                        disabled={copiedStates[segment.id]?.keywords}
                                      >
                                        <div className="flex items-center justify-center min-w-0">
                                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                                          <span className="transition-all duration-200">
                                            {copiedStates[segment.id]?.keywords ? "Copied!" : "Copy to Clipboard"}
                                          </span>
                                        </div>
                                      </Button>
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => copySegmentUrl(segment.id)}
                                        className="flex items-center justify-center hover:bg-secondary/80 transition-colors relative min-w-[160px]"
                                        disabled={!segment.url || copiedStates[segment.id]?.url}
                                      >
                                        <div className="flex items-center justify-center min-w-0">
                                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                                          <span className={`transition-all duration-200 ${copiedStates[segment.id]?.url ? "text-green-500" : ""}`}>
                                            {copiedStates[segment.id]?.url ? "Copied!" : "Copy Segment URL"}
                                          </span>
                                        </div>
                                      </Button>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    <div className="my-2">
                                      <h4 className="font-medium text-base">Keywords for {selectedAdPlatforms[segment.id].charAt(0).toUpperCase() + selectedAdPlatforms[segment.id].slice(1)} Ads</h4>
                                    </div>
                                    <div className="flex flex-wrap gap-2 bg-background/50 p-3 rounded-lg">
                                      {getKeywords(segment, selectedAdPlatforms[segment.id]).length > 0 ? (
                                        getKeywords(segment, selectedAdPlatforms[segment.id]).map((keyword, idx) => (
                                          <Badge key={idx} variant="outline" className="px-2.5 py-1 hover:bg-secondary/80 transition-colors">
                                            {keyword}
                                          </Badge>
                                        ))
                                      ) : (
                                        <p className="text-sm text-muted-foreground">No keywords available</p>
                                      )}
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
                                            className="absolute w-[200%] h-[200%] origin-center rounded-md"
                                            style={{ transform: 'scale(0.5)', transformOrigin: 'center' }}
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
                                    <h4 className="font-medium text-base">Hot Topics</h4>
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
                                                onClick={() => console.log('Clicked blog topic:', topic)}
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
                                                onClick={() => console.log('Clicked newsletter topic:', topic)}
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