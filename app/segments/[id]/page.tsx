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
  HelpCircle,
  Pencil
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
// Removing TestMap import
// import TestMap from '@/app/components/TestMap'
// Removing SegmentSummaryTab import
// import { SegmentSummaryTab } from "./components/SegmentSummaryTab"
// Comentar o eliminar las importaciones que no existen
// import { ContentTab } from "./components/ContentTab"
import { Suspense } from "react"
import { notFound } from "next/navigation"

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
    profile?: any // Using any to avoid TypeScript errors with the complex profile structure
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
        // Agregar la dummy data del ICP profile para mostrar la UI
        if (!foundSegment.icp) {
          foundSegment.icp = {} as any;
        }
        
        (foundSegment.icp as any).profile = {
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
          psychographics: {
            values: [
              {
                name: "Efficiency",
                importance: "Very high",
                description: "Value optimizing operations to achieve better results"
              },
              {
                name: "Innovation",
                importance: "High",
                description: "Appreciate adopting new technologies and approaches"
              },
              {
                name: "Leadership",
                importance: "High",
                description: "Seek to lead their teams effectively and with vision"
              },
              {
                name: "Results-driven",
                importance: "High",
                description: "Focus on achieving tangible business outcomes"
              }
            ],
            interests: [
              "Business management",
              "Artificial intelligence",
              "Automation",
              "Leadership development",
              "Productivity tools"
            ],
            goals: [
              {
                name: "Operational efficiency",
                priority: "High",
                description: "Streamline operations to reduce costs and increase productivity"
              },
              {
                name: "Scalability",
                priority: "High",
                description: "Grow the business sustainably and efficiently"
              },
              {
                name: "Employee performance",
                priority: "Medium",
                description: "Enhance the performance and satisfaction of their teams"
              },
              {
                name: "Strategic decision-making",
                priority: "Medium",
                description: "Make informed decisions based on accurate data"
              }
            ],
            challenges: [
              {
                name: "Time management",
                severity: "High",
                description: "Balancing multiple responsibilities and tasks effectively"
              },
              {
                name: "Technology integration",
                severity: "High",
                description: "Seamlessly integrating new technologies into existing systems"
              },
              {
                name: "Data overload",
                severity: "Medium",
                description: "Managing and making sense of large volumes of data"
              }
            ],
            motivations: [
              {
                name: "Business growth",
                strength: "High",
                description: "Desire to expand and grow their business successfully"
              },
              {
                name: "Innovation leadership",
                strength: "Medium-high",
                description: "Drive to be at the forefront of industry innovation"
              },
              {
                name: "Operational excellence",
                strength: "Very high",
                description: "Achieve high levels of efficiency and effectiveness in operations"
              }
            ]
          },
          behavioralTraits: {
            onlineBehavior: {
              deviceUsage: {
                primary: "Desktop",
                secondary: "Mobile",
                tertiary: "Tablet"
              },
              socialPlatforms: [
                {
                  name: "LinkedIn",
                  usageFrequency: "Daily",
                  engagementLevel: "High",
                  relevance: "Very high"
                },
                {
                  name: "Twitter",
                  usageFrequency: "Weekly",
                  engagementLevel: "Medium",
                  relevance: "High"
                },
                {
                  name: "Facebook",
                  usageFrequency: "Weekly",
                  engagementLevel: "Medium",
                  relevance: "Medium-high"
                }
              ],
              browsingHabits: {
                peakHours: [
                  "Morning (6:00-9:00)",
                  "Afternoon (12:00-14:00)"
                ],
                contentPreferences: [
                  "Industry news",
                  "Leadership articles",
                  "Case studies"
                ]
              }
            },
            purchasingBehavior: {
              decisionFactors: [
                {
                  name: "ROI",
                  importance: "High",
                  description: "Focus on the return on investment when making purchases"
                },
                {
                  name: "Ease of Integration",
                  importance: "High",
                  description: "Prefer solutions that integrate smoothly with existing systems"
                },
                {
                  name: "Scalability",
                  importance: "Medium-high",
                  description: "Value solutions that can scale with business growth"
                }
              ],
              priceRange: {
                subscription: {
                  monthly: {
                    preference: "100-500 USD",
                    optimal: "Around 300 USD"
                  },
                  annual: {
                    preference: "1000-5000 USD",
                    optimal: "Around 3000 USD"
                  }
                },
                oneTime: {
                  preference: "500-3000 USD",
                  optimal: "Around 1500 USD"
                }
              },
              purchaseFrequency: {
                software: "Semi-annually",
                hardware: "Annually",
                education: "Quarterly"
              }
            },
            contentConsumption: {
              preferredFormats: [
                {
                  type: "Webinars",
                  preference: "High",
                  idealDuration: "30-60 minutes"
                },
                {
                  type: "Whitepapers",
                  preference: "Medium-high",
                  idealLength: "10-20 pages"
                },
                {
                  type: "Podcasts",
                  preference: "Medium",
                  idealDuration: "20-40 minutes"
                }
              ],
              researchHabits: {
                depth: "Deep",
                sources: [
                  "Industry reports",
                  "Expert opinions",
                  "Case studies"
                ],
                timeSpent: "3-5 hours before important decisions"
              }
            }
          },
          professionalContext: {
            industries: [
              "Technology",
              "Finance",
              "Healthcare",
              "Manufacturing"
            ],
            roles: [
              {
                title: "CEO",
                relevance: "Very high"
              },
              {
                title: "COO",
                relevance: "High"
              },
              {
                title: "CIO",
                relevance: "Medium-high"
              },
              {
                title: "VP of Operations",
                relevance: "Medium"
              }
            ],
            companySize: {
              primary: "Medium (51-200)",
              secondary: [
                "Large (201-500)",
                "Enterprise (500+)"
              ]
            },
            decisionMakingPower: {
              level: "High",
              description: "Hold significant influence and final decision-making power"
            },
            painPoints: [
              {
                name: "Operational inefficiencies",
                severity: "High",
                description: "Struggle with optimizing processes for better efficiency"
              },
              {
                name: "Employee productivity",
                severity: "Medium",
                description: "Challenges in maintaining high levels of employee performance"
              },
              {
                name: "Data management",
                severity: "Medium",
                description: "Difficulties in managing and utilizing data effectively"
              }
            ],
            tools: {
              current: [
                "Microsoft Office Suite",
                "Salesforce",
                "Slack",
                "Zoom",
                "Asana"
              ],
              desired: [
                "AI-driven analytics tools",
                "Advanced CRM systems",
                "Automation platforms"
              ]
            }
          },
          customAttributes: [
            {
              name: "Technology adoption level",
              value: "Early majority",
              description: "Adopt new technologies after they have been tested by early adopters"
            },
            {
              name: "Communication style",
              value: "Formal and strategic",
              description: "Prefer structured and strategic communication"
            },
            {
              name: "Price sensitivity",
              value: "Low",
              description: "Willing to invest in high-quality solutions with proven ROI"
            },
            {
              name: "Specialization level",
              value: "High",
              description: "Possess deep expertise in their industry and role"
            }
          ]
        };
        
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
      {/* Removing the TestMap component */}
      
      <Tabs defaultValue="analysis">
        <StickyHeader>
          <div className="px-16 pt-0">
            <TabsList>
              <TabsTrigger value="analysis">Analysis</TabsTrigger>
              <TabsTrigger value="icp">ICP Profiles</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
            </TabsList>
          </div>
        </StickyHeader>
        {/* Removing the overview tab */}
        <TabsContent value="analysis" className="px-16 py-6">
          <SegmentAnalysisTab segment={segment} />
        </TabsContent>
        <TabsContent value="icp" className="px-16 py-6">
          <SegmentICPTab segment={segment} />
        </TabsContent>
        <TabsContent value="content" className="px-16 py-6">
          {/* <ContentTab segmentId={params.id} /> */}
        </TabsContent>
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