"use client"

import { useState, useEffect, RefObject, Suspense } from "react"
import { useRouter } from "next/navigation"
import React from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { 
  ChevronLeft,
  Copy,
  Globe,
  Users,
  BarChart,
  FileText,
  PieChart,
  Settings,
  SaveIcon,
  Trash2,
  ExternalLink,
  HelpCircle,
  Pencil,
  User as UserIcon
} from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { useSite } from "@/app/context/SiteContext"
import { Switch } from "@/app/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { getSegments, updateSegmentStatus, updateSegmentUrl, getSegmentById } from "../actions"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/app/components/ui/tooltip"
import { ResponsiveContainer } from "recharts"
import { CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Bar } from "recharts"
import { useTheme } from '@/app/context/ThemeContext'
import dynamic from 'next/dynamic'
import { LoadingState } from "./components/LoadingState"
import { ErrorState } from "./components/ErrorState"
import { AIActionModal, AIActionIcon } from "@/app/components/ui/ai-action-modal"
import { notFound } from "next/navigation"
import { buildSegmentsWithAI } from "@/app/services/ai-service"
import { toast } from "sonner"
import { SegmentStatusWidget } from "./components/SegmentStatusWidget"
import { NewAdPlatformType } from "./components/analysisComponents"
import SegmentDetailsTab from "./components/SegmentDetailsTab"

export type AdPlatform = "facebook" | "google" | "linkedin" | "tiktok"

// Definición de la estructura de datos para adPlatforms
interface AdPlatformData {
  googleAds?: {
    demographics?: {
      ageRanges?: string[];
      gender?: string[];
    };
    interests?: string[];
    inMarketSegments?: string[];
    locations?: string[] | {
      countries?: string[];
      regions?: string[];
      cities?: string[];
    };
    geoTargeting?: {
      countries: string[];
      regions: string[];
      cities: string[];
    };
  };
  facebookAds?: {
    demographics?: {
      age?: number[] | string[];
      gender?: string[];
    };
    interests?: string[];
    locations?: {
      countries?: string[];
      regions?: string[];
      cities?: string[];
    };
  };
  linkedInAds?: {
    demographics?: {
      age?: string[];
      gender?: string[];
    };
    industries?: string[];
    jobTitles?: string[];
    locations?: {
      countries?: string[];
      regions?: string[];
      cities?: string[];
    };
  };
  tiktokAds?: {
    demographics?: {
      age?: string[];
      gender?: string[];
    };
    interests?: string[];
    behaviors?: string[];
    creatorCategories?: string[];
    locations?: {
      countries?: string[];
      regions?: string[];
      cities?: string[];
    };
  };
}

// Definición de la estructura de datos para audienceProfile
interface AudienceProfileData {
  adPlatforms: AdPlatformData;
  [key: string]: any; // Para otros campos planos
}

// Define Segment type locally
export interface Segment {
  id: string;
  name: string;
  description: string | null;
  audience: string | null;
  language: string | null;
  size: string | null;
  engagement: number | null;
  created_at: string;
  url: string | null;
  analysis: any;
  topics: {
    blog: string[];
    newsletter: string[];
  } | null;
  is_active: boolean;
  estimated_value: number | null;
  icp: any;
}

// Dummy data for the chart
export const chartData = [
  { name: "Jan", total: 1200 },
  { name: "Feb", total: 1900 },
  { name: "Mar", total: 1500 },
  { name: "Apr", total: 1700 },
  { name: "May", total: 2400 },
  { name: "Jun", total: 2100 },
  { name: "Jul", total: 2300 },
  { name: "Aug", total: 2800 },
  { name: "Sep", total: 3200 },
  { name: "Oct", total: 2900 },
  { name: "Nov", total: 3500 },
  { name: "Dec", total: 3700 }
]

// Función auxiliar para manejar valores no disponibles
export function getDisplayValue(value: string | number | null | undefined, type: 'text' | 'number' = 'text'): string {
  if (value === undefined || value === null || value === '') return 'N/A'
  if (type === 'number') {
    if (typeof value === 'number') {
      return value.toLocaleString()
    } else if (typeof value === 'string' && !isNaN(Number(value))) {
      return Number(value).toLocaleString()
    }
  }
  return String(value)
}

