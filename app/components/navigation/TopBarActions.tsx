import { createSegment } from "@/app/segments/actions"
import { createExperiment, type ExperimentFormValues } from "@/app/experiments/actions"
import { createAsset } from "@/app/assets/actions"
import { createRequirement } from "@/app/requirements/actions"
import { createLead } from "@/app/leads/actions"
import { createCampaign } from "@/app/control-center/actions/campaigns/create"
import { buildSegmentsWithAI, buildExperimentsWithAI } from "@/app/services/ai-service"
import { Button } from "../ui/button"
import { CreateSegmentDialog } from "../create-segment-dialog"
import { CreateExperimentDialog } from "../create-experiment-dialog"
import { UploadAssetDialog } from "../upload-asset-dialog"
import { CreateRequirementDialog } from "../create-requirement-dialog"
import { CreateLeadDialog } from "../create-lead-dialog"
import { CreateContentDialog } from "@/app/content/components"
import { CreateCampaignDialog } from "../create-campaign-dialog"
import { CalendarDateRangePicker } from "../ui/date-range-picker"
import { AIActionModal } from "@/app/components/ui/ai-action-modal"
import { useSite } from "@/app/context/SiteContext"
import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { 
  BarChart, 
  PlusCircle, 
  FlaskConical, 
  Download, 
  Users, 
  FileText
} from "@/app/components/ui/icons"
import { subMonths, format } from "date-fns"

// Cpu icon para representación de AI
const Cpu = ({ className = "", size = 20, ...props }: { className?: string, size?: number, [key: string]: any }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
    <rect x="9" y="9" width="6" height="6"></rect>
    <line x1="9" y1="1" x2="9" y2="4"></line>
    <line x1="15" y1="1" x2="15" y2="4"></line>
    <line x1="9" y1="20" x2="9" y2="23"></line>
    <line x1="15" y1="20" x2="15" y2="23"></line>
    <line x1="20" y1="9" x2="23" y2="9"></line>
    <line x1="20" y1="14" x2="23" y2="14"></line>
    <line x1="1" y1="9" x2="4" y2="9"></line>
    <line x1="1" y1="14" x2="4" y2="14"></line>
  </svg>
);

interface TopBarActionsProps {
  isProcessing: boolean
  setIsProcessing: (value: boolean) => void
  isDashboardPage: boolean
  isSegmentsPage: boolean
  isExperimentsPage: boolean
  isRequirementsPage: boolean
  isLeadsPage: boolean
  isAgentsPage: boolean
  isAssetsPage: boolean
  isContentPage: boolean
  isControlCenterPage: boolean
  isSalesPage: boolean
  isExperimentDetailPage?: boolean
  segmentData: {
    id: string
    activeTab: string
    isAnalyzing: boolean
    isGeneratingICP: boolean
    isGeneratingTopics: boolean
    openAIModal: (type: 'analysis' | 'icp' | 'topics') => void
  } | null
  segments: Array<{ id: string; name: string; description: string }>
  propSegments?: Array<{ id: string; name: string; description: string }>
  requirements: Array<{ id: string; title: string; description: string }>
  campaigns: Array<{ id: string; title: string; description: string }>
  onCreateSale?: () => void
}

