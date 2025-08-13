import { createSegment } from "@/app/segments/actions"
import { createExperiment, type ExperimentFormValues } from "@/app/experiments/actions"
import { createAsset } from "@/app/assets/actions"
import { createRequirement } from "@/app/requirements/actions"
import { createLead, importLeads } from "@/app/leads/actions"
import { Lead } from "@/app/leads/types"
import { createCampaign } from "@/app/campaigns/actions/campaigns/create"
import { buildSegmentsWithAI, buildExperimentsWithAI, buildCampaignsWithAI, buildContentWithAI } from "@/app/services/ai-service"
import { Button } from "../ui/button"
import { CreateSegmentDialog } from "../create-segment-dialog"
import { CreateExperimentDialog } from "../create-experiment-dialog"
import { UploadAssetDialog } from "../upload-asset-dialog"
import { CreateRequirementDialog } from "../create-requirement-dialog"
import { CreateLeadDialog } from "../create-lead-dialog"
import { ImportLeadsDialog } from "../leads/import-leads-dialog"
import { CreateContentDialog } from "@/app/content/components"
import { CreateCampaignDialog } from "../create-campaign-dialog"
import { CreateTaskDialog } from "../create-task-dialog"
import { CalendarDateRangePicker } from "../ui/date-range-picker"
import { AIActionModal } from "@/app/components/ui/ai-action-modal"
import { useSite } from "@/app/context/SiteContext"
import { useRouter, usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useRobots } from "@/app/context/RobotsContext"
import { 
  BarChart, 
  PlusCircle, 
  FlaskConical, 
  Download, 
  Key,
  Users, 
  FileText,
  UploadCloud,
  PlayCircle,
  StopCircle,
  Search
} from "@/app/components/ui/icons"

import { subMonths, format } from "date-fns"
import { safeReload } from "../../utils/safe-reload"
import { useSearchParams } from "next/navigation"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { useBillingCheck } from "@/app/hooks/use-billing-check"
import { UpgradeToStartupButton } from "@/app/components/billing/upgrade-to-startup-button"


