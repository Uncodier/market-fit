"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import dynamic from "next/dynamic"
import Image from "next/image"
import { Button } from "@/app/components/ui/button"
import { Menu } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useWorkspaceStartup } from '@/app/workspace-preview/WorkspaceStartupBoundary'
import { TopBarTitle } from "./TopBarTitle"
import { PosTopBarActions } from "./PosTopBarActions"
import { PosTopBarSync } from "./PosTopBarSync"

const TopBarActions = dynamic(
  () => import("./TopBarActions").then((mod) => mod.TopBarActions),
  { ssr: false }
)

interface TopBarProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  helpText?: string
  helpWelcomeMessage?: string
  helpTask?: string
  isCollapsed: boolean
  onCollapse: () => void
  hideSidebarToggle?: boolean
  isMobileSidebarOpen?: boolean
  onMobileSidebarOpen?: () => void
  segments?: Array<{
    id: string
    name: string
    description: string
  }>
  breadcrumb?: React.ReactNode
  hideBreadcrumb?: boolean
  onCreateSale?: () => void
  onCreateDeal?: () => void
  viewMode?: string
  isArtifact?: boolean
}

export function TopBar({ 
  title, 
  helpText,
  helpWelcomeMessage,
  helpTask,
  isCollapsed,
  onCollapse,
  hideSidebarToggle,
  isMobileSidebarOpen,
  onMobileSidebarOpen,
  className,
  segments,
  breadcrumb,
  hideBreadcrumb,
  onCreateSale,
  onCreateDeal,
  viewMode,
  isArtifact,
  ...props 
}: TopBarProps) {
  const pathname = usePathname()
  const { t } = useLocalization()
  const startup = useWorkspaceStartup()
  
  // Determine if there are any visible actions on the right side
  // (We use a calculated hasActions below instead of state)
  
  // We'll let TopBarActions tell us if it rendered anything, or we can compute it here.
  // Actually, calculating it here is tricky. Let's pass a ref or callback.
  const [segmentData, setSegmentData] = useState<{
    id: string;
    activeTab: string;
    isAnalyzing: boolean;
    isGeneratingTopics: boolean;
    openAIModal: (type: 'analysis' | 'icp' | 'topics') => void;
  } | null>(null);

  const [requirementData, setRequirementData] = useState<{
    id: string;
    isBuilding: boolean;
    hasRequirementStatus: boolean;
  } | null>(null);

  const [contentData, setContentData] = useState<any>(null);

  const [priceListData, setPriceListData] = useState<{
    id: string;
    is_active: boolean;
  } | null>(null);

  // Reset states when pathname changes
  useEffect(() => {
    if (!pathname.startsWith('/segments/')) {
      setSegmentData(null);
    }
    if (!pathname.startsWith('/requirements/')) {
      setRequirementData(null);
    }
    if (!pathname.startsWith('/content/')) {
      setContentData(null);
    }
    if (!pathname.startsWith('/price-lists/')) {
      setPriceListData(null);
    }
  }, [pathname]);

  useEffect(() => {
    const handleBreadcrumbUpdate = (event: any) => {
      if (event.detail) {
        if (event.detail.segmentData) {
          setSegmentData(event.detail.segmentData);
        }
        if (event.detail.requirementData) {
          setRequirementData(event.detail.requirementData);
        }
        if (event.detail.contentData) {
          setContentData(event.detail.contentData);
        }
        if (event.detail.priceListData) {
          setPriceListData(event.detail.priceListData);
        }
      }
    };
    
    const handleRequirementUpdate = (event: any) => {
      if (event.detail) {
        setRequirementData(prevData => {
          return {
            ...prevData,
            ...event.detail
          };
        });
      }
    };

    const handleSegmentTabChange = (event: any) => {
      if (!event.detail) return;
      setSegmentData(prevData => {
        if (!prevData) return null;
        return {
          ...prevData, activeTab: event.detail.activeTab,
          isAnalyzing: event.detail.isAnalyzing, isGeneratingTopics: event.detail.isGeneratingTopics,
        }
      })
    }
    window.addEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener)
    window.addEventListener('segment:tabchange', handleSegmentTabChange as EventListener)
    window.addEventListener('requirement:update', handleRequirementUpdate as EventListener)
    return () => {
      window.removeEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener)
      window.removeEventListener('segment:tabchange', handleSegmentTabChange as EventListener)
      window.removeEventListener('requirement:update', handleRequirementUpdate as EventListener)
    }
  }, [])
  const showBreadcrumbRow = Boolean(breadcrumb) && !pathname.startsWith("/chat") &&
    !(pathname === "/robots" || pathname.startsWith("/robots/"))

  return (
    <div
      data-topbar
      data-toolbar-font
      className={cn(
        "flex flex-col border-b dark:border-white/5 border-black/5 bg-background/95 backdrop-blur-sm sticky top-0 z-[200]",
        // Robots uses instance tabs on desktop instead of an extra breadcrumb row.
        showBreadcrumbRow ? "h-[64px] md:h-[calc(64px+41px)]" : "h-[64px]",
        className
      )}
      {...props}
    >
      <div className="flex h-[64px] items-center justify-between px-4 lg:px-8 w-full max-w-full">
        <div className="flex items-center min-w-0 flex-1">
          {!hideSidebarToggle && onMobileSidebarOpen && (
            <div className="mr-3 flex shrink-0 items-center gap-1 md:hidden">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                aria-label={t("common.openMenu")}
                aria-expanded={isMobileSidebarOpen}
                aria-controls="workspace-sidebar"
                onClick={onMobileSidebarOpen}
              >
                <Menu className="topbar-menu-icon" aria-hidden={true} />
              </Button>
              <Image src="/images/isotipo.svg" alt="Makinari" width={24} height={28} className="h-7 w-auto shrink-0 brightness-0 dark:brightness-100" />
            </div>
          )}
          {!hideBreadcrumb && (
            <TopBarTitle 
              title={title}
              helpText={helpText}
              helpWelcomeMessage={helpWelcomeMessage}
              helpTask={helpTask}
              afterTitle={pathname === "/pos" ? <PosTopBarSync /> : null}
              isCollapsed={isCollapsed}
              onCollapse={onCollapse}
              hideSidebarToggle={hideSidebarToggle}
              breadcrumb={breadcrumb}
              className="flex-1 min-w-0 pr-4"
            />
          )}
        </div>
        
        <div className="flex items-center justify-end shrink-0 ml-auto">
          {pathname === "/pos" ? <PosTopBarActions /> : null}
          {!startup && <TopBarActions
            isDashboardPage={pathname === "/dashboard"}
            isSegmentsPage={pathname === "/segments"}
            isExperimentsPage={pathname === "/experiments"}
            isRequirementsPage={pathname === "/requirements"}
            isLeadsPage={pathname === "/leads"}
            isAgentsPage={pathname === "/agents"}
            isAssetsPage={pathname === "/assets"}
            isContentPage={pathname === "/content"}
            isControlCenterPage={pathname === "/control-center"}
            isCampaignsPage={pathname === "/campaigns"}
            isSalesPage={pathname === "/sales"}
            isRecordsPage={pathname === "/records"}
            isRobotsPage={pathname === "/robots"}
            isSecurityPage={pathname === "/security"}
            isAccountingPage={pathname === "/accounting"}
            isFinancePage={pathname === "/finance"}
            isJournalEntriesPage={pathname === "/accounting/entries"}
            isSettingsPage={pathname === "/settings" || pathname.startsWith("/settings/")}
            segmentData={segmentData}
            requirementData={requirementData}
            contentData={contentData}
            priceListData={priceListData}
            segments={segments}
            isDealsPage={pathname === "/deals"}
            isQuotationsPage={pathname === "/quotations"}
            onCreateSale={onCreateSale}
            onCreateDeal={onCreateDeal}
            viewMode={viewMode}
          />}
        </div>
      </div>
      
      {/* Optional desktop breadcrumb row for other workspace screens. */}
      {showBreadcrumbRow && (
        <div className="hidden md:block pl-4 lg:pl-8 py-2 border-t dark:border-white/5 border-black/5 dark:bg-black/50 bg-white/50">
          {breadcrumb}
        </div>
      )}
    </div>
  )
} 