// Función auxiliar para manejar keywords vacíos
export function getKeywords(segment: Segment, platform: AdPlatform): string[] {
  if (!segment.analysis) return [];
  
  // Check if analysis is in the old format (direct object with platform keys)
  if (typeof segment.analysis === 'object' && !Array.isArray(segment.analysis) && 
      !('data' in segment.analysis) && !('type' in segment.analysis)) {
    // Cast to unknown first, then to the expected record type
    const analysisObj = segment.analysis as unknown as Record<string, string[]>;
    return platform in analysisObj ? analysisObj[platform] : [];
  }
  
  // Check for new format with data property
  if ('data' in segment.analysis && segment.analysis.data && 
      typeof segment.analysis.data === 'object' && 'adPlatforms' in segment.analysis.data) {
    const adPlatforms = segment.analysis.data.adPlatforms;
    
    switch (platform) {
      case 'facebook':
        return adPlatforms.facebookAds?.interests || [];
      case 'google':
        return adPlatforms.googleAds?.interests || [];
      case 'linkedin':
        return adPlatforms.linkedInAds?.jobTitles || [];
      case 'tiktok':
        return adPlatforms.tiktokAds?.interests || [];
      default:
        return [];
    }
  }
  
  return [];
}

// Función auxiliar para manejar hot topics vacíos
export function getHotTopics(segment: Segment, type: 'blog' | 'newsletter'): string[] {
  return segment.topics?.[type] || []
}

// Skeleton for the sticky header actions
const StickyHeaderSkeleton = () => (
  <StickyHeader>
    <div className="px-16 pt-0 w-full">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-8">
          <div className="bg-background rounded-lg p-1">
            <div className="flex gap-1">
              <div className="h-9 w-24 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
              <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
              <div className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
            <div className="h-9 w-[180px] bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  </StickyHeader>
);

// Skeleton for Analysis tab
const AnalysisSkeleton = () => (
  <div className="animate-pulse space-y-6">
    {/* Performance Metrics Cards */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
            <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-md mb-1" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Market Penetration and Behavior Cards */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[...Array(2)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded-md" />
          </CardHeader>
          <CardContent>
            <div className="h-[200px] bg-gray-200 dark:bg-gray-700 rounded-md mb-4" />
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-md" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Demographics and Regional Distribution Cards */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[...Array(2)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded-md" />
          </CardHeader>
          <CardContent>
            <div className="h-[200px] bg-gray-200 dark:bg-gray-700 rounded-md mb-4" />
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-md" />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  </div>
);

// Skeleton for ICP tab
const ICPProfileSkeleton = () => (
  <div className="animate-pulse space-y-6">
    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div>
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
        <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded-md" />
      </div>
    </div>

    {/* ICP Content */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded-md" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
                    <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded-md" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
                    <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded-md" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] bg-gray-200 dark:bg-gray-700 rounded-md mb-4" />
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-md" />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded-md" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
                    <div className="h-3 w-48 bg-gray-200 dark:bg-gray-700 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
);

interface DetailsTabProps {
  segment: Segment;
  onSave: (segment: Segment) => void;
  formRef: RefObject<HTMLFormElement>;
}

// Lazy load the analysis tab
const AnalysisTab = dynamic<{
  segment: Segment;
  selectedAdPlatform: NewAdPlatformType;
}>(() => import('./components/SegmentAnalysisTab'), {
  loading: () => <AnalysisSkeleton />,
  ssr: false
});

// Lazy load the ICP tab
const ICPTab = dynamic<{
  segment: Segment;
  activeSection: string;
}>(() => import('./components/SegmentICPTab'), {
  loading: () => <ICPProfileSkeleton />,
  ssr: false
});

const SegmentUrlModal = dynamic(
  () => import('./components/SegmentUrlModal').catch(() => {
    return () => <div className="p-4 text-center">Error loading URL modal. Please try refreshing the page.</div>;
  }),
  {
    ssr: false
  }
);

// Skeleton component for lazy loading
const SegmentDetailsSkeleton = () => (
  <div className="mx-auto max-w-2xl animate-pulse">
    <div className="space-y-6">
      {/* Basic Information Card */}
      <Card>
        <CardHeader>
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded-md" />
              <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded-md mt-1" />
            </div>
            <div className="h-6 w-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
          </div>

          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded-md" />
            <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-md" />
          </div>
          
          <div className="space-y-2">
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded-md" />
            <div className="h-24 w-full bg-gray-200 dark:bg-gray-700 rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* Audience Details Card */}
      <Card>
        <CardHeader>
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-md mb-2" />
          <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded-md" />
            <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-md" />
          </div>
          
          <div className="space-y-2">
            <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded-md" />
            <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone Card */}
      <Card>
        <CardHeader>
          <div className="h-6 w-24 bg-red-200 dark:bg-red-800 rounded-md mb-2" />
          <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded-md" />
        </CardHeader>
        <CardContent>
          <div className="border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-5 w-32 bg-red-200 dark:bg-red-800 rounded-md" />
                <div className="h-4 w-56 bg-gray-200 dark:bg-gray-700 rounded-md" />
              </div>
              <div className="h-9 w-20 bg-red-200 dark:bg-red-800 rounded-md" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

// Lazy load the details tab
const DetailsTab = dynamic<DetailsTabProps>(() => import('./components/SegmentDetailsTab'), {
  loading: () => <SegmentDetailsSkeleton />,
  ssr: false
});

// Wrap the component with Suspense
export default function SegmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <SegmentDetailPageContent params={params} />
    </Suspense>
  );
}