export function TopBarActions({
  isProcessing,
  setIsProcessing,
  isDashboardPage,
  isSegmentsPage,
  isExperimentsPage,
  isRequirementsPage,
  isLeadsPage,
  isAgentsPage,
  isAssetsPage,
  isContentPage,
  isControlCenterPage,
  isSalesPage,
  isExperimentDetailPage = false,
  segmentData,
  segments,
  propSegments,
  requirements,
  campaigns,
  onCreateSale
}: TopBarActionsProps) {
  const { currentSite } = useSite()
  const router = useRouter()
  const pathname = usePathname()
  const [dateRange, setDateRange] = useState<{ startDate: Date; endDate: Date }>({
    startDate: subMonths(new Date(), 1),
    endDate: new Date()
  })
  const [selectedSegment, setSelectedSegment] = useState<string>("all")
  
  // AI Action Modal state
  const [isAIModalOpen, setIsAIModalOpen] = useState(false)
  const [isGeneratingExperiment, setIsGeneratingExperiment] = useState(false)
  const [AIModalConfig, setAIModalConfig] = useState({
    title: "",
    description: "",
    actionLabel: "",
    estimatedTime: 0,
    action: async (): Promise<any> => {}
  })

  // Get current user
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function getUserId() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
      }
    }
    getUserId()
  }, [])

  const handleCreateSegment = async ({ 
    name, 
    description, 
    audience, 
    language,
    site_id 
  }: { 
    name: string
    description: string
    audience: string
    language: string
    site_id: string
  }) => {
    try {
      const result = await createSegment({ 
        name, 
        description, 
        audience, 
        language,
        site_id
      })

      if (result.error) {
        throw new Error(result.error)
      }

      // Recargar la página para mostrar el nuevo segmento
      window.location.reload()
    } catch (error) {
      console.error("Error creating segment:", error)
      throw error
    }
  }

  const handleCreateExperiment = async (values: ExperimentFormValues): Promise<{ data?: any; error?: string }> => {
    try {
      const result = await createExperiment(values);

      if (result.error) {
        return { error: result.error };
      }

      // Recargar la página para mostrar el nuevo experimento
      window.location.reload();
      return { data: result.data };
    } catch (error) {
      console.error("Error creating experiment:", error);
      return { error: error instanceof Error ? error.message : "Error inesperado" };
    }
  }

  const handleCreateRequirement = async (values: any): Promise<{ data?: any; error?: string }> => {
    try {
      const result = await createRequirement(values)

      if (result.error) {
        return { error: result.error }
      }

      // Recargar la página para mostrar el nuevo requerimiento
      window.location.reload()
      return { data: result.data }
    } catch (error) {
      console.error("Error creating requirement:", error)
      return { error: error instanceof Error ? error.message : "Error inesperado" }
    }
  }

  const handleBuildWithAI = () => {
    // Avoid multiple clicks while processing
    if (isProcessing) return;
    
    // Configure the AI modal according to the current page
    if (isSegmentsPage) {
      setAIModalConfig({
        title: "Building Segments with AI",
        description: "Our AI will analyze your site data and automatically create optimized audience segments based on your business goals and target market. This helps you identify and target the most valuable customer groups.",
        actionLabel: "Build Segments",
        estimatedTime: 120, // 2 minutes
        action: handleBuildSegmentsWithAI
      });
    } else if (isExperimentsPage) {
      setAIModalConfig({
        title: "Building Experiments with AI",
        description: "Our AI will analyze your site data and automatically create A/B test experiments designed to improve conversion rates and user experience. This helps you identify what changes will have the most impact on your business goals.",
        actionLabel: "Build Experiments",
        estimatedTime: 120, // 2 minutes
        action: handleBuildExperimentsWithAI
      });
    }
    
    // Open the modal after configuring it
    setTimeout(() => {
      setIsAIModalOpen(true);
    }, 0);
  };
  
  // Function to handle the AI segment building process
  const handleBuildSegmentsWithAI = async (): Promise<any> => {
    try {
      // Mark as processing
      setIsProcessing(true);
      
      // Verify that there is a selected site
      if (!currentSite) {
        setIsProcessing(false);
        toast.error("Please select a site first");
        return {
          success: false,
          error: "No site selected"
        };
      }

      // Verify that the site has a URL
      if (!currentSite.url) {
        setIsProcessing(false);
        toast.error("The selected site doesn't have a URL. Please add a URL to your site in the settings.");
        return {
          success: false,
          error: "Site URL is missing"
        };
      }

      // Get the current user ID
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsProcessing(false);
        toast.error("You must be logged in to use this feature");
        return {
          success: false,
          error: "Authentication required"
        };
      }

      console.log("Starting AI segment building with params:", {
        user_id: user.id,
        site_id: currentSite.id,
        url: currentSite.url,
        segmentCount: 3
      });

      // Call the AI service to build segments
      const result = await buildSegmentsWithAI({
        user_id: user.id,
        site_id: currentSite.id,
        url: currentSite.url,
        segmentCount: 3
      });

      console.log("AI segment building result:", result);

      if (result.success) {
        toast.success("Segments created successfully!");
        // Redirect to the segments page
        router.push(`/segments/${result.data?.segmentId || ''}`);
        return result;
      } else {
        // Instead of throwing an error, return the complete result
        // so the modal can display the error and HTML response if it exists
        console.error("Error building segments with AI:", result.error);
        if (result.rawResponse) {
          console.error("Raw response from server:", result.rawResponse.substring(0, 200) + "...");
        }
        if (result.details) {
          console.error("Error details:", result.details);
        }
        return result;
      }
    } catch (error) {
      console.error("Unexpected error in handleBuildSegmentsWithAI:", error);
      
      // Return an object with the format expected by the modal
      return {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
        details: {
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : "Unknown Error"
        }
      };
    } finally {
      // Always mark as not processing when finished
      setIsProcessing(false);
    }
  };

  // Function to handle the AI experiment building process
  const handleBuildExperimentsWithAI = async (): Promise<any> => {
    try {
      // Mark as processing
      setIsProcessing(true);
      
      // Verify that there is a selected site
      if (!currentSite) {
        setIsProcessing(false);
        toast.error("Please select a site first");
        return {
          success: false,
          error: "No site selected"
        };
      }

      // Verify that the site has a URL
      if (!currentSite.url) {
        setIsProcessing(false);
        toast.error("The selected site doesn't have a URL. Please add a URL to your site in the settings.");
        return {
          success: false,
          error: "Site URL is missing"
        };
      }

      // Get the current user ID
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsProcessing(false);
        toast.error("You must be logged in to use this feature");
        return {
          success: false,
          error: "Authentication required"
        };
      }

      console.log("Starting AI experiment building with params:", {
        user_id: user.id,
        site_id: currentSite.id,
        url: currentSite.url,
        experimentCount: 2
      });

      // Call the AI service to build experiments
      const result = await buildExperimentsWithAI({
        user_id: user.id,
        site_id: currentSite.id,
        url: currentSite.url,
        experimentCount: 2
      });

      console.log("AI experiment building result:", result);

      if (result.success) {
        toast.success("Experiments created successfully!");
        // Redirect to the experiments page
        router.push(`/experiments/${result.data?.experimentId || ''}`);
        return result;
      } else {
        // Instead of throwing an error, return the complete result
        // so the modal can display the error and HTML response if it exists
        console.error("Error building experiments with AI:", result.error);
        if (result.rawResponse) {
          console.error("Raw response from server:", result.rawResponse.substring(0, 200) + "...");
        }
        if (result.details) {
          console.error("Error details:", result.details);
        }
        return result;
      }
    } catch (error) {
      console.error("Unexpected error in handleBuildExperimentsWithAI:", error);
      
      // Return an object with the format expected by the modal
      return {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
        details: {
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : "Unknown Error"
        }
      };
    } finally {
      // Always mark as not processing when finished
      setIsProcessing(false);
    }
  };

  const handleCreateAsset = async ({ 
    name, 
    description, 
    file_path, 
    file_type,
    file_size,
    tags,
    site_id 
  }: { 
    name: string
    description?: string
    file_path: string
    file_type: string
    file_size: number
    tags: string[]
    site_id: string
  }) => {
    try {
      const result = await createAsset({ 
        name, 
        description, 
        file_path, 
        file_type,
        file_size,
        tags,
        site_id
      })

      if (result.error) {
        throw new Error(result.error)
      }

      // Recargar la página para mostrar el nuevo asset
      window.location.reload()
    } catch (error) {
      console.error("Error creating asset:", error)
      throw error
    }
  }

  const handleCreateLead = async (data: any): Promise<{ error?: string; lead?: any }> => {
    try {
      const result = await createLead(data)

      if (result.error) {
        return { error: result.error }
      }

      // Recargar la página para mostrar el nuevo lead
      window.location.reload()
      return { lead: result.lead }
    } catch (error) {
      console.error("Error creating lead:", error)
      return { error: error instanceof Error ? error.message : "Error inesperado" }
    }
  }

  const handleCreateCampaign = async (values: any): Promise<{ data?: any; error?: string }> => {
    try {
      const response = await createCampaign(values);
      if (response.error) {
        return { error: response.error };
      }
      
      toast.success("Campaign created successfully");
      
      // Reload the page to show the new campaign
      window.location.reload();
      
      return { data: response.data };
    } catch (error) {
      console.error("Error creating campaign:", error);
      return { error: error instanceof Error ? error.message : "An unexpected error occurred" };
    }
  };

  // Function to handle Build with AI for experiment detail page
  const handleGenerateExperimentWithAI = () => {
    setIsGeneratingExperiment(true);
    
    // Simulate API call to generate experiment content
    setTimeout(() => {
      // In a real implementation, this would call an API to update the experiment
      toast.success("Experiment content generated successfully");
      
      // Trigger an event that the experiment detail page can listen for
      window.dispatchEvent(new CustomEvent('experiment:ai-generated', {
        detail: {
          content: `
# AI Generated Experiment

This is a sample experiment generated by AI based on your site data.

## Hypothesis

By implementing these changes, we expect to see an improvement in user engagement and conversion rates.

## Changes to implement

- Optimize the call-to-action buttons with more compelling copy
- Simplify the checkout process by reducing form fields
- Add social proof elements near conversion points

## Success metrics

The success of this experiment will be measured by:

- Increased click-through rate on CTA buttons
- Reduced cart abandonment
- Higher overall conversion rate
          `
        }
      }));
      
      setIsGeneratingExperiment(false);
    }, 2000);
  };

  return (
    <div className="flex items-center gap-4">
      {isDashboardPage && (
        currentSite ? (
          <>
            <Button 
              onClick={async () => {
                if (!userId) {
                  toast.error('User not authenticated')
                  return
                }

                try {
                  const response = await fetch(
                    `/api/dashboard/export?siteId=${currentSite.id}&segmentId=${selectedSegment}&userId=${userId}&startDate=${format(dateRange.startDate, 'yyyy-MM-dd')}&endDate=${format(dateRange.endDate, 'yyyy-MM-dd')}`,
                    {
                      method: 'GET',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                    }
                  )
                  
                  if (!response.ok) throw new Error('Export failed')
                  
                  const blob = await response.blob()
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `dashboard-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
                  document.body.appendChild(a)
                  a.click()
                  window.URL.revokeObjectURL(url)
                  document.body.removeChild(a)
                  
                  toast.success('Report exported successfully')
                } catch (error) {
                  console.error('Error exporting dashboard data:', error)
                  toast.error('Failed to export report')
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </>
        ) : (
          <Button variant="outline" disabled>
            <Download className="mr-2 h-4 w-4" />
            Select a site
          </Button>
        )
      )}
      {/* Experiment Detail Page AI Button */}
      {isExperimentDetailPage && currentSite && (
        <Button 
          variant="secondary" 
          size="default"
          className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
          onClick={handleGenerateExperimentWithAI}
          disabled={isGeneratingExperiment}
        >
          {isGeneratingExperiment ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
              Generating...
            </>
          ) : (
            <>
              <Cpu className="h-4 w-4" />
              Build with AI
            </>
          )}
        </Button>
      )}
      {/* Segment Detail Page AI Buttons */}
      {segmentData && (
        <>
          {segmentData.activeTab === "analysis" && (
            <Button 
              variant="secondary" 
              size="default"
              className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
              onClick={() => segmentData.openAIModal('analysis')}
              disabled={segmentData.isAnalyzing || segmentData.isGeneratingICP || segmentData.isGeneratingTopics}
            >
              {segmentData.isAnalyzing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                  Analyzing...
                </>
              ) : (
                <>
                  <BarChart className="h-4 w-4" />
                  Analyze with AI
                </>
              )}
            </Button>
          )}
          {segmentData.activeTab === "icp" && (
            <Button 
              variant="secondary" 
              size="default"
              className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
              onClick={() => segmentData.openAIModal('icp')}
              disabled={segmentData.isAnalyzing || segmentData.isGeneratingICP || segmentData.isGeneratingTopics}
            >
              {segmentData.isGeneratingICP ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                  Generating...
                </>
              ) : (
                <>
                  <Users className="h-4 w-4" />
                  Generate with AI
                </>
              )}
            </Button>
          )}
          {segmentData.activeTab === "topics" && (
            <Button 
              variant="secondary" 
              size="default"
              className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
              onClick={() => segmentData.openAIModal('topics')}
              disabled={segmentData.isAnalyzing || segmentData.isGeneratingICP || segmentData.isGeneratingTopics}
            >
              {segmentData.isGeneratingTopics ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                  Getting Topics...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Get Topics with AI
                </>
              )}
            </Button>
          )}
        </>
      )}
      {isSegmentsPage && (
        currentSite ? (
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="default"
              className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
              onClick={handleBuildWithAI}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                  Processing...
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4" />
                  Build with AI
                </>
              )}
            </Button>
            <CreateSegmentDialog onCreateSegment={handleCreateSegment} />
          </div>
        ) : (
          <Button variant="outline" disabled>
            <PlusCircle className="mr-2 h-4 w-4" />
            Select a site
          </Button>
        )
      )}
      {isExperimentsPage && (
        currentSite ? (
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="default"
              className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
              onClick={handleBuildWithAI}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                  Processing...
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4" />
                  Build with AI
                </>
              )}
            </Button>
            <CreateExperimentDialog 
              segments={segments || []}
              campaigns={campaigns}
              onCreateExperiment={handleCreateExperiment}
            />
          </div>
        ) : (
          <Button variant="outline" disabled>
            <PlusCircle className="mr-2 h-4 w-4" />
            Select a site
          </Button>
        )
      )}
      {isRequirementsPage && (
        currentSite ? (
          <>
            <CreateRequirementDialog 
              segments={segments || []}
              campaigns={campaigns}
              onCreateRequirement={handleCreateRequirement}
              trigger={
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Requirement
                </Button>
              }
            />
          </>
        ) : (
          <Button variant="outline" disabled>
            <PlusCircle className="mr-2 h-4 w-4" />
            Select a site
          </Button>
        )
      )}
      {isLeadsPage && (
        currentSite ? (
          <>
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  const response = await fetch(`/api/leads/export?siteId=${currentSite.id}`, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  });
                  
                  if (!response.ok) throw new Error('Export failed');
                  
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } catch (error) {
                  console.error('Error exporting leads:', error);
                  toast.error('Failed to export leads');
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <CreateLeadDialog 
              segments={segments.length > 0 ? segments : propSegments || []}
              campaigns={campaigns}
              onCreateLead={handleCreateLead}
              trigger={
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Lead
                </Button>
              }
            />
          </>
        ) : (
          <Button variant="outline" disabled>
            <PlusCircle className="mr-2 h-4 w-4" />
            Select a site
          </Button>
        )
      )}
      {isAgentsPage && (
        currentSite ? (
          <></>
        ) : (
          <Button variant="outline" disabled>
            <PlusCircle className="mr-2 h-4 w-4" />
            Select a site
          </Button>
        )
      )}
      {isAssetsPage && (
        currentSite ? (
          <UploadAssetDialog onUploadAsset={handleCreateAsset} />
        ) : (
          <Button variant="outline" disabled>
            <PlusCircle className="mr-2 h-4 w-4" />
            Select a site
          </Button>
        )
      )}
      {isContentPage && (
        currentSite ? (
          <CreateContentDialog 
            segments={segments.length > 0 ? segments : propSegments || []}
            onSuccess={() => {
              // Use the content list's refresh function instead of reloading the page
              if (typeof window !== 'undefined' && (window as any).refreshContentList) {
                (window as any).refreshContentList();
              } else {
                // Fallback to page reload if the function isn't available
                window.location.reload();
              }
            }}
            trigger={
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Content
              </Button>
            }
          />
        ) : (
          <Button variant="outline" disabled>
            <PlusCircle className="mr-2 h-4 w-4" />
            Select a site
          </Button>
        )
      )}
      {isControlCenterPage && (
        currentSite ? (
          <CreateCampaignDialog
            segments={segments.length > 0 ? segments : propSegments || []}
            requirements={requirements}
            onCreateCampaign={handleCreateCampaign}
            trigger={
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                New Campaign
              </Button>
            }
          />
        ) : (
          <Button variant="outline" disabled>
            <PlusCircle className="mr-2 h-4 w-4" />
            Select a site
          </Button>
        )
      )}
      {isSalesPage && (
        currentSite ? (
          <>
            <Button 
              variant="outline"
              onClick={async () => {
                try {
                  const response = await fetch(`/api/sales/export?siteId=${currentSite.id}`, {
                    method: 'GET',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  });
                  
                  if (!response.ok) throw new Error('Export failed');
                  
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `sales-${new Date().toISOString().split('T')[0]}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } catch (error) {
                  console.error('Error exporting sales:', error);
                  toast.error('Failed to export sales');
                }
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button onClick={onCreateSale}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Sale
            </Button>
          </>
        ) : (
          <Button variant="outline" disabled>
            <PlusCircle className="mr-2 h-4 w-4" />
            Select a site
          </Button>
        )
      )}

      {/* AI Action Modal */}
      <AIActionModal
        isOpen={isAIModalOpen}
        setIsOpen={setIsAIModalOpen}
        title={AIModalConfig.title}
        description={AIModalConfig.description}
        actionLabel={AIModalConfig.actionLabel}
        onAction={AIModalConfig.action}
        creditsAvailable={10} // This would come from user's account data
        creditsRequired={3} // Building segments might cost more credits
        icon={<Cpu className="h-5 w-5 text-primary" />}
        estimatedTime={AIModalConfig.estimatedTime}
        refreshOnComplete={true} // Refresh the page when the action completes
      />
    </div>
  )
} 