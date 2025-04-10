"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Input } from "@/app/components/ui/input"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Search, List, TableRows, ZoomIn, ZoomOut, Maximize, ChevronUp, ChevronDown } from "@/app/components/ui/icons"
import { AgentList } from "@/app/components/agents/agent-list"
import { Agent, AgentType, AgentActivity } from "@/app/types/agents"
import { AgentCard } from "@/app/components/agents/agent-card"
import { ToggleGroup, ToggleGroupItem } from "@/app/components/ui/toggle-group"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { MessageSquare, Pencil, PlayCircle } from "@/app/components/ui/icons"
import * as Icons from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { agentStatusVariants, agentCardVariants, metricItemVariants } from "@/app/components/agents/agent-card.styles"
import { useLayout } from "@/app/context/LayoutContext"

// Define agent activities based on roles
const growthLeadActivities: AgentActivity[] = [
  {
    id: "gl1",
    name: "Task Monitoring",
    description: "Track progress of assigned tasks and ensure timely completion of deliverables",
    estimatedTime: "15-20 min",
    successRate: 95,
    executions: 142,
    status: "available"
  },
  {
    id: "gl2",
    name: "Stakeholder Coordination",
    description: "Facilitate decision-making processes with key stakeholders and project owners",
    estimatedTime: "25-30 min",
    successRate: 91,
    executions: 87,
    status: "available"
  },
  {
    id: "gl3",
    name: "Vendor Management",
    description: "Monitor vendor relationships, deliverables and ensure alignment with project goals",
    estimatedTime: "30-35 min",
    successRate: 88,
    executions: 63,
    status: "available"
  },
  {
    id: "gl4",
    name: "Task Validation",
    description: "Review completed tasks against requirements and provide quality assurance",
    estimatedTime: "20-25 min",
    successRate: 94,
    executions: 98,
    status: "available"
  },
  {
    id: "gl5",
    name: "Team Coordination",
    description: "Facilitate cross-functional collaboration, resolve conflicts and align team efforts with strategic goals",
    estimatedTime: "25-35 min",
    successRate: 93,
    executions: 117,
    status: "available"
  }
];

const dataAnalystActivities: AgentActivity[] = [
  {
    id: "da1",
    name: "User Behavior Analysis",
    description: "Analyze user activity patterns and engagement metrics across website and mobile app",
    estimatedTime: "25-30 min",
    successRate: 93,
    executions: 112,
    status: "available"
  },
  {
    id: "da2",
    name: "Sales Trend Analysis",
    description: "Identify and interpret sales patterns, growth opportunities and conversion metrics",
    estimatedTime: "20-25 min",
    successRate: 95,
    executions: 87,
    status: "available"
  },
  {
    id: "da3",
    name: "Cost Trend Analysis",
    description: "Monitor expense patterns, identify cost optimization opportunities and ROI evaluation",
    estimatedTime: "20-25 min",
    successRate: 91,
    executions: 74,
    status: "available"
  },
  {
    id: "da4",
    name: "Cohort Health Monitoring",
    description: "Track customer cohort performance, retention metrics, and lifetime value analysis",
    estimatedTime: "30-35 min",
    successRate: 89,
    executions: 68,
    status: "available"
  },
  {
    id: "da5",
    name: "Data-Driven Task Validation",
    description: "Verify completed tasks against performance data and validate with metric-based evidence",
    estimatedTime: "15-20 min",
    successRate: 96,
    executions: 94,
    status: "available"
  }
];

const marketingActivities: AgentActivity[] = [
  {
    id: "mk1",
    name: "Create Marketing Campaign",
    description: "Develop a complete marketing campaign with creative, copy, and channel strategy",
    estimatedTime: "45-60 min",
    successRate: 90,
    executions: 62,
    status: "available"
  },
  {
    id: "mk2",
    name: "SEO Content Optimization",
    description: "Analyze and optimize website content for better search performance",
    estimatedTime: "30-35 min",
    successRate: 88,
    executions: 93,
    status: "available"
  },
  {
    id: "mk3",
    name: "A/B Test Design",
    description: "Create statistically valid A/B tests for landing pages or email campaigns",
    estimatedTime: "20-25 min",
    successRate: 92,
    executions: 104,
    status: "available"
  },
  {
    id: "mk4",
    name: "Analyze Segments",
    description: "Identify and analyze customer segments to optimize targeting and conversion strategies",
    estimatedTime: "25-30 min",
    successRate: 94,
    executions: 78,
    status: "available"
  },
  {
    id: "mk5",
    name: "Campaign Requirements Creation",
    description: "Develop detailed specifications and requirements documentation for marketing campaigns",
    estimatedTime: "30-40 min",
    successRate: 91,
    executions: 56,
    status: "available"
  }
];

const uxActivities: AgentActivity[] = [
  {
    id: "ux1",
    name: "Website Analysis",
    description: "Conduct comprehensive evaluation of website usability, information architecture and user experience",
    estimatedTime: "30-40 min",
    successRate: 92,
    executions: 67,
    status: "available"
  },
  {
    id: "ux2",
    name: "Application Analysis",
    description: "Evaluate mobile and desktop applications for usability issues, interaction design and user flows",
    estimatedTime: "35-45 min",
    successRate: 90,
    executions: 58,
    status: "available"
  },
  {
    id: "ux3",
    name: "Product Requirements Creation",
    description: "Develop detailed user-centered product requirements, specifications and design documentation",
    estimatedTime: "40-50 min",
    successRate: 88,
    executions: 42,
    status: "available"
  }
];

const salesActivities: AgentActivity[] = [
  {
    id: "sl1",
    name: "Lead Follow-up Management",
    description: "Systematically track and engage with leads through personalized communication sequences",
    estimatedTime: "20-25 min",
    successRate: 87,
    executions: 126,
    status: "available"
  },
  {
    id: "sl2",
    name: "Appointment Generation",
    description: "Create and schedule qualified sales meetings with prospects through effective outreach",
    estimatedTime: "15-20 min",
    successRate: 83,
    executions: 98,
    status: "available"
  },
  {
    id: "sl3",
    name: "Lead Generation",
    description: "Identify and qualify potential customers through various channels and targeting strategies",
    estimatedTime: "25-30 min",
    successRate: 85,
    executions: 112,
    status: "available"
  },
  {
    id: "sl4",
    name: "Lead Profile Research",
    description: "Analyze prospect backgrounds, needs, and pain points to create personalized sales approaches",
    estimatedTime: "20-25 min",
    successRate: 89,
    executions: 76,
    status: "available"
  },
  {
    id: "sl5",
    name: "Generate Sales Order",
    description: "Create complete sales orders with product details, pricing, and customer information",
    estimatedTime: "15-20 min",
    successRate: 94,
    executions: 83,
    status: "available"
  }
];

const customerSupportActivities: AgentActivity[] = [
  {
    id: "cs1",
    name: "Knowledge Base Management",
    description: "Create, update, and organize product documentation and user guides for self-service support",
    estimatedTime: "30-35 min",
    successRate: 94,
    executions: 84,
    status: "available"
  },
  {
    id: "cs2",
    name: "FAQ Development",
    description: "Identify common customer questions and create comprehensive answers for quick resolution",
    estimatedTime: "20-25 min",
    successRate: 96,
    executions: 112,
    status: "available"
  },
  {
    id: "cs3",
    name: "Escalation Management",
    description: "Handle complex customer issues and escalate to appropriate teams with complete context",
    estimatedTime: "25-30 min",
    successRate: 89,
    executions: 73,
    status: "available"
  }
];

const contentActivities: AgentActivity[] = [
  {
    id: "ct1",
    name: "Content Calendar Creation",
    description: "Develop a content calendar with themes, topics, and publishing schedule",
    estimatedTime: "30-40 min",
    successRate: 93,
    executions: 58,
    status: "available"
  },
  {
    id: "ct2",
    name: "Email Sequence Copywriting",
    description: "Write engaging email sequences for nurturing prospects through the funnel",
    estimatedTime: "40-50 min",
    successRate: 87,
    executions: 72,
    status: "available"
  },
  {
    id: "ct3",
    name: "Landing Page Copywriting",
    description: "Create persuasive, conversion-focused copy for landing pages",
    estimatedTime: "25-35 min",
    successRate: 89,
    executions: 84,
    status: "available"
  }
];

