"use client"

import { procurementRouteTitle } from '@/lib/navigation/procurement-route-title'
import { localeMessages } from '@/app/context/locale-catalog'
import { enforceInvariants, getScreenKey, hasId, isAgentSessionDetail } from '@/lib/navigation/breadcrumb-engine'
import { workspaceScreenTitle } from '@/lib/navigation/workspace-screen'
import { usePathname, useSearchParams } from "next/navigation"
import { Button } from "../ui/button"
import { NavigationLink } from "./NavigationLink"
import { SavedListBreadcrumb } from "@/app/people/saved-list-breadcrumb"
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
import { REPORTS, isReportId } from "@/app/dashboard/report-sections"
import { WORKSPACE_SIDEBAR_ACTION, type WorkspaceSidebarMode } from "./workspace-sidebar-mode"

interface TopBarTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  helpText?: string
  helpWelcomeMessage?: string
  helpTask?: string
  afterTitle?: React.ReactNode
  isCollapsed: boolean
  sidebarMode?: WorkspaceSidebarMode
  onCollapse: () => void
  hideSidebarToggle?: boolean
  breadcrumb?: React.ReactNode
}

export function TopBarTitle({ 
  title, 
  helpText,
  helpWelcomeMessage,
  helpTask,
  afterTitle,
  isCollapsed,
  sidebarMode,
  onCollapse,
  hideSidebarToggle,
  className,
  breadcrumb,
  ...props 
}: TopBarTitleProps) {
  const { t } = useLocalization()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const reportParam = searchParams.get("tab")
  const reportTitle = pathname === "/dashboard" && reportParam !== "onboarding"
    ? REPORTS[isReportId(reportParam) ? reportParam : "performance"].title
    : null
  const [customTitle, setCustomTitle] = useState<{ path: string; title: string; parentTitle?: string } | null>(null)
  
  const [peopleListName, setPeopleListName] = useState<string | null>(null)
  useEffect(() => {
    if (pathname !== '/people') return
    const update = (event: Event) => setPeopleListName((event as CustomEvent<string | null>).detail)
    window.addEventListener('people:list-breadcrumb', update)
    return () => {
      window.removeEventListener('people:list-breadcrumb', update)
      setPeopleListName(null)
    }
  }, [pathname])
  const listTitle = pathname === '/people' ? peopleListName : null

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
      'assets': t('layout.sidebar.assets') || 'Files',
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
      'order-lines': t('layout.sidebar.orderLines') || 'Order Lines',
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
    if (pathname.startsWith('/inventory/movements/')) return 'Transfer Details'
    const screenTitle = workspaceScreenTitle(`${pathname}?${searchParams.toString()}`, t)
    if (screenTitle && !hasId(`${pathname}?${searchParams.toString()}`)) return screenTitle
    const procurementTitle = procurementRouteTitle(pathname, t)
    if (procurementTitle) return procurementTitle
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
  }, [pathname, searchParams, t, getRouteTitle])

  // Scope loaded entity titles to the route that emitted them.
  useEffect(() => {
    const handleBreadcrumbUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string; path?: string; parentTitle?: string }>).detail
      if (typeof detail?.title === 'string') {
        setCustomTitle({ path: detail.path || pathname, title: detail.title, parentTitle: detail.parentTitle })
      }
    };
    
    window.addEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    
    return () => {
      window.removeEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    };
  }, [pathname]);

  // Convert history items to breadcrumb format
  const fullPath = `${pathname}?${searchParams.toString()}`
  const isScreenRoot = !hasId(fullPath)
  const recordsCategory = pathname === "/records" && customTitle?.path === pathname && customTitle.parentTitle ? customTitle : null
  const showIconOnlyOnMobile = isScreenRoot && ['/robots', '/skills', '/context'].includes(pathname)
  const normalizedHistory = enforceInvariants(historyItems)
  const currentItem = normalizedHistory[normalizedHistory.length - 1]
  const breadcrumbItems = hasHistory && !isScreenRoot && currentItem && getScreenKey(currentItem.path) === getScreenKey(fullPath)
    ? normalizedHistory.map((item, index, array) => {
    const [pathnameOnly, queryString] = item.path.split("?")
    const pathSegments = pathnameOnly.split("/").filter(Boolean)
    
    // Only translate bare roots (/chat).
    const isBareRoot = pathSegments.length === 1 && !queryString
    const translatedRoot = item.path === '/robots' && isAgentSessionDetail(fullPath)
      ? t('layout.nav.robots.title')
      : !hasId(item.path)
      ? workspaceScreenTitle(item.path, t) || (isBareRoot ? getRouteTitle(pathSegments[0]) : undefined)
      : undefined
    const procurementLabel = procurementRouteTitle(pathnameOnly, t)
    const canonicalProcurementLabel = procurementRouteTitle(pathnameOnly)
    const isDefaultProcurementLabel = item.label === canonicalProcurementLabel || Object.values(localeMessages).some(messages =>
      Object.entries(messages).some(([key, value]) => key.startsWith('procurement.navigation.') && value === item.label))
    const translatedProcurement = procurementLabel && isDefaultProcurementLabel ? procurementLabel : undefined
    
    return {
      href: item.path,
      label: translatedRoot || translatedProcurement || item.label,
      historyItem: item,
      isCurrent: index === array.length - 1
    }
  }) : null;
 
  const sidebarAction = WORKSPACE_SIDEBAR_ACTION[sidebarMode ?? (isCollapsed ? "compact" : "expanded")]

  return (
    <div {...props} className={cn("flex items-center gap-4 min-w-0", className)}>
      {!hideSidebarToggle && (
        <Button
          type="button"
          variant="ghost"
          className="!hidden md:!flex h-8 w-8 shrink-0 p-0 items-center justify-center font-inter"
          onClick={onCollapse}
          aria-controls="workspace-sidebar"
          aria-label={sidebarAction}
          title={sidebarAction}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden={true} />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden={true} />
          )}
        </Button>
      )}
      
      {listTitle ? (
        <SavedListBreadcrumb root={getDefaultTitle()} name={listTitle} onReturn={() => window.dispatchEvent(new Event('people:return-to-search'))} />
      ) : recordsCategory ? (
        <SavedListBreadcrumb root={recordsCategory.parentTitle || getDefaultTitle()} name={recordsCategory.title}
          onReturn={() => window.dispatchEvent(new Event("records:return-to-all"))} />
      ) : reportTitle ? (
        <nav className="flex items-center min-w-0" aria-label="Breadcrumb">
          <ol className="flex items-center min-w-0">
            <li className="flex items-center shrink-0">
              <NavigationLink href="/dashboard" className="text-xl font-semibold text-muted-foreground hover:text-foreground transition-colors font-inter">
                {getRouteTitle("dashboard")}
              </NavigationLink>
            </li>
            <li className="flex items-center min-w-0">
              <ChevronRight className="mx-1.5 h-5 w-5 shrink-0 text-muted-foreground/70" aria-hidden={true} />
              <h1 aria-current="page" className="text-2xl font-semibold text-foreground font-inter truncate">
                {reportTitle}
              </h1>
            </li>
          </ol>
        </nav>
      ) : breadcrumbItems ? (
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
                      <h1 aria-current="page" className={cn("font-semibold text-foreground transition-all duration-200 font-inter truncate block min-w-0", fontSize)}>
                        {item.label}
                      </h1>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigateTo(item.historyItem)}
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
        <h1 className={cn("text-2xl font-semibold text-foreground font-inter truncate", showIconOnlyOnMobile && "max-md:sr-only")}>
          {isScreenRoot ? getDefaultTitle() : (customTitle?.path === pathname ? customTitle.title : null) || getDefaultTitle() || title}
        </h1>
      )}

      {afterTitle ? <div className="shrink-0 empty:hidden">{afterTitle}</div> : null}
      
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