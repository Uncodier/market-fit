"use client"

import { usePathname } from "next/navigation"
import { Button } from "../ui/button"
import { NavigationLink } from "./NavigationLink"
import { 
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from "@/app/components/ui/icons"
import { HelpButton } from "../ui/help-button"
import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useNavigationHistory } from "@/app/hooks/use-navigation-history"

interface TopBarTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  helpText?: string
  helpWelcomeMessage?: string
  helpTask?: string
  isCollapsed: boolean
  onCollapse: () => void
  breadcrumb?: React.ReactNode
}

export function TopBarTitle({ 
  title, 
  helpText,
  helpWelcomeMessage,
  helpTask,
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
  
  // Use navigation history hook
  const { items: historyItems, navigateTo, hasHistory } = useNavigationHistory()
  
  // States for segment detail page
  const [segmentData, setSegmentData] = useState<{
    id: string;
    activeTab: string;
    isAnalyzing: boolean;
    isGeneratingTopics: boolean;
    openAIModal: (type: 'analysis' | 'icp' | 'topics') => void;
  } | null>(null);

  // Get the default title from the first route segment
  const getDefaultTitle = useCallback(() => {
    const pathSegments = pathname.split('/').filter(Boolean)
    if (pathSegments.length === 0) return "Dashboard"
    
    // Handle specific case for checkout page
    if (pathSegments[0] === 'billing' && pathSegments[1] === 'checkout') {
      return "Checkout"
    }
    
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
      'campaigns': 'Campaigns',
      'control-center': 'Control Center',
      'billing': 'Billing',
      'robots': 'Makina'
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

  // Convert history items to breadcrumb format
  const breadcrumbItems = hasHistory ? historyItems.map((item, index) => ({
    href: item.path,
    label: item.label,
    isCurrent: index === historyItems.length - 1
  })) : null;
 
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
              {breadcrumbItems.map((item, index) => {
                // Calculate dynamic font size
                const total = breadcrumbItems.length
                const isLast = index === total - 1
                
                let fontSize = 'text-2xl'
                if (!isLast) {
                  const fromEnd = total - index - 1
                  const sizes = ['text-xl', 'text-lg', 'text-base', 'text-sm']
                  fontSize = sizes[fromEnd - 1] || 'text-sm'
                }
                
                return (
                  <li key={`${item.href}-${index}`} className="flex items-center">
                    {index > 0 && (
                      <ChevronRight 
                        className={cn(
                          "mx-1.5 text-muted-foreground/70 transition-all duration-200",
                          isLast ? "h-5 w-5" : "h-4 w-4"
                        )} 
                        aria-hidden={true} 
                      />
                    )}
                    {item.isCurrent ? (
                      <span className={cn("font-semibold text-foreground transition-all duration-200", fontSize)}>
                        {item.label}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          const historyItem = historyItems[index]
                          if (historyItem) {
                            navigateTo(historyItem)
                          }
                        }}
                        className={cn(
                          "font-semibold text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer",
                          fontSize
                        )}
                      >
                        {item.label}
                      </button>
                    )}
                  </li>
                )
              })}
          </ol>
        </nav>
      ) : (
        <h1 className="text-2xl font-semibold text-foreground">{customTitle || getDefaultTitle()}</h1>
      )}
      
      {(helpText || helpWelcomeMessage || helpTask) && (
        <HelpButton
          size="md"
          tooltipText={helpText || "Open help chat"}
          welcomeMessage={helpWelcomeMessage}
          task={helpTask}
        />
      )}
    </div>
  )
} 