// Robot Start Button Component
function RobotStartButton({ currentSite }: { currentSite: any }) {
  const [isStartingRobot, setIsStartingRobot] = useState(false)
  const [isStoppingRobot, setIsStoppingRobot] = useState(false)
  const { getActiveRobotForActivity, refreshRobots, isLoading: isLoadingRobots } = useRobots()
  const { canStartRobot, hasStartupPlan, hasActiveCredits, creditsAvailable } = useBillingCheck()
  const searchParams = useSearchParams()
  
  // Get current tab from URL or default to free-agent
  const activeTab = searchParams.get('tab') || 'free-agent'
  const activeRobotInstance = getActiveRobotForActivity(activeTab)
  const activeTabRef = useRef(activeTab)

  // Map tab values to activity names
  const getActivityName = (tabValue: string): string => {
    const activityMap: Record<string, string> = {
      "free-agent": "Free Agent",
      "channel-market-fit": "Channel Market Fit",
      "engage": "Engage in Social Networks", 
      "seo": "SEO",
      "publish-content": "Publish Content",
      "publish-ads": "Publish Ads",
      "ux-analysis": "UX Analysis",
      "build-requirements": "Build Requirements"
    }
    return activityMap[tabValue] || tabValue
  }

  // Note: Robot checking now handled by RobotsContext

  // Update activeTab ref when activeTab changes
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // Note: Robot state monitoring now handled by RobotsContext

  // Note: Real-time monitoring now handled by RobotsContext
  // This component just reacts to context changes

  // Function to start robot
  const handleStartRobot = async () => {
    if (!currentSite) {
      toast.error("No site selected")
      return
    }

    // Check billing requirements
    if (!canStartRobot) {
      if (!hasStartupPlan && !hasActiveCredits) {
        toast.error("Robot feature requires Startup plan or active credits")
      } else if (!hasActiveCredits) {
        toast.error("No credits available to start robot")
      }
      return
    }

    setIsStartingRobot(true)
    
    try {
      const { apiClient } = await import('@/app/services/api-client-service')
      
      const response = await apiClient.post('/api/workflow/startRobot', {
        site_id: currentSite.id,
        user_id: currentSite.user_id,
        activity: getActivityName(activeTab)
      })
      
      if (response.success) {
        toast.success("Robot workflow initiated - setting up browser...")
        
        // Small delay to allow database to update, then refresh
        setTimeout(async () => {
          await refreshRobots()
        }, 1000)
        
        // Check if robot is already running after the API call
        if (activeRobotInstance && ['running', 'active'].includes(activeRobotInstance.status)) {
          console.log('Robot is already running, no need to poll')
          setIsStartingRobot(false)
          return
        }
        
        // Setup fallback polling in case real-time updates fail
        let pollAttempts = 0
        const maxPollAttempts = 20 // 20 attempts * 2 seconds = 40 seconds
        let pollingActive = true
        
        const pollForStartedInstance = async () => {
          if (!pollingActive) return
          
          pollAttempts++
          console.log(`Polling for started robot instance (attempt ${pollAttempts}/${maxPollAttempts})`)
          
          try {
            await refreshRobots()
            
            // Check if robot is now running - if so, stop polling and clear loading state
            const activityName = getActivityName(activeTab)
            const supabase = createClient()
            
            const { data: currentInstance, error: instanceError } = await supabase
              .from('remote_instances')
              .select('id, status, name')
              .eq('site_id', currentSite.id)
              .eq('name', activityName)
              .neq('status', 'stopped')
              .neq('status', 'error')
              .limit(1)
            
            if (instanceError) {
              console.error('Error checking robot status:', instanceError)
              // Continue polling unless max attempts reached
            } else if (currentInstance && currentInstance.length > 0) {
              const instance = currentInstance[0]
              if (['running', 'active'].includes(instance.status)) {
                console.log('✅ Robot is now running! Stopping polling.')
                pollingActive = false
                setIsStartingRobot(false)
                
                // Emit custom event to notify robots page to refresh
                window.dispatchEvent(new CustomEvent('robotStarted', { 
                  detail: { instanceId: instance.id, instance }
                }))
                
                return
              } else if (['failed', 'error'].includes(instance.status)) {
                console.log('❌ Robot failed to start. Stopping polling.')
                pollingActive = false
                setIsStartingRobot(false)
                toast.error("Robot failed to start - please try again")
                return
              }
            }
            
            if (pollAttempts < maxPollAttempts && pollingActive) {
              setTimeout(pollForStartedInstance, 2000) // Poll every 2 seconds
            } else if (pollingActive) {
              console.log('Max polling attempts reached for robot start')
              pollingActive = false
              setIsStartingRobot(false)
              toast.warning("Robot startup is taking longer than expected. Please check the robots page.")
              // Final refresh attempt
              setTimeout(() => {
                console.log('Final refresh attempt after robot start')
                refreshRobots()
              }, 3000)
            }
          } catch (pollError) {
            console.error('Error during robot polling:', pollError)
            if (pollAttempts >= maxPollAttempts || !pollingActive) {
              pollingActive = false
              setIsStartingRobot(false)
              toast.error("Unable to verify robot status - please check the robots page")
            } else if (pollingActive) {
              // Continue polling even if there's an error, but with longer delay
              setTimeout(pollForStartedInstance, 3000)
            }
          }
        }
        
        // Start polling after 3 seconds (allow real-time to work first)
        setTimeout(pollForStartedInstance, 3000)
        
      } else {
        // Handle API response errors
        const errorMessage = response.error?.message || 'Unknown error occurred'
        console.error('API Error starting robot:', response.error || response)
        
        // Log additional debugging information if available
        if (response.error?.details) {
          console.error('Error details:', response.error.details)
          
          // If it's a configuration issue, provide more specific guidance
          if (response.error.details.suggestion) {
            console.error('Suggestion:', response.error.details.suggestion)
          }
        }
        
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error starting robot:', error)
      
      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to start robot"
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage = "Network error - please check your connection and try again"
        } else if (error.message.includes('timeout')) {
          errorMessage = "Request timed out - please try again"
        } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
          errorMessage = "Permission denied - please refresh the page and try again"
        } else if (error.message && error.message !== 'Unknown error') {
          errorMessage = error.message
        }
      }
      
      toast.error(errorMessage)
      setIsStartingRobot(false)
    }
    // Note: Don't set setIsStartingRobot(false) here in finally block
    // It will be set when polling detects the robot is running or fails
  }

  // Function to stop robot
  const handleStopRobot = async () => {
    if (!activeRobotInstance) {
      toast.error("No active robot to stop")
      return
    }

    setIsStoppingRobot(true)
    
    try {
      const { apiClient } = await import('@/app/services/api-client-service')
      
      const response = await apiClient.post('/api/robots/instance/stop', {
        instance_id: activeRobotInstance.id
      })
      
      if (response.success) {
        toast.success("Robot stopped successfully")
        
        console.log('✅ Robot stopped successfully')
        
        // Emit custom event to notify robots page to refresh
        window.dispatchEvent(new CustomEvent('robotStopped', { 
          detail: { instanceId: activeRobotInstance.id }
        }))
        
        // Refresh to double-check status
        await refreshRobots()
        
        // Setup fallback refresh in case real-time updates fail
        let refreshAttempts = 0
        const maxRefreshAttempts = 5 // Reduced to 5 attempts since we already cleared the state
        let refreshActive = true
        
        const refreshStoppedStatus = async () => {
          if (!refreshActive) return
          
          refreshAttempts++
          console.log(`Refreshing stopped robot status (attempt ${refreshAttempts}/${maxRefreshAttempts})`)
          
          await refreshRobots()
          
          // Check if there's still an active robot - if not, stop refreshing
          const activityName = getActivityName(activeTab)
          const supabase = createClient()
          
          const { data: currentInstance } = await supabase
            .from('remote_instances')
            .select('id, status, name')
            .eq('site_id', currentSite.id)
            .eq('name', activityName)
            .neq('status', 'stopped')
            .neq('status', 'error')
            .limit(1)
          
          if (!currentInstance || currentInstance.length === 0) {
            console.log('✅ Confirmed no active robots, stopping refresh')
            refreshActive = false
            return
          }
          
          if (refreshAttempts < maxRefreshAttempts && refreshActive) {
            setTimeout(refreshStoppedStatus, 2000) // Refresh every 2 seconds
          } else if (refreshActive) {
            console.log('Max refresh attempts reached for robot stop')
            refreshActive = false
            // Final refresh attempt
            setTimeout(() => {
              console.log('Final refresh attempt after robot stop')
              refreshRobots()
            }, 3000)
          }
        }
        
        // Start refreshing after 2 seconds (allow real-time to work first)
        setTimeout(refreshStoppedStatus, 2000)
        
      } else {
        // Handle API response errors
        const errorMessage = response.error?.message || 'Failed to stop robot'
        console.error('API Error stopping robot:', response.error || response)
        
        // Log additional debugging information if available
        if (response.error?.details) {
          console.error('Error details:', response.error.details)
          
          // If it's a configuration issue, provide more specific guidance
          if (response.error.details.suggestion) {
            console.error('Suggestion:', response.error.details.suggestion)
          }
        }
        
        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('Error stopping robot:', error)
      
      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to stop robot"
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage = "Network error - please check your connection and try again"
        } else if (error.message.includes('timeout')) {
          errorMessage = "Request timed out - please try again"
        } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
          errorMessage = "Permission denied - please refresh the page and try again"
        } else if (error.message.includes('not found')) {
          errorMessage = "Robot instance not found - it may have already stopped"
        } else if (error.message && error.message !== 'Unknown error') {
          errorMessage = error.message
        }
      }
      
      toast.error(errorMessage)
    } finally {
      setIsStoppingRobot(false)
    }
  }

  // Show loading state if we're checking for robots
  if (isLoadingRobots) {
    return (
      <Button 
        size="default"
        className="flex items-center gap-2 bg-gray-400 transition-all duration-200"
        disabled={true}
      >
        <LoadingSkeleton variant="button" size="sm" className="text-white" />
        Loading...
      </Button>
    )
  }

  // If there's an active robot instance, show stop button and save auth button
  if (activeRobotInstance) {
    const handleSaveAuthSession = async () => {
      if (!activeRobotInstance) {
        toast.error("No active robot instance to save auth session")
        return
      }

      try {
        const { apiClient } = await import('@/app/services/api-client-service')
        
        const response = await apiClient.post('/api/robots/auth', {
          site_id: currentSite.id,
          remote_instance_id: activeRobotInstance.id
        })
        
        if (response.success) {
          toast.success('Auth session saved successfully')
        } else {
          // Handle API response errors
          const errorMessage = response.error?.message || 'Failed to save auth session'
          console.error('API Error saving auth session:', response.error || response)
          
          // Log additional debugging information if available
          if (response.error?.details) {
            console.error('Error details:', response.error.details)
            
            // If it's a configuration issue, provide more specific guidance
            if (response.error.details.suggestion) {
              console.error('Suggestion:', response.error.details.suggestion)
            }
          }
          
          throw new Error(errorMessage)
        }
      } catch (error) {
        console.error('Error saving auth session:', error)
        
        // Provide more specific error messages based on the error type
        let errorMessage = "Failed to save auth session"
        
        if (error instanceof Error) {
          if (error.message.includes('fetch')) {
            errorMessage = "Network error - please check your connection and try again"
          } else if (error.message.includes('timeout')) {
            errorMessage = "Request timed out - please try again"
          } else if (error.message.includes('permission') || error.message.includes('unauthorized')) {
            errorMessage = "Permission denied - please refresh the page and try again"
          } else if (error.message.includes('not found')) {
            errorMessage = "Robot instance not found - please try refreshing the page"
          } else if (error.message && error.message !== 'Unknown error') {
            errorMessage = error.message
          }
        }
        
        toast.error(errorMessage)
      }
    }

    return (
      <div className="flex items-center gap-2">
        <Button 
          variant="secondary" 
          size="default"
          className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
          onClick={handleSaveAuthSession}
        >
          <Key className="h-4 w-4" />
          Save Auth Session
        </Button>
        <Button 
          size="default"
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 transition-all duration-200"
          onClick={handleStopRobot}
          disabled={isStoppingRobot}
        >
          {isStoppingRobot ? (
            <>
              <LoadingSkeleton variant="button" size="sm" className="text-white" />
              Stopping...
            </>
          ) : (
            <>
              <StopCircle className="mr-2 h-4 w-4" />
              Stop Robot
            </>
          )}
        </Button>
      </div>
    )
  }

  // Check if billing requirements are met
  if (!canStartRobot) {
    return (
      <div className="flex items-center gap-2">
        <UpgradeToStartupButton
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 transition-all duration-200"
        />
        {hasActiveCredits && (
          <div className="text-xs text-muted-foreground">
            {creditsAvailable} credits available
          </div>
        )}
      </div>
    )
  }

  // Default state: show start button
  return (
    <Button 
      size="default"
      className="flex items-center gap-2 bg-primary hover:bg-primary/90 transition-all duration-200"
      onClick={handleStartRobot}
      disabled={isStartingRobot}
    >
      {isStartingRobot ? (
        <>
          <LoadingSkeleton variant="button" size="sm" className="text-white" />
          Starting Robot...
        </>
      ) : (
        <>
          <PlayCircle className="mr-2 h-4 w-4" />
          Start Robot
        </>
      )}
    </Button>
  )
}

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
  isCampaignsPage: boolean
  isSalesPage: boolean
  isRobotsPage: boolean
  isExperimentDetailPage?: boolean
  dashboardActiveTab?: string
  segmentData: {
    id: string
    activeTab: string
    isAnalyzing: boolean
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
  isCampaignsPage,
  isSalesPage,
  isRobotsPage,
  isExperimentDetailPage = false,
  dashboardActiveTab,
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
  
  // Check if we're on dashboard onboarding tab
  const [currentDashboardTab, setCurrentDashboardTab] = useState<string | null>(null)
  
  useEffect(() => {
    if (isDashboardPage && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      // If no tab parameter, we need to check if user is in onboarding mode
      const finalTab = tab || 'overview'
      console.log('TopBarActions: Current dashboard tab:', finalTab, 'from URL:', tab)
      setCurrentDashboardTab(finalTab)
      
      // Listen for popstate events (back/forward navigation)
      const handlePopState = () => {
        const newParams = new URLSearchParams(window.location.search)
        const newTab = newParams.get('tab') || 'overview'
        console.log('TopBarActions: Tab changed to:', newTab)
        setCurrentDashboardTab(newTab)
      }
      
      // Listen for custom events from dashboard tab changes
      const handleTabChange = () => {
        const newParams = new URLSearchParams(window.location.search)
        const newTab = newParams.get('tab') || 'overview'
        console.log('TopBarActions: Custom tab change to:', newTab)
        setCurrentDashboardTab(newTab)
      }
      
      window.addEventListener('popstate', handlePopState)
      window.addEventListener('dashboard:tabchange', handleTabChange)
      return () => {
        window.removeEventListener('popstate', handlePopState)
        window.removeEventListener('dashboard:tabchange', handleTabChange)
      }
    }
  }, [isDashboardPage])
  
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
      safeReload(false, 'New segment created')
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
      safeReload(false, 'New experiment created');
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
      safeReload(false, 'New requirement created')
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
    } else if (isCampaignsPage) {
      setAIModalConfig({
        title: "Building Campaigns with AI",
        description: "Our AI will analyze your site data and automatically create optimized marketing campaigns tailored to your business objectives. This helps you generate effective campaign strategies that align with your target audience and goals.",
        actionLabel: "Build Campaigns",
        estimatedTime: 120, // 2 minutes
        action: handleBuildCampaignsWithAI
      });
    } else if (isContentPage) {
      setAIModalConfig({
        title: "Building Content with AI",
        description: "Our AI will analyze your site data and automatically create high-quality content pieces optimized for your target audience. This helps you generate engaging content that resonates with your users and supports your marketing objectives.",
        actionLabel: "Build Content",
        estimatedTime: 120, // 2 minutes
        action: handleBuildContentWithAI
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

  // Function to handle the AI campaign building process
  const handleBuildCampaignsWithAI = async (): Promise<any> => {
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

      console.log("Starting AI campaign building with params:", {
        user_id: user.id,
        site_id: currentSite.id,
        url: currentSite.url,
        campaignCount: 3
      });

      // Call the AI service to build campaigns
      const result = await buildCampaignsWithAI({
        user_id: user.id,
        site_id: currentSite.id,
        url: currentSite.url,
        campaignCount: 3
      });

      console.log("AI campaign building result:", result);

      if (result.success) {
        toast.success("Campaigns created successfully!");
        // For campaigns page, manually refresh data instead of full page reload
        if (isCampaignsPage) {
          setTimeout(() => {
            // Trigger a refresh of campaigns data without full page reload
            safeReload(false, 'AI campaigns created');
          }, 1000);
        }
        return result;
      } else {
        // Instead of throwing an error, return the complete result
        // so the modal can display the error and HTML response if it exists
        console.error("Error building campaigns with AI:", result.error);
        if (result.rawResponse) {
          console.error("Raw response from server:", result.rawResponse.substring(0, 200) + "...");
        }
        if (result.details) {
          console.error("Error details:", result.details);
        }
        return result;
      }
    } catch (error) {
      console.error("Unexpected error in handleBuildCampaignsWithAI:", error);
      
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

  // Function to handle the AI content building process
  const handleBuildContentWithAI = async (): Promise<any> => {
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

      console.log("Starting AI content building with params:", {
        user_id: user.id,
        site_id: currentSite.id,
        url: currentSite.url,
        contentCount: 3
      });

      // Call the AI service to build content
      const result = await buildContentWithAI({
        user_id: user.id,
        site_id: currentSite.id,
        url: currentSite.url,
        contentCount: 3
      });

      console.log("AI content building result:", result);

      if (result.success) {
        toast.success("Content created successfully!");
        // For content page, manually refresh data instead of full page reload
        if (isContentPage) {
          setTimeout(() => {
            // Trigger a refresh of content data without full page reload
            safeReload(false, 'AI content created');
          }, 1000);
        }
        return result;
      } else {
        // Instead of throwing an error, return the complete result
        // so the modal can display the error and HTML response if it exists
        console.error("Error building content with AI:", result.error);
        if (result.rawResponse) {
          console.error("Raw response from server:", result.rawResponse.substring(0, 200) + "...");
        }
        if (result.details) {
          console.error("Error details:", result.details);
        }
        return result;
      }
    } catch (error) {
      console.error("Unexpected error in handleBuildContentWithAI:", error);
      
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
      safeReload(false, 'New asset created')
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
      safeReload(false, 'New lead created')
      return { lead: result.lead }
    } catch (error) {
      console.error("Error creating lead:", error)
      return { error: error instanceof Error ? error.message : "Error inesperado" }
    }
  }

  const handleImportLeads = async (leads: Partial<Lead>[]) => {
    if (!currentSite?.id) {
      return { success: false, count: 0, errors: ['No site selected'] }
    }

    try {
      const result = await importLeads(leads, currentSite.id)
      
      if (result.success) {
        // Recargar la página para mostrar los nuevos leads
        safeReload(false, 'Leads imported successfully')
      }
      
      return result
    } catch (error) {
      console.error('Error importing leads:', error)
      return { 
        success: false, 
        count: 0, 
        errors: ['Failed to import leads'] 
      }
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
      safeReload(false, 'New campaign created');
      
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
      {isControlCenterPage && currentSite ? (
        <CreateTaskDialog />
      ) : null}
      {currentSite ? (
        <>
          {isDashboardPage && (
            (() => {
              if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search)
                const tab = params.get('tab')
                // Show export button only if explicitly NOT on onboarding tab
                return tab !== 'onboarding'
              }
              return true // Default to showing it if we can't determine
            })()
          ) && (
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
          )}
        </>
      ) : null}
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
              <LoadingSkeleton variant="button" size="sm" />
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
          {(segmentData.activeTab === "analysis" || segmentData.activeTab === "icp") && (
            <Button 
              variant="secondary" 
              size="default"
              className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
              onClick={() => segmentData.openAIModal('analysis')}
              disabled={segmentData.isAnalyzing}
            >
              {segmentData.isAnalyzing ? (
                <>
                  <LoadingSkeleton variant="button" size="sm" />
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
          {segmentData.activeTab === "topics" && (
            <Button 
              variant="secondary" 
              size="default"
              className="flex items-center gap-2 hover:bg-primary/10 transition-all duration-200"
              onClick={() => segmentData.openAIModal('topics')}
              disabled={segmentData.isGeneratingTopics}
            >
              {segmentData.isGeneratingTopics ? (
                <>
                  <LoadingSkeleton variant="button" size="sm" />
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
                  <LoadingSkeleton variant="button" size="sm" />
                  Processing...
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4" />
                  Build with AI
                </>
              )}
            </Button>
            <CreateSegmentDialog 
              onCreateSegment={handleCreateSegment}
              trigger={
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Segment
                </Button>
              }
            />
          </div>
        ) : null
      )}
      {isExperimentsPage && (
        currentSite ? (
          <div className="flex items-center gap-2">
            <CreateExperimentDialog 
              segments={segments || []}
              campaigns={campaigns}
              onCreateExperiment={handleCreateExperiment}
            />
          </div>
        ) : null
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
        ) : null
      )}
      {isLeadsPage && (
        currentSite ? (
          <>
            <ImportLeadsDialog 
              segments={segments.length > 0 ? segments : propSegments || []}
              onImportLeads={handleImportLeads}
              trigger={
                <Button variant="outline">
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Import
                </Button>
              }
            />
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
        ) : null
      )}
      {isAgentsPage && (
        currentSite ? (
          <></>
        ) : null
      )}
      {isAssetsPage && (
        currentSite ? (
          <UploadAssetDialog onUploadAsset={handleCreateAsset} />
        ) : null
      )}
      {isContentPage && (
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
                  <LoadingSkeleton variant="button" size="sm" />
                  Processing...
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4" />
                  Build with AI
                </>
              )}
            </Button>

            <CreateContentDialog 
              segments={segments.length > 0 ? segments : propSegments || []}
              onSuccess={() => {
                // Use the content list's refresh function instead of reloading the page
                if (typeof window !== 'undefined' && (window as any).refreshContentList) {
                  (window as any).refreshContentList();
                } else {
                  // Fallback to page reload if the function isn't available
                  safeReload(false, 'New content created');
                }
              }}
              trigger={
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Content
                </Button>
              }
            />
          </div>
        ) : null
      )}
      {isCampaignsPage && (
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
                  <LoadingSkeleton variant="button" size="sm" />
                  Processing...
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4" />
                  Build with AI
                </>
              )}
            </Button>
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
          </div>
        ) : null
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
        ) : null
      )}
      {isRobotsPage && (
        currentSite ? (
          <RobotStartButton currentSite={currentSite} />
        ) : null
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
        refreshOnComplete={isSegmentsPage || isExperimentsPage} // Only refresh for segments and experiments
      />
    </div>
  )
} 