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
import { useNavigationHistory } from "@/app/hooks/use-breadcrumb-history"
import { useLocalization } from "@/app/context/LocalizationContext"

interface TopBarTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  helpText?: string
  helpWelcomeMessage?: string
  helpTask?: string
  isCollapsed: boolean
  onCollapse: () => void
  hideSidebarToggle?: boolean
  breadcrumb?: React.ReactNode
}

export function TopBarTitle({ 
  title, 
  helpText,
  helpWelcomeMessage,
  helpTask,
  isCollapsed,
  onCollapse,
  hideSidebarToggle,
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

  const getRouteTitle = useCallback((segment: string) => {
    const routeTitles: Record<string, string> = {
      'dashboard': t('layout.sidebar.dashboard') || 'Dashboard',
      'agents': t('layout.sidebar.agents') || 'Agents',
      'segments': t('layout.sidebar.segments') || 'Segments',
      'experiments': t('layout.sidebar.experiments') || 'Experiments',
      'requirements': t('layout.nav.requirements.title') || t('layout.sidebar.requirements') || 'Requirements',
      'leads': t('layout.sidebar.leads') || 'Leads',
      'assets': t('layout.sidebar.assets') || 'Assets',
      'content': t('layout.sidebar.content') || 'Content',
      'settings': t('layout.sidebar.settings') || 'Settings',
      'profile': t('layout.sidebar.profile') || 'Profile',
      'help': t('common.help') || 'Help',
      'chat': t('layout.sidebar.chat') || 'Chat',
      'campaigns': t('layout.sidebar.campaigns') || 'Campaigns',
      'control-center': t('layout.sidebar.controlCenter') || 'Tasks',
      'billing': t('layout.sidebar.billing') || 'Billing',
      'integrations': t('layout.sidebar.integrations') || 'Integrations',
      'security': t('layout.sidebar.security') || 'Security & API',
      'robots': t('layout.sidebar.robots') || 'Agents',
      'applications': t('layout.sidebar.applications') || 'Applications',
      'pos': t('layout.sidebar.pos') || 'Point of Sale',
      'catalog': t('layout.sidebar.catalog') || 'Catalog',
      'inventory': t('layout.sidebar.inventory') || 'Inventory',
      'price-lists': t('layout.sidebar.priceLists') || 'Price Lists',
      'orders': t('layout.sidebar.orders') || 'Orders',
      'shipments': t('layout.sidebar.shipments') || 'Shipments',
      'promotions': t('layout.sidebar.promotions') || 'Promotions',
      'subscriptions': t('layout.sidebar.subscriptions') || 'Subscriptions',
      'reservations': t('layout.sidebar.reservations') || 'Reservations',
      'visits': t('layout.sidebar.visits') || 'Visits',
      'accounting': t('layout.sidebar.chartOfAccounts') || 'Chart of Accounts',
      'finance': t('layout.sidebar.financeReports') || 'Finance Reports',
      'purchases': t('layout.category.buying') || 'Purchases',
      'bills': t('layout.sidebar.bills') || 'Bills',
      'transactions': t('layout.sidebar.transactions') || 'Expenses'
    }
    return routeTitles[segment]
  }, [t])

  // Get the default title from the first route segment
  const getDefaultTitle = useCallback(() => {
    const pathSegments = pathname.split('/').filter(Boolean)
    if (pathSegments.length === 0) return "Dashboard"
    
    // Handle specific case for checkout page
    if (pathSegments[0] === 'billing' && pathSegments[1] === 'checkout') {
      return "Checkout"
    }
    
    if (pathSegments[0] === 'accounting' && pathSegments[1] === 'entries') {
      return t('layout.sidebar.journalEntries') || "Journal Entries"
    }
    
    const firstSegment = pathSegments[0]
    return getRouteTitle(firstSegment) || firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1)
  }, [pathname, t, getRouteTitle])

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
  const breadcrumbItems = hasHistory ? historyItems.map((item, index, array) => {
    const [pathnameOnly, queryString] = item.path.split("?")
    const pathSegments = pathnameOnly.split("/").filter(Boolean)
    
    // Only translate bare roots (/chat).
    const isBareRoot = pathSegments.length === 1 && !queryString
    const translatedRoot = isBareRoot ? getRouteTitle(pathSegments[0]) : undefined
    
    return {
      href: item.path,
      label: translatedRoot || item.label,
      originalIndex: index,
      isCurrent: index === array.length - 1
    }
  }) : null;
 
  return (
    <div className={cn("flex items-center gap-4 min-w-0", className)}>
      {!hideSidebarToggle && (
        <Button
          variant="ghost"
          className="!hidden md:!flex h-8 w-8 p-0 items-center justify-center font-inter"
          onClick={onCollapse}
          // The responsive hidden class handles mobile display, but Safari sometimes needs explicit rules
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
      )}
      
      {breadcrumbItems ? (
        <nav className="flex items-center min-w-0" aria-label="Breadcrumb">
          <ol className="flex items-center min-w-0">
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
                  <li key={`${item.href}-${index}`} className={cn("flex items-center", isLast ? "min-w-0" : "shrink-0")}>
                    {index > 0 && (
                      <ChevronRight 
                        className={cn(
                          "mx-1.5 text-muted-foreground/70 transition-all duration-200 shrink-0",
                          isLast ? "h-5 w-5" : "h-4 w-4"
                        )} 
                        aria-hidden={true} 
                      />
                    )}
                    {item.isCurrent ? (
                      <span className={cn("font-semibold text-foreground transition-all duration-200 font-inter truncate block min-w-0", fontSize)}>
                        {item.label}
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          const historyItem = historyItems[item.originalIndex]
                          if (historyItem) {
                            navigateTo(historyItem)
                          }
                        }}
                        className={cn(
                          "font-semibold text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer font-inter truncate block min-w-0 text-left",
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
        <h1 className="text-2xl font-semibold text-foreground font-inter truncate">{customTitle || getDefaultTitle()}</h1>
      )}
      
      {(helpText || helpWelcomeMessage || helpTask) && (
        <HelpButton
          size="md"
          tooltipText={helpText || "Open help chat"}
          welcomeMessage={helpWelcomeMessage}
          task={helpTask}
          className="!hidden md:!flex"
        />
      )}
    </div>
  )
} 