// Move the main component logic to a separate component
function SegmentDetailPageContent({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { currentSite } = useSite()
  const unwrappedParams = React.use(params)
  const segmentId = unwrappedParams.id
  
  const [segment, setSegment] = useState<Segment | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const [activeTab, setActiveTab] = useState("analysis")
  
  // Form reference for submitting the form
  const formRef = React.useRef<HTMLFormElement>(null)
  
  // Estados para controlar las solicitudes en proceso
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGeneratingICP, setIsGeneratingICP] = useState(false)
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false)
  
  // AI Action Modal states
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)
  const [aiModalConfig, setAIModalConfig] = useState({
    title: "",
    description: "",
    actionLabel: "",
    action: async (): Promise<any> => {},
    estimatedTime: 30 // Valor predeterminado
  })
  
  // Estado para el dropdown de análisis
  const [analysisType, setAnalysisType] = useState("overview")
  // Estado para el dropdown de ICP
  const [icpSection, setIcpSection] = useState("demographics")
  const [selectedAdPlatform, setSelectedAdPlatform] = useState<NewAdPlatformType>("googleAds")
  
  // Ensure that if topics tab was previously selected, we default to analysis
  useEffect(() => {
    if (activeTab === 'topics') {
      setActiveTab('analysis');
    }
  }, [activeTab]);
  
  // Cargar el segmento seleccionado
  useEffect(() => {
    const loadSegment = async () => {
      if (!currentSite?.id) return
      
      try {
        setIsLoading(true)
        setError(null)
        
        console.log('Loading segment data for ID:', segmentId)
        const result = await getSegmentById(segmentId)
        
        if (result.error) {
          console.error('Error fetching segment:', result.error)
          setError(result.error)
          return
        }
        
        if (!result.segment) {
          console.error('Segment not found with ID:', segmentId)
          setError("Segment not found")
          return
        }
        
        console.log('Segment found:', result.segment.name)
        
        // Agregar la dummy data del ICP profile para mostrar la UI
        if (!result.segment.icp) {
          result.segment.icp = {} as any;
        }
        
        // Asegurarse de que estimated_value esté definido
        (result.segment as any).estimated_value = (result.segment as any).estimated_value || null;
        
        // Agregar el perfil ICP
        (result.segment.icp as any).profile = {
          id: "icp_47f14b99-cfe9-4269-aad2-6ae50161de99_m86ln584",
          name: "Business Leaders and Executives",
          description: "Executives and business leaders seeking AI-powered solutions to optimize business management and operations",
          demographics: {
            ageRange: {
              primary: "35-50",
              secondary: "30-55"
            },
            gender: {
              distribution: "Balanced with slight male majority"
            },
            locations: [
              {
                type: "region",
                name: "North America",
                relevance: "High"
              },
              {
                type: "region",
                name: "Europe",
                relevance: "High"
              },
              {
                type: "region",
                name: "Latin America",
                relevance: "Medium"
              }
            ],
            education: {
              primary: "Master's Degree",
              secondary: [
                "Bachelor's Degree",
                "Doctorate"
              ]
            },
            income: {
              currency: "USD",
              level: "High",
              range: "100,000-250,000 annually"
            },
            languages: [
              {
                name: "English",
                proficiency: "Native",
                relevance: "Very high"
              },
              {
                name: "Spanish",
                proficiency: "Intermediate-advanced",
                relevance: "High"
              }
            ]
          },
          // ... resto del perfil ICP ...
        };
        
        setSegment(result.segment as Segment)
        setIsActive(result.segment.is_active)
        setUrlInput(result.segment.url || "")
      } catch (err) {
        console.error("Error loading segment:", err)
        setError("Error loading segment details")
      } finally {
        setIsLoading(false)
      }
    }
    
    loadSegment()
  }, [segmentId, currentSite?.id])
  
  // Actualizar el título en el breadcrumb cuando se cargue la página
  useEffect(() => {
    if (segment) {
      // Actualizar el título de la página para el breadcrumb
      document.title = `${segment.name} | Segments`
      
      // Emitir un evento personalizado para actualizar el breadcrumb con más detalles
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: segment.name,
          path: `/segments/${segment.id}`,
          section: 'segments',
          // Add segment data and callback functions for the TopBar buttons
          segmentData: {
            id: segment.id,
            activeTab,
            isAnalyzing,
            isGeneratingICP,
            openAIModal
          }
        }
      })
      
      // Asegurarse de que el evento se dispare después de que el DOM esté actualizado
      setTimeout(() => {
        window.dispatchEvent(event)
        console.log('Breadcrumb update event dispatched:', segment.name)
      }, 0)
    }
    
    // Limpiar al desmontar
    return () => {
      document.title = 'Segments | Market Fit'
      // Reset breadcrumb state
      window.dispatchEvent(new CustomEvent('breadcrumb:update', {
        detail: {
          title: 'Segments',
          path: '/segments',
          section: 'segments',
          segmentData: null
        }
      }))
    }
  }, [segment, activeTab, isAnalyzing, isGeneratingICP])

  // Listen for tab changes to update the breadcrumb
  useEffect(() => {
    if (segment) {
      // Emit a custom event to update the breadcrumb with the new active tab
      const event = new CustomEvent('segment:tabchange', {
        detail: {
          activeTab,
          isAnalyzing,
          isGeneratingICP
        }
      })
      
      window.dispatchEvent(event)
    }
  }, [activeTab, isAnalyzing, isGeneratingICP, segment])

  const toggleSegmentStatus = async () => {
    if (!segment) {
      console.error('Cannot toggle status: segment is null')
      return
    }
    
    if (!segment.id) {
      console.error('Cannot toggle status: segment id is missing')
      return
    }
    
    const newStatus = !isActive
    setIsActive(newStatus)
    
    try {
      const result = await updateSegmentStatus({
        segmentId: segment.id,
        isActive: newStatus
      })
      
      if (result.error) {
        console.error('Error updating segment status:', result.error)
        setIsActive(!newStatus) // Revertir en caso de error
        return
      }
      
      // Actualizar el segmento local usando el helper
      setSegment((prev: Segment | null) => handleSegmentUpdate(prev, { is_active: newStatus }))
    } catch (error) {
      console.error('Error updating segment status:', error)
      setIsActive(!newStatus) // Revertir en caso de error
    }
  }

  const handleSaveUrl = async () => {
    if (!segment) return
    
    try {
      const result = await updateSegmentUrl({
        segmentId: segment.id,
        url: urlInput
      })
      
      if (result.error) {
        return
      }

      // Actualizar el segmento local usando el helper
      setSegment((prev: Segment | null) => handleSegmentUpdate(prev, { url: urlInput }))
      
      setIsUrlModalOpen(false)
    } catch (err) {
      console.error("Error saving segment URL:", err)
    }
  }

  // AI action handlers
  const handleAnalyzeWithAI = async (): Promise<any> => {
    // Evitar múltiples solicitudes simultáneas
    if (isAnalyzing) {
      toast.error("Analysis is already in progress. Please wait.");
      return {
        success: false,
        error: "Analysis is already in progress"
      };
    }

    if (!segment || !currentSite) {
      toast.error("No segment or site selected");
      return {
        success: false,
        error: "No segment or site selected"
      };
    }

    // Verificar que el segmento tiene una URL
    if (!segment.url) {
      toast.error("This segment doesn't have a URL. Please add a URL to the segment before analyzing.");
      return {
        success: false,
        error: "Segment URL is missing"
      };
    }

    try {
      // Marcar como en proceso
      setIsAnalyzing(true);

      // Get the current user ID from Supabase
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to use this feature");
        setIsAnalyzing(false);
        return {
          success: false,
          error: "Authentication required"
        };
      }

      console.log("Analyzing segment with params:", {
        user_id: user.id,
        site_id: currentSite.id,
        mode: "analyze",
        url: segment.url,
        segmentCount: 3
      });

      // Call the AI service to analyze the segment
      const result = await buildSegmentsWithAI({
        user_id: user.id,
        site_id: currentSite.id,
        mode: "analyze",
        url: segment.url,
        segmentCount: 3
      });

      if (result.success) {
        toast.success("Segment analyzed successfully!");
        // Reload the page to show the updated segment data
        window.location.reload();
        return result;
      } else {
        // En lugar de lanzar un error, devolvemos el resultado completo
        return result;
      }
    } catch (error) {
      console.error("Error analyzing segment with AI:", error);
      // Devolvemos un objeto con formato similar al de la respuesta del servicio
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    } finally {
      // Siempre marcar como no en proceso al finalizar
      setIsAnalyzing(false);
    }
  };

  const handleGenerateICP = async (): Promise<any> => {
    // Evitar múltiples solicitudes simultáneas
    if (isGeneratingICP) {
      toast.error("ICP generation is already in progress. Please wait.");
      return {
        success: false,
        error: "ICP generation is already in progress"
      };
    }

    if (!segment || !currentSite) {
      toast.error("No segment or site selected");
      return {
        success: false,
        error: "No segment or site selected"
      };
    }

    // Verificar que el segmento tiene una URL
    if (!segment.url) {
      toast.error("This segment doesn't have a URL. Please add a URL to the segment before generating ICP.");
      return {
        success: false,
        error: "Segment URL is missing"
      };
    }

    try {
      // Marcar como en proceso
      setIsGeneratingICP(true);

      // Get the current user ID from Supabase
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to use this feature");
        setIsGeneratingICP(false);
        return {
          success: false,
          error: "Authentication required"
        };
      }

      console.log("Generating ICP with params:", {
        user_id: user.id,
        site_id: currentSite.id,
        mode: "analyze",
        analysisType: "icp",
        url: segment.url,
        segmentCount: 3
      });

      // Call the AI service to generate ICP
      const result = await buildSegmentsWithAI({
        user_id: user.id,
        site_id: currentSite.id,
        mode: "analyze",
        analysisType: "icp",
        url: segment.url,
        segmentCount: 3
      });

      if (result.success) {
        toast.success("ICP generated successfully!");
        // Reload the page to show the updated ICP data
        window.location.reload();
        return result;
      } else {
        // En lugar de lanzar un error, devolvemos el resultado completo
        return result;
      }
    } catch (error) {
      console.error("Error generating ICP with AI:", error);
      // Devolvemos un objeto con formato similar al de la respuesta del servicio
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    } finally {
      // Siempre marcar como no en proceso al finalizar
      setIsGeneratingICP(false);
    }
  };

  const handleGetTopics = async (): Promise<any> => {
    // Evitar múltiples solicitudes simultáneas
    if (isGeneratingTopics) {
      toast.error("Topics generation is already in progress. Please wait.");
      return {
        success: false,
        error: "Topics generation is already in progress"
      };
    }

    if (!segment || !currentSite) {
      toast.error("No segment or site selected");
      return {
        success: false,
        error: "No segment or site selected"
      };
    }

    // Verificar que el segmento tiene una URL
    if (!segment.url) {
      toast.error("This segment doesn't have a URL. Please add a URL to the segment before generating topics.");
      return {
        success: false,
        error: "Segment URL is missing"
      };
    }

    try {
      // Marcar como en proceso
      setIsGeneratingTopics(true);

      // Get the current user ID from Supabase
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to use this feature");
        setIsGeneratingTopics(false);
        return {
          success: false,
          error: "Authentication required"
        };
      }

      console.log("Generating topics with params:", {
        user_id: user.id,
        site_id: currentSite.id,
        mode: "analyze",
        analysisType: "topics",
        url: segment.url,
        segmentCount: 3
      });

      // Call the AI service to get topics
      const result = await buildSegmentsWithAI({
        user_id: user.id,
        site_id: currentSite.id,
        mode: "analyze",
        analysisType: "topics",
        url: segment.url,
        segmentCount: 3
      });

      if (result.success) {
        toast.success("Topics generated successfully!");
        // Reload the page to show the updated topics data
        window.location.reload();
        return result;
      } else {
        // En lugar de lanzar un error, devolvemos el resultado completo
        return result;
      }
    } catch (error) {
      console.error("Error generating topics with AI:", error);
      // Devolvemos un objeto con formato similar al de la respuesta del servicio
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred"
      };
    } finally {
      // Siempre marcar como no en proceso al finalizar
      setIsGeneratingTopics(false);
    }
  };

  // Open AI modal with specific configuration
  const openAIModal = (type: 'analysis' | 'icp') => {
    // Verificar si ya hay una operación en curso
    if (isAnalyzing || isGeneratingICP || isGeneratingTopics) {
      toast.error("Another operation is already in progress. Please wait.");
      return;
    }
    
    // Configuraciones para cada tipo de modal
    const configs = {
      analysis: {
        title: "Analyze Segment with AI",
        description: "Our AI will analyze this segment to identify key characteristics, behaviors, and preferences of your audience. This helps you better understand your target market.",
        actionLabel: "Start Analysis",
        action: handleAnalyzeWithAI,
        estimatedTime: 60 // 1 minute
      },
      icp: {
        title: "Generate Ideal Customer Profile",
        description: "Our AI will create a detailed Ideal Customer Profile (ICP) for this segment, including demographics, pain points, goals, and buying behaviors. This helps you tailor your marketing and product strategies.",
        actionLabel: "Generate ICP",
        action: handleGenerateICP,
        estimatedTime: 90 // 1.5 minutes
      }
    };

    // Establecer la configuración según el tipo seleccionado
    setAIModalConfig(configs[type]);
    
    // Abrir el modal después de configurarlo
    setTimeout(() => {
      setIsAIModalOpen(true);
    }, 0);
  };

  const handleSegmentUpdate = (prev: Segment | null, updates: Partial<Segment>): Segment | null => {
    if (!prev) return null;
    return { ...prev, ...updates };
  };

  const handleAdPlatformChange = (value: NewAdPlatformType) => {
    setSelectedAdPlatform(value);
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-0">
        <StickyHeaderSkeleton />
        <div className="px-16 py-6">
          <AnalysisSkeleton />
        </div>
      </div>
    );
  }

  if (error || !segment) {
    return <ErrorState error={error} onBack={() => router.push('/segments')} />;
  }

  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="analysis" onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="px-16 pt-0 w-full">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="analysis">Analysis</TabsTrigger>
                  <TabsTrigger value="icp">ICP Profiles</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                </TabsList>
              </div>
              {segment && (
                <div className="flex items-center gap-4">
                  {/* Analysis Tab Actions */}
                  {activeTab === "analysis" && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Ad Platform</span>
                      <Select
                        value={selectedAdPlatform}
                        onValueChange={handleAdPlatformChange}
                      >
                        <SelectTrigger className="w-[180px] h-9">
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="facebookAds">Facebook Ads</SelectItem>
                          <SelectItem value="googleAds">Google Ads</SelectItem>
                          <SelectItem value="linkedInAds">LinkedIn Ads</SelectItem>
                          <SelectItem value="tiktokAds">TikTok Ads</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* ICP Tab Actions */}
                  {activeTab === "icp" && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Ideal Customer Profile</span>
                      <Select
                        value={icpSection}
                        onValueChange={setIcpSection}
                      >
                        <SelectTrigger className="w-[180px] h-9">
                          <SelectValue placeholder="Select section" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="demographics" className="flex items-center">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 mr-2" />
                              <span>Demographics</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="psychographics" className="flex items-center">
                            <div className="flex items-center gap-2">
                              <PieChart className="h-4 w-4 mr-2" />
                              <span>Psychographics</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="behavioral" className="flex items-center">
                            <div className="flex items-center gap-2">
                              <BarChart className="h-4 w-4 mr-2" />
                              <span>Behavioral</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="professional" className="flex items-center">
                            <div className="flex items-center gap-2">
                              <UserIcon className="h-4 w-4 mr-2" />
                              <span>Professional</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="custom" className="flex items-center">
                            <div className="flex items-center gap-2">
                              <Settings className="h-4 w-4 mr-2" />
                              <span>Custom</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Details Tab Actions */}
                  {activeTab === "details" && (
                    <Button 
                      onClick={() => formRef.current?.requestSubmit()}
                      className="gap-2"
                    >
                      <SaveIcon className="h-4 w-4" />
                      Save Changes
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </StickyHeader>
        <TabsContent value="analysis" className="px-16 py-6">
          <Suspense fallback={<AnalysisSkeleton />}>
            <AnalysisTab segment={segment} selectedAdPlatform={selectedAdPlatform} />
          </Suspense>
        </TabsContent>
        <TabsContent value="icp" className="px-16 py-6">
          <Suspense fallback={<ICPProfileSkeleton />}>
            <ICPTab segment={segment} activeSection={icpSection} />
          </Suspense>
        </TabsContent>
        <TabsContent value="details" className="px-16 py-6">
          <Suspense fallback={<SegmentDetailsSkeleton />}>
            {segment && (
              <DetailsTab 
                key={segment.id}
                segment={segment} 
                onSave={(updatedSegment: Segment) => setSegment(updatedSegment)} 
                formRef={formRef as RefObject<HTMLFormElement>} 
              />
            )}
          </Suspense>
        </TabsContent>
      </Tabs>
      
      <SegmentUrlModal 
        isOpen={isUrlModalOpen}
        setIsOpen={setIsUrlModalOpen}
        urlInput={urlInput}
        setUrlInput={setUrlInput}
        onSave={handleSaveUrl}
      />
      
      {/* AI Action Modal */}
      <AIActionModal
        isOpen={isAIModalOpen}
        setIsOpen={setIsAIModalOpen}
        title={aiModalConfig.title}
        description={aiModalConfig.description}
        actionLabel={aiModalConfig.actionLabel}
        onAction={aiModalConfig.action}
        creditsAvailable={10} // This would come from user's account data
        creditsRequired={1}
        estimatedTime={aiModalConfig.estimatedTime}
        refreshOnComplete={true} // Refresh the page when the action completes
      />
    </div>
  )
} 