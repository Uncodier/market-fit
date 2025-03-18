import React, { useState, useEffect } from 'react'
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Button } from "@/app/components/ui/button"
import { FileText, Copy, BarChart, CalendarIcon, FileVideo, Download, Link, Mail } from "@/app/components/ui/icons"
import { Segment } from "../page"

// Define content types for columns
const CONTENT_TYPES = [
  { id: 'post', name: 'Blog Posts' },
  { id: 'video', name: 'Videos' },
  { id: 'download', name: 'Resources' },
  { id: 'social', name: 'Social Media' },
  { id: 'email', name: 'Email Content' }
]

// Define colors for different content types
const CONTENT_TYPE_COLORS: Record<string, string> = {
  post: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  video: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  download: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  social: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  email: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
}

// Define icons for different content types
const CONTENT_TYPE_ICONS: Record<string, React.ReactElement> = {
  post: <FileText className="h-[39px] w-[39px]" />,
  video: <FileVideo className="h-[39px] w-[39px]" />,
  download: <Download className="h-[39px] w-[39px]" />,
  social: <Link className="h-[39px] w-[39px]" />,
  email: <Mail className="h-[39px] w-[39px]" />,
  default: <FileText className="h-[39px] w-[39px]" />
}

// Define the content recommendation interface
interface ContentRecommendation {
  id: string
  type: string
  title: string
  description: string
  url: string
  duration?: {
    unit: string
    value: number
  }
  topics: string[]
  funnelStage: string
  relevanceScore: number
  engagementPrediction: {
    score: number
    metrics: Record<string, string>
  }
  format?: string
  readingLevel?: string
  difficultyLevel?: string
  popularity: Record<string, number>
  fileType?: string
  fileSize?: string
  subscriptionRequired?: boolean
}

interface ContentIdeasKanbanProps {
  segment: Segment
}

