import { usePathname } from "next/navigation"
import { Button } from "../ui/button"
import Link from "next/link"
import { 
  HelpCircle, 
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from "@/app/components/ui/icons"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip"
import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"

interface TopBarTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  helpText?: string
  isCollapsed: boolean
  onCollapse: () => void
  breadcrumb?: React.ReactNode
}

export function TopBarTitle({ 
  title, 
  helpText,
  isCollapsed,
  onCollapse,
  className,
  breadcrumb,
  ...props 
}: TopBarTitleProps) {
  const pathname = usePathname()
  const [searchParams, setSearchParams] = useState<string>("")
  const [customTitle, setCustomTitle] = useState<string | null>(null)
  const [customAgentId, setCustomAgentId] = useState<string | null>(null)
  const [customAgentName, setCustomAgentName] = useState<string | null>(null)
  const [parentInfo, setParentInfo] = useState<{title: string, path: string} | null>(null)
  
  // States for segment detail page
  const [segmentData, setSegmentData] = useState<{
    id: string;
    activeTab: string;
    isAnalyzing: boolean;
    isGeneratingICP: boolean;
    isGeneratingTopics: boolean;
    openAIModal: (type: 'analysis' | 'icp' | 'topics') => void;
  } | null>(null);

  // Get the default title from the first route segment
  const getDefaultTitle = useCallback(() => {
    const pathSegments = pathname.split('/').filter(Boolean)
    if (pathSegments.length === 0) return "Dashboard"
    
    const firstSegment = pathSegments[0]
    const routeTitles: Record<string, string> = {
      'dashboard': 'Dashboard',
      'agents': 'Agents',
      'segments': 'Segments',
      'experiments': 'Experiments',
      'requirements': 'Requirements',
      'leads': 'Leads',
      'assets': 'Assets',
      'content': 'Content',
      'settings': 'Settings',
      'profile': 'Profile',
      'help': 'Help',
      'chat': 'Chat',
      'control-center': 'Control Center'
    }
    
    return routeTitles[firstSegment] || firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)
  }, [pathname])

  // Set the default title when the pathname changes
  useEffect(() => {
    setCustomTitle(getDefaultTitle())
  }, [pathname, getDefaultTitle])

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
        
        // Si se proporciona información del padre (por ejemplo, para comandos de agentes)
        if (event.detail.parent) {
          setParentInfo({
            title: event.detail.parent.title,
            path: event.detail.parent.path
          });
        } else {
          setParentInfo(null);
        }
        
        // Si se proporcionan datos del segmento para la página de detalle
        if (event.detail.segmentData) {
          setSegmentData(event.detail.segmentData);
        }
      }
    };
    
    // Escuchar cambios de pestaña en la página de detalle del segmento
    const handleSegmentTabChange = (event: any) => {
      if (event.detail && segmentData) {
        setSegmentData(prevData => {
          if (!prevData) return null;
          return {
            ...prevData,
            activeTab: event.detail.activeTab,
            isAnalyzing: event.detail.isAnalyzing,
            isGeneratingICP: event.detail.isGeneratingICP,
            isGeneratingTopics: event.detail.isGeneratingTopics
          };
        });
      }
    };
    
    window.addEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    window.addEventListener('segment:tabchange', handleSegmentTabChange as EventListener);
    
    return () => {
      window.removeEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
      window.removeEventListener('segment:tabchange', handleSegmentTabChange as EventListener);
    };
  }, [segmentData]);

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
      'control-center': 'Control Center'
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
    
    // Manejar caso especial para comandos de agentes
    if (pathSegments[0] === 'agents' && pathSegments.length === 3) {
      breadcrumbItems.push({
        href: '/agents',
        label: 'Agents',
        isCurrent: false
      });
      
      // Usar la información del parent si está disponible
      if (parentInfo) {
        breadcrumbItems.push({
          href: parentInfo.path,
          label: parentInfo.title,
          isCurrent: false
        });
      } else {
        // Fallback a un título genérico para el agente
        breadcrumbItems.push({
          href: `/agents/${pathSegments[1]}`,
          label: 'Agent',
          isCurrent: false
        });
      }
      
      // Usar el título personalizado para el comando
      breadcrumbItems.push({
        href: `/${pathSegments[0]}/${pathSegments[1]}/${pathSegments[2]}`,
        label: customTitle || 'Command Details',
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
    
    // Manejar caso especial para la página de detalle del lead
    if (pathSegments[0] === 'leads' && pathSegments.length === 2) {
      breadcrumbItems.push({
        href: '/leads',
        label: 'Leads',
        isCurrent: false
      });
      
      // Usar el título personalizado si está disponible
      breadcrumbItems.push({
        href: `/${pathSegments[0]}/${pathSegments[1]}`,
        label: customTitle || 'Lead Details',
        isCurrent: true
      });
      
      return breadcrumbItems;
    }
    
    // Manejar caso especial para la página de detalle del contenido
    if (pathSegments[0] === 'content' && pathSegments.length === 2) {
      breadcrumbItems.push({
        href: '/content',
        label: 'Content',
        isCurrent: false
      });
      
      // Usar el título personalizado si está disponible
      breadcrumbItems.push({
        href: `/${pathSegments[0]}/${pathSegments[1]}`,
        label: customTitle || 'Content Details',
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
  }, [pathname, searchParams, title, customTitle, customAgentId, customAgentName, parentInfo]);
  
  const [breadcrumbItems, setBreadcrumbItems] = useState<Array<{
    href: string;
    label: string;
    isCurrent: boolean;
  }> | null>(null);
  
  // Actualizar breadcrumb cuando cambie la ruta
  useEffect(() => {
    setBreadcrumbItems(generateBreadcrumbItems());
  }, [pathname, title, searchParams, customTitle, parentInfo, generateBreadcrumbItems]);
 
  return (
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
        <h1 className="text-2xl font-semibold text-foreground">{customTitle || getDefaultTitle()}</h1>
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
  )
} 