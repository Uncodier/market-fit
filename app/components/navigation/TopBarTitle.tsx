"use client"

import { procurementRouteTitle } from '@/lib/navigation/procurement-route-title'
import { localeMessages } from '@/app/context/locale-catalog'
import { enforceInvariants, hasId } from '@/lib/navigation/breadcrumb-engine'
import { workspaceScreenTitle } from '@/lib/navigation/workspace-screen'
import { usePathname, useSearchParams } from "next/navigation"
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
import { REPORTS, isReportId } from "@/app/dashboard/report-sections"

interface TopBarTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  helpText?: string
  helpWelcomeMessage?: string
  helpTask?: string
  afterTitle?: React.ReactNode
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
  afterTitle,
  isCollapsed,
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
  const [customTitle, setCustomTitle] = useState<{ path: string; title: string } | null>(null)
  
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
      const detail = (event as CustomEvent<{ title?: string; path?: string }>).detail
      if (typeof detail?.title === 'string') {
        setCustomTitle({ path: detail.path || pathname, title: detail.title })
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
  const normalizedHistory = enforceInvariants(historyItems)
  const breadcrumbItems = hasHistory && !isScreenRoot ? normalizedHistory.map((item, index, array) => {
    const [pathnameOnly, queryString] = item.path.split("?")
    const pathSegments = pathnameOnly.split("/").filter(Boolean)
    
    // Only translate bare roots (/chat).
    const isBareRoot = pathSegments.length === 1 && !queryString
    const translatedRoot = !hasId(item.path)
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
      originalIndex: historyItems.indexOf(item),
      isCurrent: index === array.length - 1
    }
  }) : null;
 
  return (
    <div {...props} className={cn("flex items-center gap-4 min-w-0", className)}>
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
      
      {reportTitle ? (
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
        <h1 className="text-2xl font-semibold text-foreground font-inter truncate">{isScreenRoot ? getDefaultTitle() : (customTitle?.path === pathname ? customTitle.title : null) || getDefaultTitle() || title}</h1>
      )}

      {afterTitle ? <div className="shrink-0">{afterTitle}</div> : null}
      
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