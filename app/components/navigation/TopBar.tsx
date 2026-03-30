"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { TopBarTitle } from "./TopBarTitle"
import { TopBarActions } from "./TopBarActions"
import { Button } from "../ui/button"
import { Menu } from "@/app/components/ui/icons"

interface TopBarProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  helpText?: string
  helpWelcomeMessage?: string
  helpTask?: string
  isCollapsed: boolean
  onCollapse: () => void
  segments?: Array<{
    id: string
    name: string
    description: string
  }>
  breadcrumb?: React.ReactNode
  isExperimentDetailPage?: boolean
  onCreateSale?: () => void
  onCreateDeal?: () => void
  onMobileToggle?: () => void
}

export function TopBar({ 
  title, 
  helpText,
  helpWelcomeMessage,
  helpTask,
  isCollapsed,
  onCollapse,
  className,
  segments: propSegments,
  breadcrumb,
  isExperimentDetailPage = false,
  onCreateSale,
  onCreateDeal,
  onMobileToggle,
  ...props 
}: TopBarProps) {
  const pathname = usePathname()
  const { currentSite } = useSite()
  const [segments, setSegments] = useState<Array<{ id: string; name: string; description: string }>>([])
  const [isProcessing, setIsProcessing] = useState(false);
  const [requirements, setRequirements] = useState<Array<{ id: string; title: string; description: string }>>([])
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string; description: string }>>([])
  
  // States for segment detail page
  const [segmentData, setSegmentData] = useState<{
    id: string;
    activeTab: string;
    isAnalyzing: boolean;
    isGeneratingTopics: boolean;
    openAIModal: (type: 'analysis' | 'icp' | 'topics') => void;
  } | null>(null);

  // States for requirement detail page
  const [requirementData, setRequirementData] = useState<{
    id: string;
    isBuilding: boolean;
    hasRequirementStatus: boolean;
  } | null>(null);

  const [contentData, setContentData] = useState<any>(null);

  // Reset states when pathname changes
  useEffect(() => {
    setIsProcessing(false);
    
    // Clear page-specific data when navigating away from those pages
    if (!pathname.startsWith('/segments/')) {
      setSegmentData(null);
    }
    if (!pathname.startsWith('/requirements/')) {
      setRequirementData(null);
    }
    if (!pathname.startsWith('/content/')) {
      setContentData(null);
    }
  }, [pathname]);

  // Escuchar eventos de actualización del segmento y requirement
  useEffect(() => {
    const handleBreadcrumbUpdate = (event: any) => {
      console.log('TopBar received breadcrumb:update event:', event.detail);
      if (event.detail) {
        if (event.detail.segmentData) {
          setSegmentData(event.detail.segmentData);
        }
        if (event.detail.requirementData) {
          setRequirementData(event.detail.requirementData);
        }
        if (event.detail.contentData) {
          console.log('TopBar updating contentData state:', event.detail.contentData.title);
          setContentData(event.detail.contentData);
        }
      }
    };
    
    // Escuchar cambios de estado en requirement
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
    window.addEventListener('requirement:update', handleRequirementUpdate as EventListener);
    
    return () => {
      window.removeEventListener('breadcrumb:update', handleBreadcrumbUpdate as EventListener);
      window.removeEventListener('segment:tabchange', handleSegmentTabChange as EventListener);
      window.removeEventListener('requirement:update', handleRequirementUpdate as EventListener);
    };
  }, [segmentData]);
  
  // Cargar segmentos y requisitos cuando se está en ciertas páginas
  useEffect(() => {
    async function loadData() {
      if (!currentSite?.id) return
      
      // Only load segments for these pages
      if (pathname === "/leads" || pathname === "/content" || pathname === "/campaigns" || pathname === "/requirements" || pathname === "/experiments") {
        try {
          const response = await getSegments(currentSite.id)
          if (response.error) {
            console.error(response.error)
          } else if (response.segments) {
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
            const campaignsResponse = await getCampaigns(currentSite.id);
            if (campaignsResponse.error) {
              const isTransient = isNetworkError(campaignsResponse.error);
              if (isTransient && attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, 500));
                continue;
              }
              // Log as warning for transient network errors (we degrade gracefully with [])
              if (isTransient) {
                console.warn("Campaigns unavailable (network):", campaignsResponse.error);
              } else {
                console.error("Error loading campaigns:", campaignsResponse.error);
              }
            } else {
              setCampaigns(campaignsResponse.data || []);
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
      <div className="flex h-[64px] items-center justify-between pr-4 lg:px-8 w-full max-w-full">
        <div className="flex items-center min-w-0">
          <Button variant="ghost" size="icon" className="md:!hidden ml-2 mr-2 font-inter" onClick={onMobileToggle}>
            <Menu className="h-5 w-5" />
          </Button>
          <TopBarTitle 
            title={title}
            helpText={helpText}
            helpWelcomeMessage={helpWelcomeMessage}
            helpTask={helpTask}
            isCollapsed={isCollapsed}
            onCollapse={onCollapse}
            breadcrumb={breadcrumb}
          />
        </div>
        
        <TopBarActions
          isProcessing={isProcessing}
          setIsProcessing={setIsProcessing}
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
          isRobotsPage={pathname === "/robots"}
          isSecurityPage={pathname === "/security"}
          isExperimentDetailPage={isExperimentDetailPage}
          segmentData={segmentData}
          requirementData={requirementData}
          contentData={contentData}
          segments={segments}
          propSegments={propSegments}
          requirements={requirements}
          campaigns={campaigns}
          isDealsPage={pathname === "/deals"}
          onCreateSale={onCreateSale}
          onCreateDeal={onCreateDeal}
        />
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