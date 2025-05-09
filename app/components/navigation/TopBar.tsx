"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { getSegments } from "@/app/segments/actions"
import { TopBarTitle } from "./TopBarTitle"
import { TopBarActions } from "./TopBarActions"

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
  isExperimentDetailPage?: boolean
}

export function TopBar({ 
  title, 
  helpText,
  isCollapsed,
  onCollapse,
  className,
  segments: propSegments,
  breadcrumb,
  isExperimentDetailPage = false,
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
    isGeneratingICP: boolean;
    isGeneratingTopics: boolean;
    openAIModal: (type: 'analysis' | 'icp' | 'topics') => void;
  } | null>(null);

  // Escuchar eventos de actualización del segmento
  useEffect(() => {
    const handleBreadcrumbUpdate = (event: any) => {
      if (event.detail && event.detail.segmentData) {
        setSegmentData(event.detail.segmentData);
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
  
  // Cargar segmentos y requisitos cuando se está en ciertas páginas
  useEffect(() => {
    async function loadData() {
      if (!currentSite?.id) return
      
      // Only load segments for these pages
      if (pathname === "/leads" || pathname === "/content" || pathname === "/control-center" || pathname === "/requirements" || pathname === "/experiments") {
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
      if (pathname === "/control-center") {
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
        try {
          const campaignsResponse = await fetch(`/api/campaigns?siteId=${currentSite.id}`);
          if (campaignsResponse.ok) {
            const campaignsData = await campaignsResponse.json();
            setCampaigns(campaignsData);
          }
        } catch (campaignErr) {
          console.error("Error loading campaigns:", campaignErr);
          setCampaigns([]);
        }
      }
    }

    loadData()
  }, [currentSite, pathname]);

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
        <TopBarTitle 
          title={title}
          helpText={helpText}
          isCollapsed={isCollapsed}
          onCollapse={onCollapse}
          breadcrumb={breadcrumb}
        />
        
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
          isExperimentDetailPage={isExperimentDetailPage}
          segmentData={segmentData}
          segments={segments}
          propSegments={propSegments}
          requirements={requirements}
          campaigns={campaigns}
        />
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