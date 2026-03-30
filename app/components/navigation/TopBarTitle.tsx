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
import { useLocalization } from "@/app/context/LocalizationContext"

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
  const { t } = useLocalization()
  const pathname = usePathname()
  const [searchParams, setSearchParams] = useState<string>("")
  const [customTitle, setCustomTitle] = useState<string | null>(null)
  const [customAgentId, setCustomAgentId] = useState<string | null>(null)
  const [customAgentName, setCustomAgentName] = useState<string | null>(null)
  const [parentInfo, setParentInfo] = useState<{title: string, path: string} | null>(null)
  
  // Use navigation history hook
  const { items: historyItems, navigateTo, hasHistory } = useNavigationHistory()
  
  // States for segment detail page

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
      'dashboard': t('layout.sidebar.dashboard') || 'Dashboard',
      'agents': t('layout.sidebar.agents') || 'Agents',
      'segments': t('layout.sidebar.segments') || 'Segments',
      'experiments': t('layout.sidebar.experiments') || 'Experiments',
      'requirements': t('layout.sidebar.requirements') || 'Requirements',
      'leads': t('layout.sidebar.leads') || 'Leads',
      'assets': t('layout.sidebar.assets') || 'Assets',
      'content': t('layout.sidebar.content') || 'Content',
      'settings': t('layout.sidebar.settings') || 'Settings',
      'profile': t('layout.sidebar.profile') || 'Profile',
      'help': t('common.help') || 'Help',
      'chat': t('layout.sidebar.chat') || 'Chat',
      'campaigns': t('layout.sidebar.campaigns') || 'Campaigns',
      'control-center': t('layout.sidebar.controlCenter') || 'Control Center',
      'billing': t('layout.sidebar.billing') || 'Billing',
      'robots': t('layout.sidebar.robots') || 'Makina'
    }
    
    return routeTitles[firstSegment] || firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)
  }, [pathname, t])

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
      }
    };
    
    window.addEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    
    return () => {
      window.removeEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    };
  }, []);

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
        className="hidden md:flex h-8 w-8 p-0 ml-3.5 items-center justify-center font-inter"
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
                      <span className={cn("font-semibold text-foreground transition-all duration-200 font-inter", fontSize)}>
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
                          "font-semibold text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer font-inter",
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
        <h1 className="text-2xl font-semibold text-foreground font-inter">{customTitle || getDefaultTitle()}</h1>
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