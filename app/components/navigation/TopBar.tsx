"use client"

import { cn } from "@/lib/utils"
import { 
  HelpCircle, 
  ChevronLeft, 
  ChevronRight, 
  PlusCircle, 
  Filter, 
  Download, 
  Search, 
  UploadCloud,
  Settings,
  Bell,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ChevronDown,
  LogOut,
  User as UserIcon,
  FlaskConical
} from "@/app/components/ui/icons"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip"
import { Button } from "../ui/button"
import { usePathname, useRouter } from "next/navigation"
import { CalendarDateRangePicker } from "../ui/date-range-picker"
import { CreateSegmentDialog } from "../create-segment-dialog"
import { createSegment } from "@/app/segments/actions"
import { CreateExperimentDialog } from "@/app/components/create-experiment-dialog"
import { createExperiment, type ExperimentFormValues } from "@/app/experiments/actions"
import { UploadAssetDialog } from "@/app/components/upload-asset-dialog"
import { createAsset } from "@/app/assets/actions"
import { CreateRequirementDialog } from "@/app/components/create-requirement-dialog"
import { createRequirement } from "@/app/requirements/actions"
import { type Segment } from "@/app/requirements/types"
import { useSite } from "@/app/context/SiteContext"
import { CreateLeadDialog } from "@/app/components/create-lead-dialog"
import { createLead } from "@/app/leads/actions"
import { CreateContentDialog } from "@/app/content/components"
import { useState, useEffect, useCallback } from "react"
import { getSegments } from "@/app/segments/actions"
import Link from "next/link"
import { Breadcrumb } from "./Breadcrumb"

interface TopBarProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  helpText?: string
  isCollapsed: boolean
  onCollapse: () => void
  segments?: Array<{
    id: string
    name: string
    description: string
  }>
  breadcrumb?: React.ReactNode
}

