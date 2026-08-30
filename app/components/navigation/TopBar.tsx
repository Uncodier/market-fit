"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import dynamic from "next/dynamic"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { TopBarTitle } from "./TopBarTitle"
import { Button } from "../ui/button"
import { Menu } from "@/app/components/ui/icons"

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
  segments?: Array<{
    id: string
    name: string
    description: string
  }>
  breadcrumb?: React.ReactNode
  hideBreadcrumb?: boolean
  onCreateSale?: () => void
  onCreateDeal?: () => void
  onMobileToggle?: () => void
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
  className,
  segments: propSegments,
  breadcrumb,
  hideBreadcrumb,
  onCreateSale,
  onCreateDeal,
  onMobileToggle,
  viewMode,
  isArtifact,
  ...props 
}: TopBarProps) {
  const pathname = usePathname()
  const { currentSite } = useSite()
  const [segments, setSegments] = useState<Array<{ id: string; name: string; description: string }>>([])
  const [requirements, setRequirements] = useState<Array<{ id: string; title: string; description: string }>>([])
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string; description: string }>>([])
  
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
          ...prevData,
          activeTab: event.detail.activeTab,
          isAnalyzing: event.detail.isAnalyzing,
          isGeneratingTopics: event.detail.isGeneratingTopics
        };
      });
    };
    
    window.addEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
    window.addEventListener('segment:tabchange', handleSegmentTabChange as EventListener);
    window.addEventListener('requirement:update', handleRequirementUpdate as EventListener);
    
    return () => {
      window.removeEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
      window.removeEventListener('segment:tabchange', handleSegmentTabChange as EventListener);
      window.removeEventListener('requirement:update', handleRequirementUpdate as EventListener);
    };
  }, []);
  
  // Cargar segmentos y requisitos cuando se está en ciertas páginas
  useEffect(() => {
    async function loadData() {
      if (!currentSite?.id) return
      
      // Only load segments for these pages
      const supabase = createClient()

      if (pathname === "/leads" || pathname === "/content" || pathname === "/campaigns" || pathname === "/requirements" || pathname === "/experiments") {
        try {
          const { data, error } = await supabase
            .from("segments")
            .select("id, name, description")
            .eq("site_id", currentSite.id)
            .order("created_at", { ascending: false })
          if (error) {
            console.error(error)
          } else {
            setSegments((data || []).map((s) => ({
              id: s.id,
              name: s.name,
              description: s.description || ""
            })))
          }
        } catch (error) {
          console.error("Error loading segments:", error)
        }
      }
      
      // Load requirements only for Control Center
      if (pathname === "/campaigns") {
        try {
          const reqResponse = await fetch(`/api/requirements?siteId=${currentSite.id}`);
          if (reqResponse.ok) {
            const requirementsData = await reqResponse.json();
            setRequirements(requirementsData);
          }
        } catch (reqErr) {
          console.error("Error loading requirements:", reqErr);
          setRequirements([]);
        }
      }

      // Load campaigns for the Requirements page, Leads page, and Experiments page
      if (pathname === "/requirements" || pathname === "/leads" || pathname === "/experiments") {
        const maxRetries = 2;
        const isNetworkError = (err: unknown) => {
          const msg = String(err instanceof Error ? err.message : err).toLowerCase();
          return (
            msg.includes("fetch failed") ||
            msg.includes("failed to fetch") ||
            msg.includes("network") ||
            msg.includes("econnrefused") ||
            msg.includes("enotfound") ||
            msg.includes("etimedout") ||
            msg.includes("econnreset")
          );
        };
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const { data, error } = await supabase
              .from("campaigns")
              .select("id, title, description")
              .eq("site_id", currentSite.id)
              .order("created_at", { ascending: false })
            if (error) {
              const isTransient = isNetworkError(error.message);
              if (isTransient && attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, 500));
                continue;
              }
              if (isTransient) {
                console.warn("Campaigns unavailable (network):", error.message);
              } else {
                console.error("Error loading campaigns:", error.message);
              }
            } else {
              setCampaigns((data || []).map((c) => ({
                id: c.id,
                title: c.title || "",
                description: c.description || ""
              })));
              break;
            }
          } catch (campaignErr) {
            const isTransient = isNetworkError(campaignErr);
            if (isTransient && attempt < maxRetries) {
              await new Promise((r) => setTimeout(r, 500));
              continue;
            }
            if (isTransient) {
              console.warn("Campaigns unavailable (network):", campaignErr);
            } else {
              console.error("Error loading campaigns:", campaignErr);
            }
          }
          setCampaigns([]);
          break;
        }
      }
    }

    loadData()
  }, [currentSite, pathname]);

  const isProfilePage = pathname === '/profile' || pathname.startsWith('/profile/');

  return (
    <div
      data-toolbar-font
      className={cn(
        "flex flex-col border-b dark:border-white/5 border-black/5 bg-background/95 backdrop-blur-sm sticky top-0 z-[200]",
        // Hide breadcrumb in chat pages, and only add extra height on desktop
        (breadcrumb && !pathname.startsWith("/chat")) ? "h-[64px] md:h-[calc(64px+41px)]" : "h-[64px]",
        className
      )}
      {...props}
    >
      <div className="flex h-[64px] items-center justify-between px-4 lg:px-8 w-full max-w-full">
        <div className="flex items-center min-w-0 flex-1">
          {!hideSidebarToggle && (
            <Button variant="ghost" size="icon" className="md:!hidden mr-2 font-inter shrink-0" onClick={onMobileToggle}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
          {!hideBreadcrumb && (
            <TopBarTitle 
              title={title}
              helpText={helpText}
              helpWelcomeMessage={helpWelcomeMessage}
              helpTask={helpTask}
              isCollapsed={isCollapsed}
              onCollapse={onCollapse}
              hideSidebarToggle={hideSidebarToggle}
              breadcrumb={breadcrumb}
              className="flex-1 min-w-0 pr-4"
            />
          )}
        </div>
        
        <div className="flex items-center justify-end shrink-0 ml-auto">
          <TopBarActions
            isPosPage={pathname === "/pos"}
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
            propSegments={propSegments}
            requirements={requirements}
            campaigns={campaigns}
            isDealsPage={pathname === "/deals"}
            isQuotationsPage={pathname === "/quotations"}
            onCreateSale={onCreateSale}
            onCreateDeal={onCreateDeal}
            viewMode={viewMode}
          />
        </div>
      </div>
      
      {/* Breadcrumb section - hidden on chat pages */}
      {breadcrumb && !pathname.startsWith("/chat") && (
        <div className="hidden md:block pl-4 lg:pl-8 py-2 border-t dark:border-white/5 border-black/5 dark:bg-black/50 bg-white/50">
          {breadcrumb}
        </div>
      )}
    </div>
  )
} 