export const agents: Agent[] = [
  {
    id: "1",
    name: "Growth Lead/Manager",
    description: "Strategy integration, team coordination, budget management, KPI tracking",
    type: "marketing",
    status: "active",
    conversations: 425,
    successRate: 92,
    lastActive: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    icon: "BarChart",
    activities: growthLeadActivities
  },
  {
    id: "4",
    name: "Data Analyst",
    description: "Data analysis, lead qualification, segmentation, performance metrics, optimization",
    type: "marketing",
    status: "active",
    conversations: 189,
    successRate: 94,
    lastActive: "2024-01-26",
    icon: "PieChart",
    activities: dataAnalystActivities
  },
  {
    id: "2",
    name: "Growth Marketer",
    description: "Marketing strategy, omnichannel campaigns, A/B testing, SEO techniques",
    type: "marketing",
    status: "active",
    conversations: 312,
    successRate: 88,
    lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    icon: "TrendingUp",
    activities: marketingActivities
  },
  {
    id: "3",
    name: "UX Designer",
    description: "Conversion optimization, UX/UI design for funnel, onboarding experience",
    type: "marketing",
    status: "active",
    conversations: 156,
    successRate: 83,
    lastActive: "2024-01-25",
    icon: "Smartphone",
    activities: uxActivities
  },
  {
    id: "5",
    name: "Sales/CRM Specialist",
    description: "Lead management, demos, systematic follow-up, sales cycle",
    type: "sales",
    status: "active",
    conversations: 278,
    successRate: 86,
    lastActive: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(),
    icon: "ShoppingCart",
    activities: salesActivities
  },
  {
    id: "7",
    name: "Customer Support",
    description: "Knowledge base management, FAQ development, customer issue escalation",
    type: "sales",
    status: "active",
    conversations: 342,
    successRate: 91,
    lastActive: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    icon: "HelpCircle",
    activities: customerSupportActivities
  },
  {
    id: "6",
    name: "Content Creator & Copywriter",
    description: "Persuasive copywriting, site content, blog posts, email sequences",
    type: "marketing",
    status: "active",
    conversations: 209,
    successRate: 85,
    lastActive: "2024-01-24",
    icon: "FileText",
    activities: contentActivities
  }
]