export function TopBar({ 
  title, 
  helpText,
  isCollapsed,
  onCollapse,
  className,
  segments: propSegments,
  breadcrumb,
  ...props 
}: TopBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isDashboardPage = pathname === "/dashboard"
  const isSegmentsPage = pathname === "/segments"
  const isExperimentsPage = pathname === "/experiments"
  const isRequirementsPage = pathname === "/requirements"
  const isLeadsPage = pathname === "/leads"
  const isAgentsPage = pathname === "/agents"
  const isAssetsPage = pathname === "/assets"
  const isContentPage = pathname === "/content"
  const { currentSite } = useSite()
  const [segments, setSegments] = useState<Array<{ id: string; name: string; description: string }>>([])
  const [searchParams, setSearchParams] = useState<string>("")
  const [customTitle, setCustomTitle] = useState<string | null>(null)
  const [customAgentId, setCustomAgentId] = useState<string | null>(null)
  const [customAgentName, setCustomAgentName] = useState<string | null>(null)

  // Escuchar eventos de actualización del breadcrumb
  useEffect(() => {
    const handleBreadcrumbUpdate = (event: any) => {
      if (event.detail) {
        // Si se proporciona un título personalizado
        if (event.detail.title !== undefined) {
          setCustomTitle(event.detail.title);
        }
        
        // Si se proporcionan datos de agente para la página de chat
        if (event.detail.agentId && event.detail.agentName) {
          setCustomAgentId(event.detail.agentId);
          setCustomAgentName(event.detail.agentName);
        }
      }
    };
    
    window.addEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    
    return () => {
      window.removeEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    };
  }, []);

  // Generar breadcrumb basado en la ruta actual
  const generateBreadcrumbItems = useCallback(() => {
    const pathSegments = pathname.split('/').filter(Boolean);
    
    if (pathSegments.length <= 1) {
      return null; // No hay necesidad de breadcrumb para rutas de primer nivel
    }
    
    const breadcrumbItems = [];
    let currentPath = '';
    
    // Mapeo de rutas a títulos
    const routeTitles: Record<string, string> = {
      'agents': 'Agents',
      'segments': 'Segments',
      'experiments': 'Experiments',
      'requirements': 'Requirements',
      'leads': 'Leads',
      'assets': 'Assets',
      'chat': 'Chat',
      'dashboard': 'Dashboard',
    };
    
    // Manejar casos especiales como chat con parámetros de consulta
    if (pathSegments[0] === 'chat') {
      // Usar los datos personalizados del agente si están disponibles
      if (customAgentId && customAgentName) {
        breadcrumbItems.push({
          href: '/agents',
          label: 'Agents',
          isCurrent: false
        });
        
        breadcrumbItems.push({
          href: `/agents/${customAgentId}`,
          label: decodeURIComponent(customAgentName),
          isCurrent: false
        });
        
        breadcrumbItems.push({
          href: pathname + window.location.search,
          label: 'Chat',
          isCurrent: true
        });
        
        return breadcrumbItems;
      }
      
      // Fallback al comportamiento anterior
      const urlSearchParams = new URLSearchParams(searchParams);
      const agentId = urlSearchParams.get('agentId');
      const agentName = urlSearchParams.get('agentName');
      
      breadcrumbItems.push({
        href: '/agents',
        label: 'Agents',
        isCurrent: false
      });
      
      if (agentId && agentName) {
        breadcrumbItems.push({
          href: `/agents/${agentId}`,
          label: decodeURIComponent(agentName),
          isCurrent: false
        });
      }
      
      breadcrumbItems.push({
        href: pathname + searchParams,
        label: 'Chat',
        isCurrent: true
      });
      
      return breadcrumbItems;
    }
    
    // Manejar caso especial para la página de detalle del agente
    if (pathSegments[0] === 'agents' && pathSegments.length === 2) {
      breadcrumbItems.push({
        href: '/agents',
        label: 'Agents',
        isCurrent: false
      });
      
      // Usar el título personalizado si está disponible
      breadcrumbItems.push({
        href: `/${pathSegments[0]}/${pathSegments[1]}`,
        label: customTitle || 'Agent Details',
        isCurrent: true
      });
      
      return breadcrumbItems;
    }
    
    // Manejar caso especial para la página de detalle del segmento
    if (pathSegments[0] === 'segments' && pathSegments.length === 2) {
      breadcrumbItems.push({
        href: '/segments',
        label: 'Segments',
        isCurrent: false
      });
      
      // Usar el título personalizado si está disponible
      breadcrumbItems.push({
        href: `/${pathSegments[0]}/${pathSegments[1]}`,
        label: customTitle || 'Segment Details',
        isCurrent: true
      });
      
      return breadcrumbItems;
    }
    
    // Construir los items del breadcrumb para rutas normales
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      currentPath += `/${segment}`;
      
      // Si es un ID (generalmente el último segmento en rutas como /agents/123)
      const isIdSegment = i > 0 && !isNaN(Number(segment));
      
      // Último segmento (página actual)
      if (i === pathSegments.length - 1) {
        // Si es un ID, usamos el título proporcionado o un valor por defecto
        if (isIdSegment) {
          breadcrumbItems.push({
            href: currentPath,
            label: title || 'Details',
            isCurrent: true
          });
        } else {
          breadcrumbItems.push({
            href: currentPath,
            label: title || routeTitles[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
            isCurrent: true
          });
        }
      } else {
        breadcrumbItems.push({
          href: currentPath,
          label: routeTitles[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
          isCurrent: false
        });
      }
    }
    
    return breadcrumbItems;
  }, [pathname, searchParams, title, customTitle, customAgentId, customAgentName]);
  
  const [breadcrumbItems, setBreadcrumbItems] = useState<Array<{
    href: string;
    label: string;
    isCurrent: boolean;
  }> | null>(null);
  
  // Actualizar los parámetros de búsqueda cuando cambie la URL
  useEffect(() => {
    const updateSearchParams = () => {
      setSearchParams(window.location.search);
    };
    
    // Actualizar inicialmente
    updateSearchParams();
    
    // Escuchar cambios en la URL
    window.addEventListener('popstate', updateSearchParams);
    
    return () => {
      window.removeEventListener('popstate', updateSearchParams);
    };
  }, []);
  
  // Actualizar breadcrumb cuando cambie la ruta
  useEffect(() => {
    setBreadcrumbItems(generateBreadcrumbItems());
  }, [pathname, title, searchParams, customTitle, generateBreadcrumbItems]);
  
  // Cargar segmentos cuando se está en la página de leads o contenido
  useEffect(() => {
    async function loadSegments() {
      if (!currentSite?.id || !(isLeadsPage || isContentPage)) return
      
      try {
        const response = await getSegments(currentSite.id)
        if (response.error) {
          console.error(response.error)
          return
        }
        
        if (response.segments) {
          setSegments(response.segments.map(s => ({
            id: s.id,
            name: s.name,
            description: s.description || ""
          })))
        }
      } catch (error) {
        console.error("Error loading segments:", error)
      }
    }

    loadSegments()
  }, [currentSite, isLeadsPage, isContentPage])

  const handleCreateSegment = async ({ 
    name, 
    description, 
    audience, 
    language,
    site_id 
  }: { 
    name: string
    description: string
    audience: string
    language: string
    site_id: string
  }) => {
    try {
      const result = await createSegment({ 
        name, 
        description, 
        audience, 
        language,
        site_id
      })

      if (result.error) {
        throw new Error(result.error)
      }

      // Recargar la página para mostrar el nuevo segmento
      window.location.reload()
    } catch (error) {
      console.error("Error creating segment:", error)
      throw error
    }
  }

  const handleCreateExperiment = async (values: ExperimentFormValues): Promise<{ data?: any; error?: string }> => {
    try {
      const result = await createExperiment(values)

      if (result.error) {
        return { error: result.error }
      }

      // Recargar la página para mostrar el nuevo experimento
      window.location.reload()
      return { data: result.data }
    } catch (error) {
      console.error("Error creating experiment:", error)
      return { error: error instanceof Error ? error.message : "Error inesperado" }
    }
  }

  const handleCreateRequirement = async (values: any): Promise<{ data?: any; error?: string }> => {
    try {
      const result = await createRequirement(values)

      if (result.error) {
        return { error: result.error }
      }

      // Recargar la página para mostrar el nuevo requerimiento
      window.location.reload()
      return { data: result.data }
    } catch (error) {
      console.error("Error creating requirement:", error)
      return { error: error instanceof Error ? error.message : "Error inesperado" }
    }
  }

  const handleBuildWithAI = () => {
    // Navigate to the AI segment builder page or open a dialog
    console.log("Build segments with AI clicked")
    // TODO: Implement AI segment building functionality
    alert("AI segment building functionality coming soon!")
  }

  const handleCreateAsset = async ({ 
    name, 
    description, 
    file_path, 
    file_type,
    file_size,
    tags,
    site_id 
  }: { 
    name: string
    description?: string
    file_path: string
    file_type: string
    file_size: number
    tags: string[]
    site_id: string
  }) => {
    try {
      const result = await createAsset({ 
        name, 
        description, 
        file_path, 
        file_type,
        file_size,
        tags,
        site_id
      })

      if (result.error) {
        throw new Error(result.error)
      }

      // Recargar la página para mostrar el nuevo asset
      window.location.reload()
    } catch (error) {
      console.error("Error creating asset:", error)
      throw error
    }
  }

  const handleCreateLead = async (data: any): Promise<{ error?: string; lead?: any }> => {
    try {
      const result = await createLead(data)

      if (result.error) {
        return { error: result.error }
      }

      // Recargar la página para mostrar el nuevo lead
      window.location.reload()
      return { lead: result.lead }
    } catch (error) {
      console.error("Error creating lead:", error)
      return { error: error instanceof Error ? error.message : "Error inesperado" }
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10",
        breadcrumb ? "h-[calc(64px+41px)]" : "h-[64px]",
        className
      )}
      {...props}
    >
      <div className="flex h-[64px] items-center justify-between pr-16">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 ml-3.5"
            onClick={onCollapse}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
            <span className="sr-only">
              {isCollapsed ? "Expandir menú" : "Colapsar menú"}
            </span>
          </Button>
          
          {breadcrumbItems ? (
            <nav className="flex items-center" aria-label="Breadcrumb">
              <ol className="flex items-center">
                {breadcrumbItems.map((item, index) => (
                  <li key={`${item.href}-${index}`} className="flex items-center">
                    {index > 0 && (
                      <ChevronRight className="mx-1.5 h-4 w-4 text-muted-foreground/70" aria-hidden={true} />
                    )}
                    {item.isCurrent ? (
                      <span className="text-2xl font-semibold text-foreground">{item.label}</span>
                    ) : (
                      <Link 
                        href={item.href}
                        className="text-2xl font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : (
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          )}
          
          {helpText && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="inline-flex items-center justify-center rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                    <HelpCircle className="h-5 w-5" />
                    <span className="sr-only">Help</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" align="center">
                  <p className="max-w-xs text-sm">{helpText}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        
        {/* Actions section */}
        <div className="flex items-center gap-4">
          {isDashboardPage && (
            <>
              <CalendarDateRangePicker />
              <Button>Download</Button>
            </>
          )}
          {isSegmentsPage && (
            currentSite ? (
              <div className="flex items-center gap-2">
                <Button 
                  variant="secondary" 
                  size="default"
                  className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
                  onClick={handleBuildWithAI}
                >
                  <FlaskConical className="h-4 w-4" />
                  Build with AI
                </Button>
                <CreateSegmentDialog onCreateSegment={handleCreateSegment} />
              </div>
            ) : (
              <Button variant="outline" disabled>
                <PlusCircle className="mr-2 h-4 w-4" />
                Seleccione un sitio
              </Button>
            )
          )}
          {isExperimentsPage && (
            currentSite ? (
              <CreateExperimentDialog 
                segments={segments || []}
                onCreateExperiment={handleCreateExperiment}
              />
            ) : (
              <Button variant="outline" disabled>
                <PlusCircle className="mr-2 h-4 w-4" />
                Seleccione un sitio
              </Button>
            )
          )}
          {isRequirementsPage && (
            currentSite ? (
              <>
                <CreateRequirementDialog 
                  segments={segments || []}
                  onCreateRequirement={handleCreateRequirement}
                  trigger={
                    <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      New Requirement
                    </Button>
                  }
                />
              </>
            ) : (
              <Button variant="outline" disabled>
                <PlusCircle className="mr-2 h-4 w-4" />
                Seleccione un sitio
              </Button>
            )
          )}
          {isLeadsPage && (
            currentSite ? (
              <>
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
                <CreateLeadDialog 
                  segments={segments.length > 0 ? segments : propSegments || []}
                  onCreateLead={handleCreateLead}
                  trigger={
                    <Button>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Lead
                    </Button>
                  }
                />
              </>
            ) : (
              <Button variant="outline" disabled>
                <PlusCircle className="mr-2 h-4 w-4" />
                Seleccione un sitio
              </Button>
            )
          )}
          {isAgentsPage && (
            currentSite ? (
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Agent
              </Button>
            ) : (
              <Button variant="outline" disabled>
                <PlusCircle className="mr-2 h-4 w-4" />
                Seleccione un sitio
              </Button>
            )
          )}
          {isAssetsPage && (
            currentSite ? (
              <UploadAssetDialog onUploadAsset={handleCreateAsset} />
            ) : (
              <Button variant="outline" disabled>
                <PlusCircle className="mr-2 h-4 w-4" />
                Seleccione un sitio
              </Button>
            )
          )}
          {isContentPage && (
            currentSite ? (
              <CreateContentDialog 
                segments={segments.length > 0 ? segments : propSegments || []}
                onSuccess={() => {
                  // Recargar la página para mostrar el nuevo contenido
                  window.location.reload()
                }}
                trigger={
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    New Content
                  </Button>
                }
              />
            ) : (
              <Button variant="outline" disabled>
                <PlusCircle className="mr-2 h-4 w-4" />
                Seleccione un sitio
              </Button>
            )
          )}
        </div>
      </div>
      
      {/* Breadcrumb section - asegurar visibilidad */}
      {breadcrumb && (
        <div className="pl-16 py-2 border-t border-border/50 bg-white/50">
          {breadcrumb}
        </div>
      )}
    </div>
  )
} 