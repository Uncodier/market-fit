"use client"

import { useState, useEffect } from "react"
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
  HelpCircle
} from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { useSite } from "@/app/context/SiteContext"
import { Switch } from "@/app/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { getSegments, updateSegmentStatus, updateSegmentUrl } from "../actions"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/app/components/ui/tooltip"
import { ResponsiveContainer } from "recharts"
import { CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Bar } from "recharts"
import { useTheme } from '@/app/context/ThemeContext'
import { SegmentAnalysisTab } from "./components/SegmentAnalysisTab"
import { SegmentThemesTab } from "./components/SegmentThemesTab"
import { SegmentICPTab } from "./components/SegmentICPTab"
import { SegmentUrlModal } from "./components/SegmentUrlModal"
import { LoadingState } from "./components/LoadingState"
import { ErrorState } from "./components/ErrorState"

export type AdPlatform = "facebook" | "google" | "linkedin" | "twitter"

export interface Segment {
  id: string
  name: string
  description: string | null
  audience: string | null
  language: string | null
  size: number | null
  engagement: number | null
  created_at: string
  url: string | null
  analysis: Record<string, string[]> | null
  topics: {
    blog: string[]
    newsletter: string[]
  } | null
  is_active: boolean
  icp: {
    role?: string
    company_size?: string
    industry?: string
    age_range?: string
    pain_points?: string[]
    goals?: string[]
    budget?: string
    decision_maker?: boolean
    location?: string
    experience?: string
  } | null
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
  if (type === 'number' && typeof value === 'number') return value.toLocaleString()
  return String(value)
}

// Función auxiliar para manejar keywords vacíos
export function getKeywords(segment: Segment, platform: AdPlatform): string[] {
  return segment.analysis?.[platform] || []
}

// Función auxiliar para manejar hot topics vacíos
export function getHotTopics(segment: Segment, type: 'blog' | 'newsletter'): string[] {
  return segment.topics?.[type] || []
}

export default function SegmentDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { currentSite } = useSite()
  // Unwrap params using React.use() before accessing its properties
  const unwrappedParams = React.use(params as any) as { id: string }
  const segmentId = unwrappedParams.id
  
  const [segment, setSegment] = useState<Segment | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isUrlModalOpen, setIsUrlModalOpen] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  
  // Cargar el segmento seleccionado
  useEffect(() => {
    const loadSegment = async () => {
      if (!currentSite?.id) return
      
      try {
        setIsLoading(true)
        setError(null)
        
        console.log('Loading segment data for ID:', segmentId)
        const result = await getSegments(currentSite.id)
        
        if (result.error) {
          console.error('Error fetching segments:', result.error)
          setError(result.error)
          return
        }
        
        console.log('Segments loaded:', result.segments?.length || 0)
        const foundSegment = result.segments?.find(s => s.id === segmentId) || null
        
        if (!foundSegment) {
          console.error('Segment not found with ID:', segmentId)
          setError("Segment not found")
          return
        }
        
        console.log('Segment found:', foundSegment.name)
        setSegment(foundSegment)
        setIsActive(foundSegment.is_active)
        setUrlInput(foundSegment.url || "")
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
          section: 'segments'
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
    }
  }, [segment])

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
      
      // Actualizar el segmento local
      setSegment(prev => prev ? { ...prev, is_active: newStatus } : null)
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

      // Actualizar el segmento local
      setSegment(prev => prev ? { ...prev, url: urlInput } : null)
      
      setIsUrlModalOpen(false)
    } catch (err) {
      console.error("Error saving segment URL:", err)
    }
  }

  if (isLoading) {
    return <LoadingState />
  }

  if (error || !segment) {
    return <ErrorState error={error} onBack={() => router.push('/segments')} />
  }

  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="analysis" className="h-full flex flex-col">
        <StickyHeader>
          <div className="px-8 md:px-16 pt-0">
            <div className="flex-1">
              <TabsList className="w-full">
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
                <TabsTrigger value="themes">Themes</TabsTrigger>
                <TabsTrigger value="icp">ICP</TabsTrigger>
              </TabsList>
            </div>
          </div>
        </StickyHeader>
      
        <div className="flex-1 overflow-auto">
          <div className="p-6 md:p-8 space-y-6">
            <div className="px-0 md:px-8">
              <TabsContent value="analysis" className="h-full space-y-6 pt-2">
                <SegmentAnalysisTab segment={segment} />
              </TabsContent>
            </div>
            
            <div className="px-0 md:px-8">
              <TabsContent value="themes" className="h-full space-y-6 pt-2">
                <SegmentThemesTab segment={segment} />
              </TabsContent>
            </div>
            
            <div className="px-0 md:px-8">
              <TabsContent value="icp" className="h-full space-y-6 pt-2">
                <SegmentICPTab segment={segment} />
              </TabsContent>
            </div>
          </div>
        </div>
      </Tabs>
      
      <SegmentUrlModal 
        isOpen={isUrlModalOpen}
        setIsOpen={setIsUrlModalOpen}
        urlInput={urlInput}
        setUrlInput={setUrlInput}
        onSave={handleSaveUrl}
      />
    </div>
  )
} 