// Componente para la actividad del agente (estilo playlist de álbum)
function AgentActivityItem({ 
  activity, 
  onExecute,
  viewMode = "vertical"
}: { 
  activity: AgentActivity,
  onExecute: (activity: AgentActivity) => void,
  viewMode?: "vertical" | "horizontal"
}) {
  return (
    <div 
      className={cn(
        "group flex items-center justify-between hover:bg-accent/50 rounded-md transition-colors",
        viewMode === "horizontal" ? "px-3 py-2.5" : "px-4 py-3"
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-8 flex items-center justify-center">
          <span className="text-sm font-medium text-muted-foreground group-hover:hidden">
            {activity.id.split('').pop()}
          </span>
          <button 
            onClick={() => onExecute(activity)}
            className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label={`Execute ${activity.name}`}
          >
            <PlayCircle className="h-4 w-4" />
          </button>
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className={cn(
            "font-medium truncate",
            viewMode === "horizontal" ? "text-xs" : "text-sm"
          )}>{activity.name}</h4>
          <p className={cn(
            "text-muted-foreground truncate",
            viewMode === "horizontal" ? "text-[0.7rem]" : "text-xs"
          )}>{activity.description}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <span className={cn(
          "text-muted-foreground whitespace-nowrap",
          viewMode === "horizontal" ? "text-[0.7rem]" : "text-xs"
        )}>{activity.estimatedTime}</span>
        <span className={cn(
          "text-foreground font-medium whitespace-nowrap",
          viewMode === "horizontal" ? "text-[0.7rem]" : "text-xs"
        )}>{activity.successRate}%</span>
        <span className={cn(
          "text-muted-foreground whitespace-nowrap",
          viewMode === "horizontal" ? "text-[0.7rem]" : "text-xs"
        )}>{activity.executions}</span>
      </div>
    </div>
  );
}

// Componente para el listado de actividades del agente
function AgentActivityList({
  agent,
  onExecute,
  viewMode = "vertical",
  hideTitle = false
}: {
  agent: Agent,
  onExecute: (agent: Agent, activity: AgentActivity) => void,
  viewMode?: "vertical" | "horizontal",
  hideTitle?: boolean
}) {
  if (!agent.activities || agent.activities.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">No activities available for this agent</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "space-y-2",
      viewMode === "horizontal" ? "max-w-[500px] p-0" : "w-full p-4 space-y-4"
    )}>
      {!hideTitle && (
        <div className="flex items-center justify-between px-3 pt-1.5">
          <h3 className={cn(
            "font-semibold",
            viewMode === "horizontal" ? "text-base" : "text-lg"
          )}>
            {viewMode === "horizontal" ? "Activities" : "Agent Activities"}
          </h3>
          
          {viewMode === "horizontal" && (
            <Badge variant="outline" className="px-2 py-0.5 text-xs">
              {agent.activities.length} activities
            </Badge>
          )}
        </div>
      )}
      
      <div className={cn(
        "overflow-hidden",
        viewMode === "horizontal" ? "" : "border rounded-md"
      )}>
        <div className={cn(
          "px-4 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground",
          viewMode === "horizontal" ? "bg-card/70 border-y" : "bg-muted/50"
        )}>
          <div className="flex items-center gap-3">
            <span className="w-8">#</span>
            <span>Activity</span>
          </div>
          <div className="flex items-center gap-6">
            <span>Time</span>
            <span>Success</span>
            <span>Runs</span>
          </div>
        </div>
        
        <div className={cn(
          "divide-y divide-border max-h-[300px] overflow-y-auto",
          viewMode === "horizontal" && "divide-border/50"
        )}>
          {agent.activities.map(activity => (
            <AgentActivityItem 
              key={activity.id} 
              activity={activity} 
              onExecute={(activity) => onExecute(agent, activity)}
              viewMode={viewMode}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Componente simplificado para la vista de árbol (sin widgets de métricas)
function SimpleAgentCard({ 
  agent, 
  onManage, 
  onChat,
  onToggleActivities,
  showActivities = false,
  onExecuteActivity,
  className 
}: {
  agent: Agent
  onManage?: (agent: Agent) => void
  onChat?: (agent: Agent) => void
  onToggleActivities?: (agent: Agent) => void
  showActivities?: boolean
  onExecuteActivity?: (agent: Agent, activity: AgentActivity) => void
  className?: string
}) {
  // Función para obtener el componente de icono basado en el nombre
  const getIconComponent = (iconName: string) => {
    // @ts-ignore - Icons es un objeto que contiene todos los iconos
    return Icons[iconName] || Icons.User;
  };
  
  // Obtener el componente de icono
  const IconComponent = getIconComponent(agent.icon);

  return (
    <div className={cn(
      "flex flex-col",
      className
    )}>
      <Card 
        className={cn(
          "h-auto flex flex-col",
          agentCardVariants({ hover: true }),
        )}
      >
        <CardHeader className="pb-4 flex-none">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3 min-w-0">
              <Avatar className="h-10 w-10 ring-2 ring-background flex-none">
                <AvatarImage 
                  src={`/avatars/agent-${agent.id}.png`} 
                  alt={`${agent.name}'s avatar`} 
                />
                <AvatarFallback className="bg-primary/10">
                  <IconComponent className="h-5 w-5" aria-hidden={true} />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="text-lg font-semibold leading-none mb-1.5 truncate">
                  {agent.name}
                </CardTitle>
                <CardDescription 
                  className="truncate text-sm"
                  title={agent.description}
                >
                  {agent.description}
                </CardDescription>
              </div>
            </div>
            <Badge 
              className={cn(
                "flex-none mt-1",
                agentStatusVariants({ status: agent.status })
              )}
              aria-label={`Agent status: ${agent.status}`}
            >
              {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        
        {/* Activities section inside the card */}
        {showActivities && agent.activities && agent.activities.length > 0 && (
          <div className="border-t border-border">
            <div className="px-3 py-2.5 border-b flex items-center justify-between bg-muted/30">
              <h3 className="text-sm font-semibold">Activities</h3>
              <Badge variant="outline" className="px-2 py-0.5 text-xs">
                {agent.activities.length} activities
              </Badge>
            </div>
            
            <div className="divide-y divide-border">
              <div className="px-4 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground bg-muted/20">
                <div className="flex items-center gap-3">
                  <span className="w-8">#</span>
                  <span>Activity</span>
                </div>
                <div className="flex items-center gap-6">
                  <span>Time</span>
                  <span>Success</span>
                  <span>Runs</span>
                </div>
              </div>
              
              <div className="divide-y divide-border/50">
                {agent.activities.map(activity => (
                  <AgentActivityItem 
                    key={activity.id} 
                    activity={activity} 
                    onExecute={(activity) => onExecuteActivity?.(agent, activity)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        
        <CardFooter className={cn(
          "flex gap-2 flex-none",
          showActivities ? "pt-4 pb-4" : "pt-2 pb-4"
        )}>
          <Button 
            variant="outline" 
            className="flex-1 h-9"
            onClick={() => onManage?.(agent)}
            aria-label={`Manage ${agent.name}`}
          >
            <Pencil className="h-4 w-4 mr-2" aria-hidden={true} />
            Manage Agent
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 h-9"
            onClick={() => onChat?.(agent)}
            aria-label={`Chat with ${agent.name}`}
          >
            <MessageSquare className="h-4 w-4 mr-2" aria-hidden={true} />
            Chat
          </Button>
        </CardFooter>
        
        {/* Toggle Activities Button */}
        <div className="border-t pt-1 pb-1 flex justify-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full flex items-center justify-center gap-1.5 h-7 rounded-none hover:bg-accent/70 transition-colors text-xs font-medium text-muted-foreground"
            onClick={() => onToggleActivities?.(agent)}
          >
            {showActivities ? (
              <>
                Hide Activities
                <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Show Activities ({agent.activities?.length || 0})
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}

// Componente para el canvas con zoom
function ZoomableCanvas({ 
  children, 
  className,
  isMenuCollapsed = false
}: { 
  children: React.ReactNode,
  className?: string
  isMenuCollapsed?: boolean
}) {
  // Use the layout context to get the current state
  const { isLayoutCollapsed } = useLayout();
  
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startDragPosition, setStartDragPosition] = useState({ x: 0, y: 0 });
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const [contentDimensions, setContentDimensions] = useState({ width: 0, height: 0 });
  const [isInitialized, setIsInitialized] = useState(false);
  const [maxZoom, setMaxZoom] = useState(1);
  
  // Log cuando cambia el estado del menú
  useEffect(() => {
    console.log("ZoomableCanvas - isMenuCollapsed (prop):", isMenuCollapsed);
    console.log("ZoomableCanvas - isLayoutCollapsed (context):", isLayoutCollapsed);
  }, [isMenuCollapsed, isLayoutCollapsed]);

  // Define CSS variables for the dot pattern
  useEffect(() => {
    // Add CSS variables for the dots pattern
    document.documentElement.style.setProperty('--dots-color-light', 'rgba(0, 0, 0, 0.07)');
    document.documentElement.style.setProperty('--dots-color-dark', 'rgba(255, 255, 255, 0.07)');
    document.documentElement.style.setProperty('--dots-size', '24px');
    document.documentElement.style.setProperty('--dots-radius', '1px');
    
    return () => {
      // Clean up when component unmounts
      document.documentElement.style.removeProperty('--dots-color-light');
      document.documentElement.style.removeProperty('--dots-color-dark');
      document.documentElement.style.removeProperty('--dots-size');
      document.documentElement.style.removeProperty('--dots-radius');
    };
  }, []);

  // Detectar el tema para usar el color adecuado de los puntos
  useEffect(() => {
    const updateDotColor = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      document.documentElement.style.setProperty(
        '--theme-dots-color', 
        isDarkMode ? 'var(--dots-color-dark)' : 'var(--dots-color-light)'
      );
    };

    // Configurar inicialmente
    updateDotColor();

    // Observar cambios en el tema
    const observer = new MutationObserver(updateDotColor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  // Función para medir el tamaño real del contenido sin ninguna transformación
  const measureContent = useCallback(() => {
    return new Promise<{width: number, height: number}>(resolve => {
      if (!contentRef.current) {
        resolve({width: 0, height: 0});
        return;
      }

      // Guardar la transformación actual
      const originalTransform = contentRef.current.style.transform;
      
      // Eliminar todas las transformaciones para medir el tamaño real
      contentRef.current.style.transform = 'none';
      
      // Forzar reflow para que las medidas sean precisas
      void contentRef.current.offsetWidth;
      
      // Medir el contenido
      const rect = contentRef.current.getBoundingClientRect();
      const dimensions = {
        width: rect.width,
        height: rect.height
      };
      
      // Restaurar la transformación original
      contentRef.current.style.transform = originalTransform;
      
      // Guardar las dimensiones para uso futuro
      setContentDimensions(dimensions);
      
      // Calcular el zoom máximo para que el contenido siempre sea visible en su ancho
      if (wrapperRef.current && dimensions.width > 0) {
        const wrapperWidth = wrapperRef.current.clientWidth;
        const newMaxZoom = wrapperWidth / dimensions.width;
        setMaxZoom(Math.min(1, newMaxZoom * 0.95)); // 5% de margen
      }
      
      // Devolver las dimensiones
      resolve(dimensions);
    });
  }, []);

  // Función para calcular la transformación óptima (fit/contain)
  const calculateContainTransform = useCallback(async () => {
    if (!canvasRef.current) return { scale: 1, x: 0, y: 0 };
    
    // Si no tenemos las dimensiones del contenido, las medimos
    let contentSize = contentDimensions;
    if (contentSize.width === 0 || contentSize.height === 0) {
      contentSize = await measureContent();
    }
    
    // Si sigue siendo 0, es que algo falló
    if (contentSize.width === 0 || contentSize.height === 0) {
      return { scale: 1, x: 0, y: 0 };
    }
    
    // Obtener dimensiones del canvas
    const canvasRect = canvasRef.current.getBoundingClientRect();
    
    // Calcular la escala para que todo el contenido quepa
    // Dejamos un margen del 15% alrededor del contenido para evitar cortes
    const margin = 0.15;
    const scaleX = (canvasRect.width * (1 - margin)) / contentSize.width;
    const scaleY = (canvasRect.height * (1 - margin)) / contentSize.height;
    
    // Usar la escala más pequeña (para que quepa en ambas dimensiones)
    // y limitarla a 0.85 como máximo
    const newScale = Math.min(scaleX, scaleY, 0.85);
    
    // Calcular posición para centrar el contenido
    const newX = (canvasRect.width - contentSize.width * newScale) / 2;
    const newY = (canvasRect.height * 0.05); // Desplazar un poco hacia arriba
    
    return { scale: newScale, x: newX, y: newY };
  }, [contentDimensions, measureContent]);

  // Función para aplicar la transformación óptima (contain)
  const applyContainTransform = useCallback(async () => {
    const { scale: newScale, x: newX, y: newY } = await calculateContainTransform();
    
    // Aplicar la transformación
    setScale(newScale);
    setPosition({ x: newX, y: newY });
    setIsZoomedIn(false); // Resetear el estado de zoom
    
    // También aplicar directamente al DOM para evitar retrasos
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${newScale})`;
    }

    // Actualizar también el fondo de puntos
    if (backgroundRef.current) {
      backgroundRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${newScale})`;
    }
  }, [calculateContainTransform]);

  // Medir el contenido al montar y cuando cambia
  useEffect(() => {
    if (!isInitialized) {
      // Dar tiempo para que el DOM se renderice completamente
      const timer = setTimeout(async () => {
        await measureContent();
        await applyContainTransform();
        setIsInitialized(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isInitialized, measureContent, applyContainTransform]);

  // Reajustar cuando cambia el tamaño de la ventana o el estado del menú
  useEffect(() => {
    const handleResize = async () => {
      if (isInitialized) {
        await measureContent(); // Recalcular el maxZoom cuando cambia el tamaño
        await applyContainTransform();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Reajustar cuando cambia el estado del menú
    if (isInitialized) {
      // Evitamos llamar a measureContent aquí para prevenir loops infinitos
      applyContainTransform();
    }
    
    return () => window.removeEventListener('resize', handleResize);
  }, [isInitialized, isLayoutCollapsed, applyContainTransform, measureContent]);

  // Botón de reset: usar exactamente el mismo algoritmo que la carga inicial
  const resetView = useCallback(() => {
    // Evitamos medir el contenido aquí para prevenir loops
    // Usamos solo los datos ya calculados
    calculateContainTransform().then(({ scale: newScale, x: newX, y: newY }) => {
      setScale(newScale);
      setPosition({ x: newX, y: newY });
      setIsZoomedIn(false);
      
      if (contentRef.current) {
        contentRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${newScale})`;
      }
      
      // Actualizar también el fondo de puntos
      if (backgroundRef.current) {
        backgroundRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${newScale})`;
      }
    });
  }, [calculateContainTransform]);

  // Función para aumentar el zoom
  const zoomIn = useCallback(() => {
    setScale(prev => {
      const newScale = prev + 0.1;
      // Activar el estado de zoom cuando superamos cierto umbral
      if (newScale > 0.9) {
        setIsZoomedIn(true);
      }
      
      // Ajustar la posición para mantener el centro
      if (canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const centerX = canvasRect.width / 2;
        const centerY = canvasRect.height / 2;
        
        const scaleRatio = newScale / prev;
        const newX = centerX - (centerX - position.x) * scaleRatio;
        const newY = centerY - (centerY - position.y) * scaleRatio;
        
        setPosition({ x: newX, y: newY });
        
        // Actualizar la transformación del contenido
        if (contentRef.current) {
          contentRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${newScale})`;
        }
        
        // Actualizar también el fondo de puntos
        if (backgroundRef.current) {
          backgroundRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${newScale})`;
        }
      }
      
      return newScale;
    });
  }, [position, maxZoom]);

  // Función para disminuir el zoom
  const zoomOut = useCallback(() => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.1, 0.3);
      
      // Desactivar el estado de zoom cuando volvemos a un nivel bajo
      if (newScale <= 0.9) {
        setIsZoomedIn(false);
      }
      
      // Ajustar la posición para mantener el centro
      if (canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        const centerX = canvasRect.width / 2;
        const centerY = canvasRect.height / 2;
        
        const scaleRatio = newScale / prev;
        const newX = centerX - (centerX - position.x) * scaleRatio;
        const newY = centerY - (centerY - position.y) * scaleRatio;
        
        setPosition({ x: newX, y: newY });
        
        // Actualizar la transformación del contenido
        if (contentRef.current) {
          contentRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${newScale})`;
        }
        
        // Actualizar también el fondo de puntos
        if (backgroundRef.current) {
          backgroundRef.current.style.transform = `translate(${newX}px, ${newY}px) scale(${newScale})`;
        }
      }
      
      return newScale;
    });
  }, [position]);
  
  // Manejador del inicio del arrastre
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Solo permitir arrastrar con el botón izquierdo
    
    // Permitir arrastrar incluso cuando está ampliado
    setIsDragging(true);
    setStartDragPosition({ x: e.clientX, y: e.clientY });
    e.preventDefault(); // Prevenir selección de texto
  };
  
  // Manejador del movimiento durante el arrastre
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const dx = e.clientX - startDragPosition.x;
    const dy = e.clientY - startDragPosition.y;
    
    // Permitir desplazamiento en cualquier modo
    setPosition(prev => {
      const newPosition = { x: prev.x + dx, y: prev.y + dy };
      
      // Actualizar la transformación del contenido
      if (contentRef.current) {
        contentRef.current.style.transform = `translate(${newPosition.x}px, ${newPosition.y}px) scale(${scale})`;
      }
      
      // Actualizar también el fondo de puntos
      if (backgroundRef.current) {
        backgroundRef.current.style.transform = `translate(${newPosition.x}px, ${newPosition.y}px) scale(${scale})`;
      }
      
      return newPosition;
    });
    
    setStartDragPosition({ x: e.clientX, y: e.clientY });
  };
  
  // Manejador del fin del arrastre
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  // Aplicar el mismo manejador para cuando el cursor sale del canvas
  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };
  
  // Manejar el scroll para zoom y desplazamiento
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // Siempre prevenir el comportamiento predeterminado de scroll
    e.preventDefault();
    
    // Zoom con Ctrl+Wheel
    if (e.ctrlKey) {
      if (e.deltaY < 0) {
        // Zoom in
        zoomIn();
      } else {
        // Zoom out
        zoomOut();
      }
      return;
    }
    
    // Para el desplazamiento normal, no hacemos nada.
    // Forzamos a que el usuario use el drag para navegar
  };

  // CSS para el patrón de puntos del fondo (cuadrícula infinita)
  const dotPatternStyle = {
    backgroundSize: 'var(--dots-size) var(--dots-size)',
    backgroundImage: `
      radial-gradient(circle, var(--dot-color) var(--dots-radius), transparent var(--dots-radius))
    `,
    backgroundPosition: '0 0',
    backgroundColor: 'transparent',
    '--dot-color': 'var(--theme-dots-color)',
    position: 'absolute',
    top: '-200%',    // Centramos el patrón y ampliamos para cubrir más área
    left: '-200%',   // Centramos el patrón y ampliamos para cubrir más área
    width: '500%',   // Extendemos más para tener más puntos
    height: '500%',  // Extendemos más para tener más puntos
    transformOrigin: '0 0',
    pointerEvents: 'none'
  } as React.CSSProperties;

  // Actualizar el cursor cuando cambia el estado de arrastre
  useEffect(() => {
    if (wrapperRef.current) {
      wrapperRef.current.style.cursor = isDragging ? "grabbing" : "grab";
    }
  }, [isDragging]);
  
  // Prevenir scroll pero mantener overflow visible
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const handleWheel = (e: WheelEvent) => {
      // Verificar si el evento ocurre dentro del canvas
      if (canvasRef.current && canvasRef.current.contains(e.target as Node)) {
        e.preventDefault();
      }
    };
    
    // Usamos un listener en el documento para capturar todos los eventos wheel
    // Necesitamos passive: false para poder llamar a preventDefault()
    document.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      document.removeEventListener('wheel', handleWheel);
    };
  }, [canvasRef]);

  return (
    <div 
      ref={wrapperRef}
      className={`${className} relative w-full`}
      style={{ 
        height: "calc(100vh - 200px)",
        minHeight: "600px",
        overflow: "visible", // Cambiamos a visible para permitir que los elementos se extiendan más allá del contenedor
        cursor: isDragging ? "grabbing" : "grab",
        margin: "0 auto",
        width: "100%",
        backgroundColor: "transparent",
        padding: "10px", // Padding para evitar cortes en los bordes
        position: "relative",
        transition: "all 0.2s ease-out"
      }}
      onWheel={handleWheel}
    >
      <div
        ref={canvasRef}
        className="w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Capa de fondo con patrón de puntos que se moverá con el contenido */}
        <div 
          ref={backgroundRef}
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
            position: 'absolute',
            display: 'inline-block',
            width: '100%',
            height: '100%',
            zIndex: 0
          }}
        >
          <div style={dotPatternStyle}></div>
        </div>
        
        {/* Contenido con transformación */}
        <div 
          ref={contentRef}
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.3s ease-out',
            position: 'absolute',
            display: 'inline-block',
            width: 'auto',
            height: 'auto',
            zIndex: 1
          }}
        >
          {children}
        </div>
      </div>

      {/* Panel de controles de zoom con posición fija*/}
      <div 
        className="fixed bottom-8 flex items-center gap-1.5 bg-background/95 backdrop-blur-sm p-1.5 rounded-lg shadow-md border border-border z-50"
        style={{ 
          left: `${isLayoutCollapsed ? 92 : 268}px`, // Use context value instead of prop
          transition: 'left 0.2s ease-out' // Añadir transición suave cuando cambia la posición
        }}
      >
        <Button
          variant="ghost" 
          size="icon"
          onClick={zoomIn}
          className="h-8 w-8"
          aria-label="Zoom in"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost" 
          size="icon"
          onClick={zoomOut}
          className="h-8 w-8"
          aria-label="Zoom out"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost" 
          size="icon"
          onClick={resetView}
          className="h-8 w-8"
          aria-label="Reset view"
        >
          <Maximize className="h-4 w-4" />
        </Button>
        
        <div className="ml-1 px-2 py-1 bg-accent/70 text-accent-foreground dark:bg-accent/50 text-[10px] rounded-sm font-medium border border-border">
          Drag to navigate
        </div>
      </div>
    </div>
  );
}

// Custom card for grid view that shows activities when expanded in a row format
const GridAgentRow = ({ 
  agent,
  isExpanded,
  onToggleExpand,
  onManage,
  onChat,
  onExecuteActivity
}: { 
  agent: Agent,
  isExpanded: boolean,
  onToggleExpand: (agent: Agent) => void,
  onManage: (agent: Agent) => void,
  onChat: (agent: Agent) => void,
  onExecuteActivity: (agent: Agent, activity: AgentActivity) => void
}) => {
  // Get the icon component for the agent
  const getIconComponent = (iconName: string) => {
    // @ts-ignore - Icons es un objeto que contiene todos los iconos
    return Icons[iconName] || Icons.User;
  };
  
  // Get the icon component
  const IconComponent = getIconComponent(agent.icon);
  
  // Format date consistently
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(agent.lastActive));

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden mb-4 transition-all duration-200 hover:shadow-md hover:-translate-y-[1px]">
      {/* Agent Row */}
      <div 
        className={cn(
          "flex items-center p-4 bg-card transition-colors cursor-pointer",
          isExpanded ? "border-b border-border" : "hover:bg-accent/10"
        )}
        onClick={() => onToggleExpand(agent)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-10 w-10 ring-1 ring-border shadow-sm">
            <AvatarImage 
              src={`/avatars/agent-${agent.id}.png`} 
              alt={`${agent.name}'s avatar`} 
            />
            <AvatarFallback className="bg-primary/5">
              <IconComponent className="h-4 w-4 text-primary" aria-hidden={true} />
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{agent.name}</h4>
            <p className="text-xs text-muted-foreground truncate">{agent.description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 mx-4">
          <div className="w-24 text-center">
            <span className="text-xs font-medium">{agent.type.charAt(0).toUpperCase() + agent.type.slice(1)}</span>
          </div>
          <div className="w-28 text-center">
            <div className={cn(metricItemVariants({ hover: true }), "flex flex-col")}>
              <span className="text-xs font-medium">{agent.conversations}</span>
              <span className="text-xs text-muted-foreground">conversations</span>
            </div>
          </div>
          <div className="w-24 text-center">
            <div className={cn(metricItemVariants({ hover: true }), "flex flex-col")}>
              <span className="text-xs font-medium">{agent.successRate}%</span>
              <span className="text-xs text-muted-foreground">success</span>
            </div>
          </div>
          <div className="w-28 text-center">
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge 
            className={cn(
              "flex-none",
              agentStatusVariants({ status: agent.status })
            )}
            aria-label={`Agent status: ${agent.status}`}
          >
            {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
          </Badge>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={(e) => {
              e.stopPropagation();
              onChat(agent);
            }}
            aria-label={`Chat with ${agent.name}`}
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onManage(agent);
            }}
            aria-label={`Manage ${agent.name}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      {/* Activities Section - Expanded */}
      {isExpanded && agent.activities && agent.activities.length > 0 && (
        <div className="p-4 bg-background/50 border-t border-border/50">
          <div className="rounded-lg border shadow-sm overflow-hidden bg-card">
            <div className="bg-muted/30 px-4 py-2.5 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold">Agent Activities</h3>
              <Badge variant="outline" className="px-2 py-0.5 text-xs">
                {agent.activities.length} activities
              </Badge>
            </div>
            
            <div className="divide-y divide-border/70">
              {agent.activities.map(activity => (
                <div 
                  key={activity.id}
                  className="group flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 flex items-center justify-center">
                      <span className="text-sm font-medium text-muted-foreground group-hover:hidden">
                        {activity.id.split('').pop()}
                      </span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onExecuteActivity(agent, activity);
                        }}
                        className="hidden group-hover:flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        aria-label={`Execute ${activity.name}`}
                      >
                        <PlayCircle className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{activity.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.estimatedTime}</span>
                    <span className="text-xs text-foreground font-medium whitespace-nowrap">{activity.successRate}%</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.executions} runs</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Component for animated dots along connection lines
function AnimatedConnectionLine({ 
  className,
  direction = "down",
  dotColor = "var(--primary)",
  speed = "normal"
}: { 
  className?: string
  direction?: "down" | "up" | "right" | "left"
  dotColor?: string
  speed?: "slow" | "normal" | "fast" 
}) {
  // Determine animation duration based on speed
  const getDuration = () => {
    switch(speed) {
      case "slow": return "3s";
      case "fast": return "1.2s";
      default: return "2s";
    }
  };

  // Apply CSS animation directly using keyframes
  useEffect(() => {
    const animationName = `flow-${direction}`;
    
    // Only add the keyframes once to prevent duplicates
    if (!document.getElementById(`keyframes-${animationName}`)) {
      const isVertical = direction === "down" || direction === "up";
      const startPosition = direction === "down" || direction === "right" ? "0%" : "100%";
      const endPosition = direction === "down" || direction === "right" ? "100%" : "0%";
      
      const style = document.createElement('style');
      style.id = `keyframes-${animationName}`;
      
      style.innerHTML = `
        @keyframes ${animationName} {
          0% {
            ${isVertical ? `top: ${startPosition}` : `left: ${startPosition}`};
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          15% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          85% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          100% {
            ${isVertical ? `top: ${endPosition}` : `left: ${endPosition}`};
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
        }
      `;
      
      document.head.appendChild(style);
    }
  }, [direction]);

  // Determine positioning styles based on direction
  const containerStyles = (): React.CSSProperties => {
    const isVertical = direction === "down" || direction === "up";
    return {
      position: "absolute",
      width: isVertical ? "24px" : "100%", // Even wider to ensure dots are visible
      height: isVertical ? "100%" : "24px", // Even taller to ensure dots are visible
      pointerEvents: "none", // Allow clicking through the container
      zIndex: 10, // Ensure it appears above the border line
      ...(isVertical ? { left: "calc(50% - 12px)" } : { top: "calc(50% - 12px)" }),
    };
  };

  // Generate dots with different delays
  const generateDots = () => {
    const dots = [];
    const isVertical = direction === "down" || direction === "up";
    
    // Adjust number of dots based on direction (more for horizontal lines)
    const numDots = isVertical ? 3 : 4;
    
    for (let i = 0; i < numDots; i++) {
      const delay = `${i * 0.7}s`;
      
      // Each dot has its own animation with offset
      const dotStyle: React.CSSProperties = {
        position: "absolute",
        width: "10px", // Even larger dots
        height: "10px", // Even larger dots
        borderRadius: "50%",
        backgroundColor: dotColor,
        boxShadow: `0 0 8px 3px ${dotColor}`, // Enhanced glow effect
        animation: `flow-${direction} ${getDuration()} infinite`,
        animationDelay: delay,
        // Position at starting point (will be animated by keyframes)
        left: isVertical ? "50%" : "0%",
        top: isVertical ? "0%" : "50%",
        zIndex: 20, // Ensure dots appear above everything
      };
      
      dots.push(<div key={i} style={dotStyle} />);
    }
    
    return dots;
  };

  return (
    <div className={className} style={containerStyles()}>
      {generateDots()}
    </div>
  );
}

export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"hierarchy" | "grid">("hierarchy")
  const router = useRouter()
  const { isLayoutCollapsed } = useLayout(); // Use the context directly
  const [expandedAgentIds, setExpandedAgentIds] = useState<string[]>([]);
  
  // Efecto de depuración para monitorear cambios en el estado de colapso
  useEffect(() => {
    console.log("AgentsPage - isLayoutCollapsed:", isLayoutCollapsed);
  }, [isLayoutCollapsed]);
  
  // Restablecer el breadcrumb cuando se cargue la página principal de agentes
  useEffect(() => {
    // Actualizar el título de la página
    document.title = 'Agents | Market Fit';
    
    // Emitir un evento para restablecer el breadcrumb
    const event = new CustomEvent('breadcrumb:update', {
      detail: {
        title: null
      }
    });
    
    window.dispatchEvent(event);
  }, []);

  const filteredAgents = agents.filter(agent => 
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleManageAgent = (agent: Agent) => {
    router.push(`/agents/${agent.id}`)
  }

  const handleChatWithAgent = (agent: Agent) => {
    router.push(`/chat?agentId=${agent.id}&agentName=${encodeURIComponent(agent.name)}`)
  }
  
  const handleToggleActivities = (agent: Agent) => {
    setExpandedAgentIds(prev => {
      // If already expanded, remove it, otherwise add it
      if (prev.includes(agent.id)) {
        return prev.filter(id => id !== agent.id);
      } else {
        return [...prev, agent.id];
      }
    });
  }
  
  const handleExecuteActivity = (agent: Agent, activity: AgentActivity) => {
    // This would typically trigger the activity execution
    console.log(`Executing activity ${activity.name} for agent ${agent.name}`);
    alert(`Starting: ${activity.name}\nEstimated time: ${activity.estimatedTime}`);
    
    // Here you would implement the actual execution logic
  }

  // Obtener el Growth Lead/Manager y asegurar que no sea undefined
  const leadAgent = agents.find(agent => agent.id === "1");
  
  // Obtener el Data Analyst (pivote entre el líder y los ejecutores)
  const dataAnalystAgent = agents.find(agent => agent.id === "4");
  
  // Obtener los demás miembros del equipo (ejecutores)
  const executionAgents = agents.filter(agent => agent.id !== "1" && agent.id !== "4");

  // Check if an agent's activities are expanded
  const isAgentExpanded = (agentId: string) => expandedAgentIds.includes(agentId);

  // Componente para mostrar la tarjeta del líder
  const LeadAgentCard = ({ agent }: { agent: Agent }) => (
    <div className="flex justify-center mb-8">
      <div className="w-[458px]">
        <SimpleAgentCard 
          agent={agent} 
          onManage={handleManageAgent}
          onChat={handleChatWithAgent}
          onToggleActivities={handleToggleActivities}
          showActivities={isAgentExpanded(agent.id)}
          onExecuteActivity={handleExecuteActivity}
          className="border-primary/50 shadow-md"
        />
      </div>
    </div>
  );

  const renderGridView = (type?: AgentType) => {
    // Filter all agents by search and type
    const filteredByTypeAndSearch = filteredAgents.filter(agent => 
      type ? agent.type === type : true
    );
    
    // If nothing found, show empty state
    if (filteredByTypeAndSearch.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <p className="text-lg font-medium text-muted-foreground mb-2">
            No agents found
          </p>
          <p className="text-sm text-muted-foreground">
            {type 
              ? `No ${type} agents available for your search criteria`
              : "No agents match your search criteria"}
          </p>
        </div>
      );
    }
    
    // Encontrar los distintos niveles jerárquicos
    const leadAgent = filteredByTypeAndSearch.find(agent => agent.id === "1");
    const dataAnalystAgent = filteredByTypeAndSearch.find(agent => agent.id === "4");
    const executionAgents = filteredByTypeAndSearch.filter(agent => agent.id !== "1" && agent.id !== "4");
    
    return (
      <div className="space-y-8">
        {/* Leadership Section */}
        {leadAgent && (
          <div>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center">
              <span className="relative px-0.5">
                Leadership
                <span className="absolute bottom-[-8px] left-0 right-0 h-0.5 bg-primary/70 rounded-full"></span>
              </span>
            </h3>
            <GridAgentRow 
              agent={leadAgent} 
              isExpanded={isAgentExpanded(leadAgent.id)}
              onToggleExpand={handleToggleActivities}
              onManage={handleManageAgent}
              onChat={handleChatWithAgent}
              onExecuteActivity={handleExecuteActivity}
            />
          </div>
        )}
        
        {/* Data Analysis Section */}
        {dataAnalystAgent && (
          <div>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center">
              <span className="relative px-0.5">
                Data Analysis
                <span className="absolute bottom-[-8px] left-0 right-0 h-0.5 bg-primary/70 rounded-full"></span>
              </span>
            </h3>
            <GridAgentRow 
              agent={dataAnalystAgent} 
              isExpanded={isAgentExpanded(dataAnalystAgent.id)}
              onToggleExpand={handleToggleActivities}
              onManage={handleManageAgent}
              onChat={handleChatWithAgent}
              onExecuteActivity={handleExecuteActivity}
            />
          </div>
        )}
        
        {/* Execution Team Section */}
        {executionAgents.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center">
              <span className="relative px-0.5">
                Execution Team
                <span className="absolute bottom-[-8px] left-0 right-0 h-0.5 bg-primary/70 rounded-full"></span>
              </span>
            </h3>
            <div className="space-y-4">
              {executionAgents.map(agent => (
                <GridAgentRow 
                  key={agent.id} 
                  agent={agent} 
                  isExpanded={isAgentExpanded(agent.id)}
                  onToggleExpand={handleToggleActivities}
                  onManage={handleManageAgent}
                  onChat={handleChatWithAgent}
                  onExecuteActivity={handleExecuteActivity}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 p-0 relative">
      <Tabs defaultValue="all" className="space-y-4">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-4">
              <div className="flex-1 flex items-center gap-4">
                <TabsList>
                  <TabsTrigger value="all">All Team</TabsTrigger>
                  <TabsTrigger value="marketing">Marketing</TabsTrigger>
                  <TabsTrigger value="sales">Sales</TabsTrigger>
                </TabsList>
                
              <div className="relative w-64">
                <Input 
                  placeholder="Search agents..." 
                  className="w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  icon={<Search className="h-4 w-4 text-muted-foreground" />}
                />
                <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
                </div>
              </div>
              
              <div>
                <ToggleGroup type="single" value={viewMode} onValueChange={(value: string) => value && setViewMode(value as "hierarchy" | "grid")}>
                  <ToggleGroupItem value="hierarchy" aria-label="Toggle hierarchy view" className="px-2">
                    <TableRows className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="grid" aria-label="Toggle grid view" className="px-2">
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-4 space-y-4">
          <TabsContent value="all" className="m-0">
            <div className="px-8">
              {viewMode === "hierarchy" ? (
                <div className="flex flex-col items-center">
                  <div className="w-full">
                    <ZoomableCanvas isMenuCollapsed={isLayoutCollapsed}>
                      <div className="mb-10 pt-2 flex flex-col items-center">
                        <h2 className="text-2xl font-bold mb-6">Growth Team Structure</h2>
                        
                        {/* Lead Manager Card - Top Level */}
                        {leadAgent && 
                          (!searchQuery || 
                           leadAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           leadAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && 
                          <LeadAgentCard agent={leadAgent} />
                        }
                        
                        {/* Connecting Line - only show if both leadAgent and dataAnalystAgent are visible */}
                        {leadAgent && dataAnalystAgent &&
                          (!searchQuery || 
                           leadAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           leadAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) &&
                          (!searchQuery || 
                           dataAnalystAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           dataAnalystAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && (
                          <div className="flex justify-center relative">
                            <div className="h-12 w-0.5 bg-border"></div>
                            <AnimatedConnectionLine direction="down" className="h-12 opacity-100" dotColor="var(--primary)" />
                          </div>
                        )}
                        
                        {/* Data Analyst - Middle Level */}
                        {dataAnalystAgent && 
                          (!searchQuery || 
                           dataAnalystAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           dataAnalystAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && (
                          <>
                            <div className="flex justify-center mb-8">
                              <div className="w-[458px]">
                                <SimpleAgentCard 
                                  agent={dataAnalystAgent} 
                                  onManage={handleManageAgent}
                                  onChat={handleChatWithAgent}
                                  onToggleActivities={handleToggleActivities}
                                  showActivities={isAgentExpanded(dataAnalystAgent.id)}
                                  onExecuteActivity={handleExecuteActivity}
                                  className="border-primary/30 shadow-md"
                                />
                              </div>
                            </div>
                            
                            {/* Connecting Line - only show if filtered execution agents exist */}
                            {executionAgents.some(agent => 
                              !searchQuery || 
                              agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              agent.description.toLowerCase().includes(searchQuery.toLowerCase())
                            ) && (
                              <div className="flex justify-center relative">
                                <div className="h-12 w-0.5 bg-border"></div>
                                <AnimatedConnectionLine direction="down" className="h-12 opacity-100" dotColor="var(--primary)" />
                              </div>
                            )}
                          </>
                        )}
                        
                        {/* Execution Teams - Bottom Level with connections */}
                        <div className="relative mt-2">
                          {/* Horizontal connecting line - only if there are filtered execution agents */}
                          {executionAgents.some(agent => 
                            !searchQuery || 
                            agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            agent.description.toLowerCase().includes(searchQuery.toLowerCase())
                          ) && (
                            <div className="absolute top-0 left-1/2 w-[90%] h-0.5 bg-border transform -translate-x-1/2 relative">
                              <AnimatedConnectionLine direction="right" className="w-[50%] left-0 opacity-100" speed="normal" dotColor="var(--primary)" />
                              <AnimatedConnectionLine direction="left" className="w-[50%] right-0 opacity-100" speed="normal" dotColor="var(--primary)" />
                            </div>
                          )}
                          
                          {/* Get the sales specialist and customer support */}
                          {(() => {
                            const salesSpecialist = executionAgents.find(agent => agent.id === "5");
                            const customerSupport = executionAgents.find(agent => agent.id === "7");
                            const filteredAgents = executionAgents.filter(agent => 
                              agent.id !== "7" && 
                              (!searchQuery || 
                              agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
                            );
                            
                            // Hide customerSupport if salesSpecialist is filtered out
                            const showCustomerSupport = salesSpecialist && 
                              customerSupport && 
                              (!searchQuery || 
                               salesSpecialist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                               salesSpecialist.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                               customerSupport.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                               customerSupport.description.toLowerCase().includes(searchQuery.toLowerCase()));
                            
                            // If no agents match the search query, show a message
                            if (filteredAgents.length === 0 && !showCustomerSupport) {
                              return (
                                <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-8">
                                  <p className="text-lg font-medium text-muted-foreground mb-2">
                                    No agents found matching "{searchQuery}"
                                  </p>
                                </div>
                              );
                            }
                            
                            return (
                              <>
                                {/* Vertical connecting lines */}
                                <div className={
                                  `grid gap-4 px-4 ${
                                    filteredAgents.length <= 4 ? "grid-cols-" + filteredAgents.length : "grid-cols-4"
                                  }`
                                }>
                                  {filteredAgents.map((_, index) => (
                                    index < 5 && (
                                      <div key={index} className="flex justify-center relative">
                                        <div className="h-8 w-0.5 bg-border"></div>
                                        <AnimatedConnectionLine direction="down" className="h-8 opacity-100" dotColor="var(--primary)" />
                                      </div>
                                    )
                                  ))}
                                </div>
                                
                                {/* Team member cards - scrollable container */}
                                <div className="pb-4">
                                  <div className={
                                    `grid grid-flow-col auto-cols-min gap-4 px-4 mt-2 min-w-full`
                                  }>
                                    {filteredAgents.map((agent) => (
                                      <div key={agent.id} className="w-[458px]">
                                        <SimpleAgentCard
                                          agent={agent}
                                          onManage={handleManageAgent}
                                          onChat={handleChatWithAgent}
                                          onToggleActivities={handleToggleActivities}
                                          showActivities={isAgentExpanded(agent.id)}
                                          onExecuteActivity={handleExecuteActivity}
                                        />
                                        
                                        {/* If this is the Sales Specialist, show Customer Support beneath it */}
                                        {agent.id === "5" && customerSupport && showCustomerSupport && (
                                          <div className="mt-20 ml-10">
                                            {/* Clean Connecting Lines - No dot */}
                                            <div className="relative">
                                              {/* Vertical line */}
                                              <div className="absolute top-[-40px] left-[-28px] h-[calc(100%+108px)] w-0.5 bg-border rounded-full"></div>
                                              {/* Horizontal line */}
                                              <div className="absolute top-[48px] left-[-28px] w-7 h-0.5 bg-border rounded-full"></div>
                                            </div>
                                            
                                            {/* Label for hierarchical relationship */}
                                            <div className="absolute top-[-4px] left-[-12px] bg-background text-xs px-1.5 py-0.5 text-muted-foreground rounded font-medium border">
                                              Reports to
                                            </div>
                                            
                                            <SimpleAgentCard
                                              agent={customerSupport}
                                              onManage={handleManageAgent}
                                              onChat={handleChatWithAgent}
                                              onToggleActivities={handleToggleActivities}
                                              showActivities={isAgentExpanded(customerSupport.id)}
                                              onExecuteActivity={handleExecuteActivity}
                                              className="border-primary/20 shadow-md relative"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                          
                          {/* Feedback Loop Visualization - only show if there are visible agents */}
                          {executionAgents.some(agent => 
                            !searchQuery || 
                            agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            agent.description.toLowerCase().includes(searchQuery.toLowerCase())
                          ) && (
                            <div className="mt-6 flex flex-col items-center">
                              <div className="w-[90%] h-0.5 bg-border relative">
                                <AnimatedConnectionLine direction="left" className="w-full opacity-100" speed="slow" dotColor="var(--primary)" />
                              </div>
                              <div className="mt-3 mb-1.5 text-center">
                                <span className="px-4 py-1.5 bg-muted rounded-md text-sm font-medium">
                                  Feedback Loop
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </ZoomableCanvas>
                  </div>
                </div>
              ) : (
                renderGridView()
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="marketing">
            <div className="px-8">
              {viewMode === "hierarchy" ? (
                <div className="flex flex-col items-center">
                  <div className="w-full">
                    <ZoomableCanvas isMenuCollapsed={isLayoutCollapsed}>
                      <div className="mb-10 pt-2 flex flex-col items-center">
                        <h2 className="text-2xl font-bold mb-6">Marketing Team</h2>
                        
                        {/* Lead Manager Card - Top Level */}
                        {leadAgent && leadAgent.type === "marketing" && 
                          (!searchQuery || 
                           leadAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           leadAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && 
                          <LeadAgentCard agent={leadAgent} />
                        }
                        
                        {/* Connecting Line */}
                        {leadAgent && leadAgent.type === "marketing" && dataAnalystAgent && dataAnalystAgent.type === "marketing" &&
                          (!searchQuery || 
                           leadAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           leadAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) &&
                          (!searchQuery || 
                           dataAnalystAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           dataAnalystAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && (
                          <div className="flex justify-center relative">
                            <div className="h-12 w-0.5 bg-border"></div>
                            <AnimatedConnectionLine direction="down" className="h-12 opacity-80" />
                          </div>
                        )}
                        
                        {/* Data Analyst - Middle Level */}
                        {dataAnalystAgent && dataAnalystAgent.type === "marketing" && 
                          (!searchQuery || 
                           dataAnalystAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           dataAnalystAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && (
                          <>
                            <div className="flex justify-center mb-8">
                              <div className="w-[458px]">
                                <SimpleAgentCard 
                                  agent={dataAnalystAgent} 
                                  onManage={handleManageAgent}
                                  onChat={handleChatWithAgent}
                                  onToggleActivities={handleToggleActivities}
                                  showActivities={isAgentExpanded(dataAnalystAgent.id)}
                                  onExecuteActivity={handleExecuteActivity}
                                  className="border-primary/30 shadow-md"
                                />
                              </div>
                            </div>
                            
                            {/* Connecting Line - only show if filtered marketing agents exist */}
                            {executionAgents.filter(agent => 
                              agent.type === "marketing" && 
                              (!searchQuery || 
                              agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
                            ).length > 0 && (
                              <div className="flex justify-center relative">
                                <div className="h-12 w-0.5 bg-border"></div>
                                <AnimatedConnectionLine direction="down" className="h-12 opacity-80" />
                              </div>
                            )}
                          </>
                        )}
                        
                        {/* Marketing team members */}
                        {(() => {
                          const marketingAgents = executionAgents.filter(agent => 
                            agent.type === "marketing" && 
                            (!searchQuery || 
                            agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
                          );
                          
                          if (marketingAgents.length > 0) {
                            return (
                              <div className="relative mt-2">
                                {/* Horizontal connecting line */}
                                <div className="absolute top-0 left-1/2 w-[90%] h-0.5 bg-border transform -translate-x-1/2"></div>
                                
                                {/* Vertical connecting lines */}
                                <div className={
                                  `grid gap-4 px-4 ${
                                    marketingAgents.length <= 4 ? "grid-cols-" + marketingAgents.length : "grid-cols-4"
                                  }`
                                }>
                                  {marketingAgents.map((_, index) => (
                                    index < 5 && (
                                      <div key={index} className="flex justify-center relative">
                                        <div className="h-8 w-0.5 bg-border"></div>
                                        <AnimatedConnectionLine direction="down" className="h-8 opacity-80" />
                                      </div>
                                    )
                                  ))}
                                </div>
                                
                                {/* Team member cards - scrollable container */}
                                <div className="pb-4">
                                  <div className={
                                    `grid grid-flow-col auto-cols-min gap-4 px-4 mt-2 min-w-full`
                                  }>
                                    {marketingAgents.map((agent) => (
                                      <div key={agent.id} className="w-[458px]">
                                        <SimpleAgentCard
                                          agent={agent}
                                          onManage={handleManageAgent}
                                          onChat={handleChatWithAgent}
                                          onToggleActivities={handleToggleActivities}
                                          showActivities={isAgentExpanded(agent.id)}
                                          onExecuteActivity={handleExecuteActivity}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                
                                {/* Feedback Loop Visualization */}
                                <div className="mt-8 flex flex-col items-center">
                                  <div className="w-[90%] h-0.5 bg-border"></div>
                                  <div className="mt-4 mb-2 text-center">
                                    <span className="px-4 py-2 bg-muted rounded-md text-sm font-medium">
                                      Feedback Loop
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          
                          return (
                            <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-8">
                              <p className="text-lg font-medium text-muted-foreground mb-2">
                                {searchQuery ? `No marketing team members found matching "${searchQuery}"` : "No marketing team members found"}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </ZoomableCanvas>
                  </div>
                </div>
              ) : (
                renderGridView("marketing")
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="sales">
            <div className="px-8">
              {viewMode === "hierarchy" ? (
                <div className="flex flex-col items-center">
                  <div className="w-full">
                    <ZoomableCanvas isMenuCollapsed={isLayoutCollapsed}>
                      <div className="mb-10 pt-2 flex flex-col items-center">
                        <h2 className="text-2xl font-bold mb-6">Sales Team</h2>
                        
                        {/* Lead Manager Card - Top Level */}
                        {leadAgent && leadAgent.type === "sales" && 
                          (!searchQuery || 
                           leadAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           leadAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && 
                          <LeadAgentCard agent={leadAgent} />
                        }
                        
                        {/* Connecting Line */}
                        {leadAgent && leadAgent.type === "sales" && dataAnalystAgent && dataAnalystAgent.type === "sales" &&
                          (!searchQuery || 
                           leadAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           leadAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) &&
                          (!searchQuery || 
                           dataAnalystAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           dataAnalystAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && (
                          <div className="flex justify-center relative">
                            <div className="h-12 w-0.5 bg-border"></div>
                            <AnimatedConnectionLine direction="down" className="h-12 opacity-80" />
                          </div>
                        )}
                        
                        {/* Data Analyst - Middle Level */}
                        {dataAnalystAgent && dataAnalystAgent.type === "sales" && 
                          (!searchQuery || 
                           dataAnalystAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           dataAnalystAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && (
                          <>
                            <div className="flex justify-center mb-8">
                              <div className="w-[458px]">
                                <SimpleAgentCard 
                                  agent={dataAnalystAgent} 
                                  onManage={handleManageAgent}
                                  onChat={handleChatWithAgent}
                                  onToggleActivities={handleToggleActivities}
                                  showActivities={isAgentExpanded(dataAnalystAgent.id)}
                                  onExecuteActivity={handleExecuteActivity}
                                  className="border-primary/30 shadow-md"
                                />
                              </div>
                            </div>
                            
                            {/* Connecting Line - only show if filtered sales agents exist */}
                            {executionAgents.filter(agent => 
                              agent.type === "sales" && 
                              (!searchQuery || 
                              agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
                            ).length > 0 && (
                              <div className="flex justify-center relative">
                                <div className="h-12 w-0.5 bg-border"></div>
                                <AnimatedConnectionLine direction="down" className="h-12 opacity-80" />
                              </div>
                            )}
                          </>
                        )}
                        
                        {/* Sales team members */}
                        {(() => {
                          const salesAgents = executionAgents.filter(agent => 
                            agent.type === "sales" && 
                            (!searchQuery || 
                            agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
                          );
                          
                          if (salesAgents.length > 0) {
                            // Separate the Sales/CRM Specialist and the Customer Support
                            const salesSpecialist = salesAgents.find(agent => agent.id === "5");
                            const customerSupport = executionAgents.find(agent => 
                              agent.id === "7" && 
                              (!searchQuery || 
                              agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              agent.description.toLowerCase().includes(searchQuery.toLowerCase()))
                            );
                            const otherSalesAgents = salesAgents.filter(agent => agent.id !== "5" && agent.id !== "7");
                            
                            // Check if customerSupport is filtered out by search
                            const showCustomerSupport = salesSpecialist && customerSupport;
                            
                            return (
                              <div className="relative mt-2">
                                {/* Horizontal connecting line */}
                                {salesAgents.length > 1 && (
                                  <div className="absolute top-0 left-1/2 w-[90%] h-0.5 bg-border transform -translate-x-1/2 relative">
                                    <AnimatedConnectionLine direction="right" className="w-[50%] left-0 opacity-100" speed="normal" dotColor="var(--primary)" />
                                    <AnimatedConnectionLine direction="left" className="w-[50%] right-0 opacity-100" speed="normal" dotColor="var(--primary)" />
                                  </div>
                                )}
                                
                                {/* Vertical connecting lines */}
                                <div className={
                                  `grid gap-4 px-4 ${
                                    (salesSpecialist ? 1 : 0) + otherSalesAgents.length <= 4 
                                    ? "grid-cols-" + ((salesSpecialist ? 1 : 0) + otherSalesAgents.length) 
                                    : "grid-cols-4"
                                  }`
                                }>
                                  {/* First column for Sales Specialist */}
                                  {salesSpecialist && (
                                    <div className="flex justify-center relative">
                                      <div className="h-8 w-0.5 bg-border"></div>
                                      <AnimatedConnectionLine direction="down" className="h-8 opacity-80" />
                                    </div>
                                  )}
                                  
                                  {/* Other columns for other sales agents */}
                                  {otherSalesAgents.map((_, index) => (
                                    index < 4 && (
                                      <div key={index} className="flex justify-center relative">
                                        <div className="h-8 w-0.5 bg-border"></div>
                                        <AnimatedConnectionLine direction="down" className="h-8 opacity-80" />
                                      </div>
                                    )
                                  ))}
                                </div>
                                
                                {/* Team member cards - scrollable container */}
                                <div className="pb-4">
                                  <div className={
                                    `grid grid-flow-col auto-cols-min gap-4 px-4 mt-2 min-w-full`
                                  }>
                                    {/* Sales Specialist with Customer Support as child */}
                                    {salesSpecialist && (
                                      <div className="w-[458px]">
                                        <SimpleAgentCard
                                          agent={salesSpecialist}
                                          onManage={handleManageAgent}
                                          onChat={handleChatWithAgent}
                                          onToggleActivities={handleToggleActivities}
                                          showActivities={isAgentExpanded(salesSpecialist.id)}
                                          onExecuteActivity={handleExecuteActivity}
                                        />
                                        
                                        {/* Customer Support as child of Sales/CRM Specialist */}
                                        {showCustomerSupport && (
                                          <div className="mt-20 ml-10">
                                            {/* Enhanced Connecting Lines */}
                                            <div className="relative">
                                              <div className="absolute top-[-40px] left-[-28px] h-[calc(100%+108px)] w-0.5 bg-border rounded-full"></div>
                                              <div className="absolute top-[48px] left-[-28px] w-7 h-0.5 bg-border rounded-full"></div>
                                              <AnimatedConnectionLine 
                                                direction="down" 
                                                className="absolute top-[-40px] left-[-28px] h-[calc(100%+108px)] opacity-100" 
                                                speed="fast"
                                                dotColor="var(--primary)"
                                              />
                                              <AnimatedConnectionLine 
                                                direction="right" 
                                                className="absolute top-[48px] left-[-28px] w-7 opacity-100" 
                                                speed="fast"
                                                dotColor="var(--primary)"
                                              />
                                            </div>
                                            
                                            {/* Label for hierarchical relationship */}
                                            <div className="absolute top-[-4px] left-[-12px] bg-background text-xs px-1.5 py-0.5 text-muted-foreground rounded font-medium border">
                                              Reports to
                                            </div>
                                            
                                            <SimpleAgentCard
                                              agent={customerSupport}
                                              onManage={handleManageAgent}
                                              onChat={handleChatWithAgent}
                                              onToggleActivities={handleToggleActivities}
                                              showActivities={isAgentExpanded(customerSupport.id)}
                                              onExecuteActivity={handleExecuteActivity}
                                              className="border-primary/20 shadow-md relative"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Render other sales agents */}
                                    {otherSalesAgents.map((agent) => (
                                      <div key={agent.id} className="w-[458px]">
                                        <SimpleAgentCard
                                          agent={agent}
                                          onManage={handleManageAgent}
                                          onChat={handleChatWithAgent}
                                          onToggleActivities={handleToggleActivities}
                                          showActivities={isAgentExpanded(agent.id)}
                                          onExecuteActivity={handleExecuteActivity}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                
                                {/* Feedback Loop Visualization - Only if there's Data Analyst */}
                                {dataAnalystAgent && dataAnalystAgent.type === "sales" && 
                                  (!searchQuery || 
                                   dataAnalystAgent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                   dataAnalystAgent.description.toLowerCase().includes(searchQuery.toLowerCase())) && (
                                  <div className="mt-8 flex flex-col items-center">
                                    <div className="w-[90%] h-0.5 bg-border relative">
                                      <AnimatedConnectionLine direction="left" className="w-full opacity-100" speed="slow" dotColor="var(--primary)" />
                                    </div>
                                    <div className="mt-4 mb-2 text-center">
                                      <span className="px-4 py-2 bg-muted rounded-md text-sm font-medium">
                                        Feedback Loop
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          }
                          
                          return (
                            <div className="flex flex-col items-center justify-center min-h-[200px] text-center p-8">
                              <p className="text-lg font-medium text-muted-foreground mb-2">
                                {searchQuery ? `No sales team members found matching "${searchQuery}"` : "No sales team members found"}
                              </p>
                            </div>
                          );
                        })()}
                      </div>
                    </ZoomableCanvas>
                  </div>
                </div>
              ) : (
                renderGridView("sales")
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}