export function ContentIdeasKanban({ segment }: ContentIdeasKanbanProps) {
  // Sample data based on the provided JSON
  const sampleData: ContentRecommendation[] = [
    {
      id: "post_12345",
      type: "post",
      title: "10 Herramientas Esenciales para Creadores de Contenido en 2024",
      description: "Descubre las mejores herramientas que todo creador de contenido debería conocer para optimizar su flujo de trabajo y mejorar la calidad de sus producciones.",
      url: "https://ejemplo.com/blog/herramientas-creadores-contenido-2024",
      duration: {
        unit: "minutes",
        value: 8
      },
      topics: [
        "herramientas digitales",
        "productividad",
        "creación de contenido"
      ],
      funnelStage: "consideration",
      relevanceScore: 0.95,
      engagementPrediction: {
        score: 0.89,
        metrics: {
          timeOnPage: "High",
          clickProbability: "Very high",
          conversionPotential: "Medium-high"
        }
      },
      format: "longform",
      readingLevel: "intermediate",
      popularity: {
        views: 12560,
        shares: 342,
        comments: 48
      }
    },
    {
      id: "post_67890",
      type: "post",
      title: "Cómo Optimizar tu Estrategia de Contenido para SEO en 2024",
      description: "Aprende las últimas técnicas y mejores prácticas para mejorar el posicionamiento de tu contenido en los motores de búsqueda.",
      url: "https://ejemplo.com/blog/estrategia-seo-contenido-2024",
      duration: {
        unit: "minutes",
        value: 12
      },
      topics: [
        "SEO",
        "marketing digital",
        "estrategia de contenido"
      ],
      funnelStage: "awareness",
      relevanceScore: 0.92,
      engagementPrediction: {
        score: 0.85,
        metrics: {
          timeOnPage: "Medium-high",
          clickProbability: "High",
          conversionPotential: "Medium"
        }
      },
      format: "guide",
      readingLevel: "intermediate",
      popularity: {
        views: 9870,
        shares: 278,
        comments: 32
      }
    },
    {
      id: "video_56789",
      type: "video",
      title: "Tutorial: Edición Profesional de Video en Menos de 30 Minutos",
      description: "Aprende técnicas rápidas de edición profesional que te permitirán crear videos de alta calidad sin pasar horas frente al ordenador.",
      url: "https://ejemplo.com/videos/tutorial-edicion-profesional-rapida",
      duration: {
        unit: "minutes",
        value: 18
      },
      topics: [
        "edición de video",
        "tutoriales",
        "productividad"
      ],
      funnelStage: "consideration",
      relevanceScore: 0.94,
      engagementPrediction: {
        score: 0.92,
        metrics: {
          watchTime: "High",
          completionRate: "Medium-high",
          interactionRate: "High"
        }
      },
      format: "tutorial",
      difficultyLevel: "intermediate",
      popularity: {
        views: 8790,
        likes: 756,
        shares: 189
      }
    },
    {
      id: "download_23456",
      type: "download",
      title: "Kit de Plantillas para Redes Sociales - Edición Creadores",
      description: "Descarga este conjunto de 15 plantillas editables para Instagram, TikTok y YouTube que te ayudarán a mantener una presencia visual consistente.",
      url: "https://ejemplo.com/recursos/kit-plantillas-redes-sociales",
      fileType: "ZIP (PSD, AI, Canva)",
      fileSize: "48.5 MB",
      topics: [
        "diseño",
        "recursos gráficos",
        "redes sociales"
      ],
      funnelStage: "decision",
      relevanceScore: 0.91,
      engagementPrediction: {
        score: 0.87,
        metrics: {
          downloadProbability: "Very high",
          leadConversion: "High",
          customerJourney: "Accelerator"
        }
      },
      popularity: {
        downloads: 3456,
        averageRating: 4.8
      },
      subscriptionRequired: true
    },
    {
      id: "social_34567",
      type: "social",
      title: "Serie de Posts: Tendencias de Marketing Digital para 2024",
      description: "Conjunto de 5 posts para redes sociales sobre las tendencias más importantes en marketing digital para el próximo año.",
      url: "https://ejemplo.com/social/tendencias-marketing-2024",
      topics: [
        "marketing digital",
        "tendencias",
        "redes sociales"
      ],
      funnelStage: "awareness",
      relevanceScore: 0.89,
      engagementPrediction: {
        score: 0.91,
        metrics: {
          engagement: "Very high",
          shareability: "High",
          reachPotential: "Medium-high"
        }
      },
      popularity: {
        likes: 2450,
        shares: 890,
        comments: 156
      }
    },
    {
      id: "email_45678",
      type: "email",
      title: "Secuencia de Onboarding para Nuevos Suscriptores",
      description: "Serie de 4 emails para dar la bienvenida y orientar a nuevos suscriptores sobre los recursos disponibles para creadores de contenido.",
      url: "https://ejemplo.com/email/onboarding-creadores",
      topics: [
        "email marketing",
        "onboarding",
        "nurturing"
      ],
      funnelStage: "consideration",
      relevanceScore: 0.93,
      engagementPrediction: {
        score: 0.88,
        metrics: {
          openRate: "High",
          clickThroughRate: "Medium-high",
          conversionRate: "Medium"
        }
      },
      popularity: {
        openRate: 42.5,
        clickRate: 18.3,
        conversionRate: 5.2
      }
    }
  ]

  // State to track content items by type
  const [contentByType, setContentByType] = useState<Record<string, ContentRecommendation[]>>({})
  // State to track copy button states
  const [copyStates, setCopyStates] = useState<Record<string, boolean>>({})

  // Initialize content by type
  useEffect(() => {
    const initialContentByType: Record<string, ContentRecommendation[]> = {}
    
    // Initialize empty arrays for each content type
    CONTENT_TYPES.forEach(type => {
      initialContentByType[type.id] = []
    })
    
    // Distribute sample data into types
    sampleData.forEach(item => {
      const type = item.type || 'default'
      if (initialContentByType[type]) {
        initialContentByType[type].push(item)
      } else {
        // If type doesn't match any predefined types, add to default
        if (!initialContentByType['default']) {
          initialContentByType['default'] = []
        }
        initialContentByType['default'].push(item)
      }
    })
    
    setContentByType(initialContentByType)
  }, [])

  // Function to copy content to clipboard
  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopyStates(prev => ({
        ...prev,
        [id]: true
      }))
      setTimeout(() => {
        setCopyStates(prev => ({
          ...prev,
          [id]: false
        }))
      }, 2000)
    } catch (err) {
      console.error('Error copying to clipboard:', err)
    }
  }

  // Function to render content card
  const renderContentCard = (content: ContentRecommendation) => {
    const typeColor = CONTENT_TYPE_COLORS[content.type] || CONTENT_TYPE_COLORS.default
    const typeIcon = CONTENT_TYPE_ICONS[content.type] || CONTENT_TYPE_ICONS.default
    
    return (
      <Card className="mb-3 transition-all duration-200 hover:shadow-md hover:translate-y-[-2px]">
        <CardContent className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary rounded-full flex items-center justify-center" style={{ width: '39px', height: '39px' }}>
                {typeIcon}
              </div>
              <Badge className={typeColor}>
                {content.funnelStage.charAt(0).toUpperCase() + content.funnelStage.slice(1)}
              </Badge>
            </div>
            <Badge variant="outline" className="text-xs">
              {content.relevanceScore * 100}% Match
            </Badge>
          </div>
          
          <h3 className="font-medium text-sm mt-2 line-clamp-2">{content.title}</h3>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{content.description}</p>
          
          <div className="flex flex-wrap gap-1 mt-2">
            {content.topics.slice(0, 2).map((topic, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {topic}
              </Badge>
            ))}
            {content.topics.length > 2 && (
              <Badge variant="secondary" className="text-xs">
                +{content.topics.length - 2}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              {content.duration && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {content.duration.value} {content.duration.unit}
                </div>
              )}
              {content.popularity && (
                <div className="flex items-center text-xs text-muted-foreground">
                  <BarChart className="h-3 w-3 mr-1" />
                  {content.popularity.views || 
                   content.popularity.downloads || 
                   content.popularity.likes || 
                   content.popularity.openRate || 0}
                </div>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 rounded-full text-xs text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation()
                copyToClipboard(content.title, content.id)
              }}
            >
              <Copy className="h-3 w-3 mr-1" />
              {copyStates[content.id] ? "Copied!" : "Copy"}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-[calc(100vh-12rem)] overflow-hidden">
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {CONTENT_TYPES.map(type => (
          <div key={type.id} className="flex-shrink-0 w-80">
            <div className="bg-background rounded-t-md p-3 border-b border-x border-t">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm">{type.name}</h3>
                <Badge variant="outline" className="text-xs">
                  {contentByType[type.id]?.length || 0}
                </Badge>
              </div>
            </div>
            <div className="bg-muted/30 rounded-b-md h-[calc(100%-2.5rem)] border-b border-x">
              <ScrollArea className="h-full p-2">
                {contentByType[type.id]?.length > 0 ? (
                  contentByType[type.id].map((item) => (
                    <div key={item.id}>
                      {renderContentCard(item)}
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                    No {type.name.toLowerCase()} ideas
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 