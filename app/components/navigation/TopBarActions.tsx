import { createSegment } from "@/app/segments/actions";
import {
  createExperiment,
  type ExperimentFormValues,
} from "@/app/experiments/actions";
import { createAsset } from "@/app/assets/actions";
import { createRequirement } from "@/app/requirements/actions";
import { createLead, importLeads } from "@/app/leads/actions";
import { createDeal, addDealContact } from "@/app/deals/actions";
import { Lead } from "@/app/leads/types";
import { createCampaign } from "@/app/campaigns/actions/campaigns/create";
import { Button } from "../ui/button";
import { CreateSegmentDialog } from "../create-segment-dialog";
import { CreateExperimentDialog } from "../create-experiment-dialog";
import { UploadAssetDialog } from "../upload-asset-dialog";
import { CreateRequirementDialog } from "../create-requirement-dialog";
import { CreateLeadDialog } from "../create-lead-dialog";
import { ImportLeadsDialog } from "../leads/import-leads-dialog";
import { CreateContentDialog } from "@/app/content/components";
import { CreateCampaignDialog } from "../create-campaign-dialog";
import { CreateTaskDialog } from "../create-task-dialog";
import { CreateDealDialog } from "@/app/deals/components/CreateDealDialog";
import { CreateQuotationDialog } from "@/app/quotations/components/CreateQuotationDialog";
import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useRobots } from "@/app/context/RobotsContext";
import { WorkflowRunButton } from "@/app/components/workflows/workflow-run-button";
import {
  PlusCircle,
  Download,
  Key,
  Users,
  FileText,
  BarChart,
  UploadCloud,
  PlayCircle,
  StopCircle,
  Search,
  Shield,
  BookOpen,
  LogOut,
  Github,
  Bot,
  Globe,
  Folder,
  Eye,
  Edit,
  Ban,
  ShoppingCart,
  Settings,
  Ticket,
  Repeat,
  ModifierGroups,
  Save,
} from "@/app/components/ui/icons";

import { subMonths, format, startOfDay, endOfDay } from "date-fns";
import { safeReload } from "../../utils/safe-reload";
import { useSearchParams } from "next/navigation";
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton";
import { AuthenticateSessionsModal } from "./AuthenticateSessionsModal";
import { useRequirementStatus } from "@/app/components/simple-messages-view/hooks/useRequirementStatus";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";

// Robot Start Button Component
function RobotStartButton({
  currentSite,
  viewMode,
}: {
  currentSite: any;
  viewMode?: string;
}) {
  const { t } = useLocalization();
  const [isStartingRobot, setIsStartingRobot] = useState(false);
  const [isStoppingRobot, setIsStoppingRobot] = useState(false);
  const [isAuthenticateModalOpen, setIsAuthenticateModalOpen] = useState(false);
  const {
    getAllInstances,
    getInstanceById,
    refreshRobots,
    isLoading: isLoadingRobots,
    refreshCount,
  } = useRobots();
  const searchParams = useSearchParams();

  // Get all instances and find the appropriate one to display
  const allInstances = getAllInstances();
  const selectedInstanceParam = searchParams.get("instance");

  // Determine the active robot instance with improved logic:
  // 1. If URL has instance param, try to use that instance
  // 2. Otherwise, find the first paused/pending instance from all instances
  const activeRobotInstance = useMemo(() => {
    // Don't calculate if data is still loading - wait for complete data
    if (isLoadingRobots) {
      return null;
    }

    // If URL param exists, try to get that instance first
    if (selectedInstanceParam) {
      if (selectedInstanceParam === "new") {
        return null;
      }
      const urlInstance = getInstanceById(selectedInstanceParam);
      if (urlInstance) {
        return urlInstance;
      }
    }

    // If no URL param or URL instance not found, use the most recently updated instance
    // This matches the fallback logic in robots/page.tsx
    if (allInstances.length > 0) {
      const sortedInstances = [...allInstances].sort((a, b) => {
        const playStatuses = [
          "running",
          "active",
          "starting",
          "pending",
          "initializing",
        ];
        const aIsPlay = playStatuses.includes((a as any).status) ? 1 : 0;
        const bIsPlay = playStatuses.includes((b as any).status) ? 1 : 0;

        if (aIsPlay !== bIsPlay) {
          return bIsPlay - aIsPlay;
        }

        const aTime = new Date(
          (a as any).updated_at || (a as any).created_at || 0,
        ).getTime();
        const bTime = new Date(
          (b as any).updated_at || (b as any).created_at || 0,
        ).getTime();
        return bTime - aTime;
      });
      return sortedInstances[0];
    }

    return null;
  }, [
    selectedInstanceParam,
    allInstances,
    getInstanceById,
    isLoadingRobots,
    refreshCount,
  ]);

  const { requirementStatuses } = useRequirementStatus(activeRobotInstance);

  const [showSourceCodePreview, setShowSourceCodePreview] = useState(false);
  useEffect(() => {
    const handleToggle = () => setShowSourceCodePreview((prev) => !prev);
    window.addEventListener("robot:toggle-source-code", handleToggle);
    return () =>
      window.removeEventListener("robot:toggle-source-code", handleToggle);
  }, []);

  const latestPreviewUrl = useMemo(() => {
    if (!requirementStatuses || requirementStatuses.length === 0) return null;

    // Find the most recent requirement_status that has a preview
    for (let i = requirementStatuses.length - 1; i >= 0; i--) {
      const status = requirementStatuses[i];
      if (status.preview_url) {
        return status.preview_url;
      }
      // Fallback: If no preview_url but repo_url points to a zip file in Supabase
      if (
        !status.preview_url &&
        status.repo_url &&
        (status.repo_url.endsWith(".zip") ||
          status.repo_url.includes(".zip?") ||
          status.repo_url.endsWith(".tar.gz") ||
          status.repo_url.includes(".tar.gz?") ||
          status.repo_url.endsWith(".tar") ||
          status.repo_url.includes(".tar?"))
      ) {
        return status.repo_url;
      }
      // Fallback: Check source_code if it points to a zip
      if (
        !status.preview_url &&
        status.source_code &&
        (status.source_code.endsWith(".zip") ||
          status.source_code.includes(".zip?") ||
          status.source_code.endsWith(".tar.gz") ||
          status.source_code.includes(".tar.gz?") ||
          status.source_code.endsWith(".tar") ||
          status.source_code.includes(".tar?"))
      ) {
        return status.source_code;
      }
    }

    return null;
  }, [requirementStatuses]);

  const latestSourceCodeUrl = useMemo(() => {
    if (!requirementStatuses || requirementStatuses.length === 0) return null;

    // Find the most recent requirement_status that has source_code
    for (let i = requirementStatuses.length - 1; i >= 0; i--) {
      const status = requirementStatuses[i];
      if (status.source_code) {
        return status.source_code;
      }
      // Fallback: If no source_code but repo_url points to a zip file in Supabase
      if (
        !status.source_code &&
        status.repo_url &&
        (status.repo_url.endsWith(".zip") ||
          status.repo_url.includes(".zip?") ||
          status.repo_url.endsWith(".tar.gz") ||
          status.repo_url.includes(".tar.gz?") ||
          status.repo_url.endsWith(".tar") ||
          status.repo_url.includes(".tar?"))
      ) {
        return status.repo_url;
      }
      // Fallback: Check preview_url if it points to a zip
      if (
        !status.source_code &&
        status.preview_url &&
        (status.preview_url.endsWith(".zip") ||
          status.preview_url.includes(".zip?") ||
          status.preview_url.endsWith(".tar.gz") ||
          status.preview_url.includes(".tar.gz?") ||
          status.preview_url.endsWith(".tar") ||
          status.preview_url.includes(".tar?"))
      ) {
        return status.preview_url;
      }
    }

    return null;
  }, [requirementStatuses]);

  const selectedInstanceId =
    activeRobotInstance?.id || selectedInstanceParam || "new";
  const activeTabRef = useRef(selectedInstanceId);

  // Map tab values to activity names (fallback for create-from-new)
  const getActivityName = (tabValue: string): string => {
    const activityMap: Record<string, string> = {
      ask: "Ask",
      "channel-market-fit": "Channel Market Fit",
      engage: "Engage in Social Networks",
      seo: "SEO",
      "publish-content": "Publish Content",
      "publish-ads": "Publish Ads",
      "ux-analysis": "UX Analysis",
      "build-requirements": "Build Requirements",
      "execute-plan": "Execute Plan",
      "deep-research": "Deep Research",
    };
    return activityMap[tabValue] || tabValue;
  };

  // Note: Robot checking now handled by RobotsContext

  // Update ref when selected instance changes
  useEffect(() => {
    activeTabRef.current = selectedInstanceId;
  }, [selectedInstanceId]);

  // Note: Robot state monitoring now handled by RobotsContext

  // Note: Real-time monitoring now handled by RobotsContext
  // This component just reacts to context changes

  // Function to start robot (used only for New Makina)
  const handleStartRobot = async () => {
    if (!currentSite) {
      toast.error("No site selected");
      return;
    }

    setIsStartingRobot(true);

    try {
      const { apiClient } = await import("@/app/services/api-client-service");

      const response = await apiClient.post("/api/workflow/startRobot", {
        site_id: currentSite.id,
        user_id: currentSite.user_id,
        activity: getActivityName("execute-plan"),
      });

      if (response.success) {
        toast.success("Robot workflow initiated - setting up browser...");

        // Also resume any paused plans for this instance
        if (activeRobotInstance?.id) {
          try {
            const supabase = createClient();
            const { data: plans } = await supabase
              .from("instance_plans")
              .select("id")
              .eq("instance_id", activeRobotInstance.id)
              .eq("status", "paused");

            if (plans && plans.length > 0) {
              await supabase
                .from("instance_plans")
                .update({
                  status: "in_progress",
                  updated_at: new Date().toISOString(),
                })
                .in(
                  "id",
                  plans.map((p) => p.id),
                );
            }
          } catch (err) {
            console.error("Error resuming plans on robot start:", err);
          }
        }

        // Small delay to allow database to update, then refresh
        setTimeout(async () => {
          await refreshRobots();
        }, 1000);

        // Check if robot is already running after the API call
        if (
          activeRobotInstance &&
          ["running", "active"].includes(activeRobotInstance.status)
        ) {
          setIsStartingRobot(false);
          return;
        }

        // Setup fallback polling in case real-time updates fail
        let pollAttempts = 0;
        const maxPollAttempts = 20; // 20 attempts * 2 seconds = 40 seconds
        let pollingActive = true;

        const pollForStartedInstance = async () => {
          if (!pollingActive) return;

          pollAttempts++;

          try {
            await refreshRobots();

            // Check if robot is now running - if so, stop polling and clear loading state
            const activityName = getActivityName("execute-plan");
            const supabase = createClient();

            const { data: currentInstance, error: instanceError } =
              await supabase
                .from("remote_instances")
                .select("id, status, name")
                .eq("site_id", currentSite.id)
                .eq("name", activityName)
                .neq("status", "error")
                .limit(1);

            if (instanceError) {
              console.error("Error checking robot status:", instanceError);
              // Continue polling unless max attempts reached
            } else if (currentInstance && currentInstance.length > 0) {
              const instance = currentInstance[0];
              if (["running", "active"].includes(instance.status)) {
                pollingActive = false;
                setIsStartingRobot(false);

                // Emit custom event to notify robots page to refresh
                window.dispatchEvent(
                  new CustomEvent("robotStarted", {
                    detail: { instanceId: instance.id, instance },
                  }),
                );

                return;
              } else if (["failed", "error"].includes(instance.status)) {
                pollingActive = false;
                setIsStartingRobot(false);
                toast.error("Robot failed to start - please try again");
                return;
              }
            }

            if (pollAttempts < maxPollAttempts && pollingActive) {
              setTimeout(pollForStartedInstance, 2000); // Poll every 2 seconds
            } else if (pollingActive) {
              pollingActive = false;
              setIsStartingRobot(false);
              toast.warning(
                "Robot startup is taking longer than expected. Please check the robots page.",
              );
              // Final refresh attempt
              setTimeout(() => {
                refreshRobots();
              }, 3000);
            }
          } catch (pollError) {
            console.error("Error during robot polling:", pollError);
            if (pollAttempts >= maxPollAttempts || !pollingActive) {
              pollingActive = false;
              setIsStartingRobot(false);
              toast.error(
                "Unable to verify robot status - please check the robots page",
              );
            } else if (pollingActive) {
              // Continue polling even if there's an error, but with longer delay
              setTimeout(pollForStartedInstance, 3000);
            }
          }
        };

        // Start polling after 3 seconds (allow real-time to work first)
        setTimeout(pollForStartedInstance, 3000);
      } else {
        // Handle API response errors
        const errorMessage =
          response.error?.message || "Unknown error occurred";
        console.error("API Error starting robot:", response.error || response);

        // Log additional debugging information if available
        if (response.error?.details) {
          console.error("Error details:", response.error.details);

          // If it's a configuration issue, provide more specific guidance
          if (response.error.details.suggestion) {
            console.error("Suggestion:", response.error.details.suggestion);
          }
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Error starting robot:", error);

      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to start robot";

      if (error instanceof Error) {
        if (error.message.includes("fetch")) {
          errorMessage =
            "Network error - please check your connection and try again";
        } else if (error.message.includes("timeout")) {
          errorMessage = "Request timed out - please try again";
        } else if (
          error.message.includes("permission") ||
          error.message.includes("unauthorized")
        ) {
          errorMessage =
            "Permission denied - please refresh the page and try again";
        } else if (error.message && error.message !== "Unknown error") {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
      setIsStartingRobot(false);
    }
    // Note: Don't set setIsStartingRobot(false) here in finally block
    // It will be set when polling detects the robot is running or fails
  };

  // Function to stop robot
  const handleStopRobot = async () => {
    if (!activeRobotInstance) {
      toast.error("No active robot to stop");
      return;
    }

    setIsStoppingRobot(true);

    try {
      const { apiClient } = await import("@/app/services/api-client-service");

      const response = await apiClient.post("/api/robots/instance/stop", {
        instance_id: activeRobotInstance.id,
      });

      if (response.success) {
        toast.success("Robot stopped successfully");

        // Also pause any active plans for this instance
        try {
          const supabase = createClient();
          const { data: plans } = await supabase
            .from("instance_plans")
            .select("id")
            .eq("instance_id", activeRobotInstance.id)
            .in("status", ["in_progress", "pending"]);

          if (plans && plans.length > 0) {
            await supabase
              .from("instance_plans")
              .update({
                status: "paused",
                updated_at: new Date().toISOString(),
              })
              .in(
                "id",
                plans.map((p) => p.id),
              );
          }
        } catch (err) {
          console.error("Error pausing plans on robot stop:", err);
        }

        // Emit custom event to notify robots page
        window.dispatchEvent(
          new CustomEvent("robotStopped", {
            detail: { instanceId: activeRobotInstance.id },
          }),
        );

        // REMOVED: refreshRobots() and polling loop
        // Real-time subscription will handle the update automatically
      } else {
        // Handle API response errors
        const errorMessage = response.error?.message || "Failed to stop robot";
        console.error("API Error stopping robot:", response.error || response);

        // Log additional debugging information if available
        if (response.error?.details) {
          console.error("Error details:", response.error.details);

          // If it's a configuration issue, provide more specific guidance
          if (response.error.details.suggestion) {
            console.error("Suggestion:", response.error.details.suggestion);
          }
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Error stopping robot:", error);

      // Provide more specific error messages based on the error type
      let errorMessage = "Failed to stop robot";

      if (error instanceof Error) {
        if (error.message.includes("fetch")) {
          errorMessage =
            "Network error - please check your connection and try again";
        } else if (error.message.includes("timeout")) {
          errorMessage = "Request timed out - please try again";
        } else if (
          error.message.includes("permission") ||
          error.message.includes("unauthorized")
        ) {
          errorMessage =
            "Permission denied - please refresh the page and try again";
        } else if (error.message.includes("not found")) {
          errorMessage =
            "Robot instance not found - it may have already stopped";
        } else if (error.message && error.message !== "Unknown error") {
          errorMessage = error.message;
        }
      }

      toast.error(errorMessage);
    } finally {
      setIsStoppingRobot(false);
    }
  };

  // Show nothing while loading robots
  if (isLoadingRobots) {
    return null;
  }

  // If there's an active robot instance (from URL param or found paused instance), decide which controls to show
  if (activeRobotInstance && viewMode !== "imprenta" && viewMode !== "workflow") {
    // Only show stop/authenticate buttons when robot is running or active
    const isRunning = ["running", "active"].includes(
      activeRobotInstance.status,
    );

    // Running-instance controls (Authenticate, Save Auth Session, Stop Robot)
    // are intentionally disabled. We still compute `isRunning` so this behavior
    // can be re-enabled later by flipping the flag below. Requirement status
    // and source-code (preview) behavior remain fully active.
    const SHOW_RUNNING_INSTANCE_CONTROLS = false;
    const showRunningControls = SHOW_RUNNING_INSTANCE_CONTROLS && isRunning;

    // Resume button hidden - removed per user request
    // Allow rendering if we have a source code url to download
    if (!showRunningControls && !latestSourceCodeUrl) {
      return null;
    }

    const handleSaveAuthSession = async () => {
      if (!activeRobotInstance) {
        toast.error("No active robot instance to save auth session");
        return;
      }

      try {
        const { apiClient } = await import("@/app/services/api-client-service");

        const response = await apiClient.post("/api/robots/auth", {
          site_id: currentSite.id,
          remote_instance_id: activeRobotInstance.id,
        });

        if (response.success) {
          toast.success("Auth session saved successfully");
        } else {
          // Handle API response errors
          const errorMessage =
            response.error?.message || "Failed to save auth session";
          console.error(
            "API Error saving auth session:",
            response.error || response,
          );

          // Log additional debugging information if available
          if (response.error?.details) {
            console.error("Error details:", response.error.details);

            // If it's a configuration issue, provide more specific guidance
            if (response.error.details.suggestion) {
              console.error("Suggestion:", response.error.details.suggestion);
            }
          }

          throw new Error(errorMessage);
        }
      } catch (error) {
        console.error("Error saving auth session:", error);

        // Provide more specific error messages based on the error type
        let errorMessage = "Failed to save auth session";

        if (error instanceof Error) {
          if (error.message.includes("fetch")) {
            errorMessage =
              "Network error - please check your connection and try again";
          } else if (error.message.includes("timeout")) {
            errorMessage = "Request timed out - please try again";
          } else if (
            error.message.includes("permission") ||
            error.message.includes("unauthorized")
          ) {
            errorMessage =
              "Permission denied - please refresh the page and try again";
          } else if (error.message.includes("not found")) {
            errorMessage =
              "Robot instance not found - please try refreshing the page";
          } else if (error.message && error.message !== "Unknown error") {
            errorMessage = error.message;
          }
        }

        toast.error(errorMessage);
      }
    };

    return (
      <>
        <div className="flex items-center gap-2">
          {showRunningControls && (
            <>
              <Button
                variant="secondary"
                size="default"
                className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                onClick={() => setIsAuthenticateModalOpen(true)}
                title={t("layout.topbar.authenticate")}
              >
                <Shield className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline font-inter font-medium text-sm">
                  {t("layout.topbar.authenticate")}
                </span>
              </Button>
              <Button
                variant="secondary"
                size="default"
                className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                onClick={handleSaveAuthSession}
                title={t("layout.topbar.saveAuthSession")}
              >
                <Key className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline font-inter font-medium text-sm">
                  {t("layout.topbar.saveAuthSession")}
                </span>
              </Button>
              <Button
                size="default"
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                onClick={handleStopRobot}
                disabled={isStoppingRobot}
                title={t("layout.topbar.stopRobot")}
              >
                {isStoppingRobot ? (
                  <>
                    <LoadingSkeleton
                      variant="button"
                      size="sm"
                      className="text-white"
                    />
                    <span className="hidden sm:inline font-inter font-medium text-sm">
                      {t("layout.topbar.stopping")}
                    </span>
                  </>
                ) : (
                  <>
                    <StopCircle className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline ml-2 font-inter font-medium text-sm">
                      {t("layout.topbar.stopRobot")}
                    </span>
                  </>
                )}
              </Button>
            </>
          )}
        </div>
        {showRunningControls && (
          <AuthenticateSessionsModal
            isOpen={isAuthenticateModalOpen}
            onClose={() => setIsAuthenticateModalOpen(false)}
            instanceId={activeRobotInstance.id}
          />
        )}
      </>
    );
  }

  // Default state: if New Makina is selected or in imprenta mode, hide start
  if (selectedInstanceId === "new" || viewMode === "imprenta" || viewMode === "workflow") return null;

  // Otherwise, show start button as fallback (should rarely show)
  return (
    <Button
      size="default"
      className="flex items-center gap-2 bg-primary hover:bg-primary/90 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
      onClick={handleStartRobot}
      disabled={isStartingRobot}
      title={t("layout.topbar.startRobot")}
    >
      {isStartingRobot ? (
        <>
          <LoadingSkeleton variant="button" size="sm" className="text-white" />
          <span className="hidden sm:inline font-inter font-medium text-sm">
            {t("layout.topbar.startingRobot")}
          </span>
        </>
      ) : (
        <>
          <PlayCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2 font-inter font-medium text-sm">
            {t("layout.topbar.startRobot")}
          </span>
        </>
      )}
    </Button>
  );
}

interface TopBarActionsProps {
  isPosPage?: boolean;
  isDashboardPage: boolean;
  isSegmentsPage: boolean;
  isExperimentsPage: boolean;
  isRequirementsPage: boolean;
  isLeadsPage: boolean;
  isAgentsPage: boolean;
  isAssetsPage: boolean;
  isContentPage: boolean;
  isControlCenterPage: boolean;
  isCampaignsPage: boolean;
  isSalesPage: boolean;
  isRecordsPage?: boolean;
  isRobotsPage: boolean;
  isSecurityPage: boolean;
  isAccountingPage?: boolean;
  isFinancePage?: boolean;
  isJournalEntriesPage?: boolean;
  dashboardActiveTab?: string;
  segmentData?: {
    id: string;
    activeTab: string;
    isAnalyzing: boolean;
    isGeneratingTopics: boolean;
    openAIModal: (type: "analysis" | "icp" | "topics") => void;
  } | null;
  requirementData?: {
    id: string;
    isBuilding: boolean;
    hasRequirementStatus: boolean;
  } | null;
  contentData?: {
    id: string;
    type: string;
    status: string;
  } | null;
  priceListData?: {
    id: string;
    is_active: boolean;
  } | null;
  segments: Array<{ id: string; name: string; description: string }>;
  propSegments?: Array<{ id: string; name: string; description: string }>;
  requirements: Array<{ id: string; title: string; description: string }>;
  campaigns: Array<{ id: string; title: string; description: string }>;
  isDealsPage?: boolean;
  isQuotationsPage?: boolean;
  isSettingsPage?: boolean;
  onCreateSale?: () => void;
  onCreateDeal?: () => void;
  viewMode?: string;
}

export function TopBarActions({
  isPosPage,
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
  isRecordsPage,
  isRobotsPage,
  isSecurityPage,
  isAccountingPage,
  isFinancePage,
  isJournalEntriesPage,
  dashboardActiveTab,
  segmentData,
  requirementData,
  contentData,
  priceListData,
  segments,
  propSegments,
  requirements,
  campaigns,
  isDealsPage,
  isQuotationsPage,
  isSettingsPage,
  onCreateSale,
  onCreateDeal,
  viewMode,
}: TopBarActionsProps) {
  const { t } = useLocalization();
  const { currentSite } = useSite();
  const router = useRouter();
  const pathname = usePathname();
  const [dateRange, setDateRange] = useState<{
    startDate: Date;
    endDate: Date;
  }>({
    startDate: startOfDay(subMonths(new Date(), 1)),
    endDate: endOfDay(new Date()),
  });
  const [selectedSegment, setSelectedSegment] = useState<string>("all");
  const [posCartQty, setPosCartQty] = useState(0);

  useEffect(() => {
    if (!isPosPage) return;
    const handleCartUpdate = (e: any) => {
      setPosCartQty(e.detail.qty);
    };
    window.addEventListener("pos:cart-updated", handleCartUpdate);
    return () => window.removeEventListener("pos:cart-updated", handleCartUpdate);
  }, [isPosPage]);

  // Check if we're on dashboard onboarding tab
  const [currentDashboardTab, setCurrentDashboardTab] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (isDashboardPage && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      // If no tab parameter, we need to check if user is in onboarding mode
      const finalTab = tab || "overview";
      setCurrentDashboardTab(finalTab);

      // Listen for popstate events (back/forward navigation)
      const handlePopState = () => {
        const newParams = new URLSearchParams(window.location.search);
        const newTab = newParams.get("tab") || "overview";
        setCurrentDashboardTab(newTab);
      };

      // Listen for custom events from dashboard tab changes
      const handleTabChange = () => {
        const newParams = new URLSearchParams(window.location.search);
        const newTab = newParams.get("tab") || "overview";
        setCurrentDashboardTab(newTab);
      };

      window.addEventListener("popstate", handlePopState);
      window.addEventListener("dashboard:tabchange", handleTabChange);
      return () => {
        window.removeEventListener("popstate", handlePopState);
        window.removeEventListener("dashboard:tabchange", handleTabChange);
      };
    }
  }, [isDashboardPage]);

  // Get current user
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function getUserId() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    }
    getUserId();
  }, []);

  const handleCreateSegment = async ({
    name,
    description,
    audience,
    language,
    site_id,
  }: {
    name: string;
    description: string;
    audience: string;
    language: string;
    site_id: string;
  }) => {
    try {
      const result = await createSegment({
        name,
        description,
        audience,
        language,
        site_id,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Recargar la página para mostrar el nuevo segmento
      safeReload(false, "New segment created");
    } catch (error) {
      console.error("Error creating segment:", error);
      throw error;
    }
  };

  const handleCreateExperiment = async (
    values: ExperimentFormValues,
  ): Promise<{ data?: any; error?: string }> => {
    try {
      const result = await createExperiment(values);

      if (result.error) {
        return { error: result.error };
      }

      // Recargar la página para mostrar el nuevo experimento
      safeReload(false, "New experiment created");
      return { data: result.data };
    } catch (error) {
      console.error("Error creating experiment:", error);
      return {
        error: error instanceof Error ? error.message : "Error inesperado",
      };
    }
  };

  const handleCreateRequirement = async (
    values: any,
  ): Promise<{ data?: any; error?: string }> => {
    try {
      const result = await createRequirement(values);

      if (result.error) {
        return { error: result.error };
      }

      // Recargar la página para mostrar el nuevo requerimiento
      safeReload(false, "New requirement created");
      return { data: result.data };
    } catch (error) {
      console.error("Error creating requirement:", error);
      return {
        error: error instanceof Error ? error.message : "Error inesperado",
      };
    }
  };

  const handleCreateAsset = async ({
    name,
    description,
    file_path,
    file_type,
    file_size,
    tags,
    site_id,
  }: {
    name: string;
    description?: string;
    file_path: string;
    file_type: string;
    file_size: number;
    tags: string[];
    site_id: string;
  }) => {
    try {
      const result = await createAsset({
        name,
        description,
        file_path,
        file_type,
        file_size,
        tags,
        site_id,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Recargar la página para mostrar el nuevo asset
      safeReload(false, "New asset created");
    } catch (error) {
      console.error("Error creating asset:", error);
      throw error;
    }
  };

  const handleCreateLead = async (
    data: any,
  ): Promise<{ error?: string; lead?: any }> => {
    try {
      const result = await createLead(data);

      if (result.error) {
        return { error: result.error };
      }

      // Recargar la página para mostrar el nuevo lead
      safeReload(false, "New lead created");
      return { lead: result.lead };
    } catch (error) {
      console.error("Error creating lead:", error);
      return {
        error: error instanceof Error ? error.message : "Error inesperado",
      };
    }
  };

  const handleCreateDeal = async (
    data: any,
  ): Promise<{ error?: string; deal?: any }> => {
    try {
      const { lead_id, ...dealData } = data;
      const result = await createDeal(dealData);

      if (result.error) {
        return { error: result.error };
      }

      // If a lead was selected, link it to the deal
      if (lead_id && result.deal?.id) {
        await addDealContact(result.deal.id, lead_id, "Primary Contact", true);
      }

      // Update UI without full page reload if possible
      if (typeof window !== "undefined" && (window as any).refreshDealsList) {
        (window as any).refreshDealsList();
      } else {
        safeReload(false, "New deal created");
      }

      return { deal: result.deal };
    } catch (error) {
      console.error("Error creating deal:", error);
      return {
        error: error instanceof Error ? error.message : "Error inesperado",
      };
    }
  };

  const handleImportLeads = async (leads: Partial<Lead>[]) => {
    if (!currentSite?.id) {
      return { success: false, count: 0, errors: ["No site selected"] };
    }

    try {
      const result = await importLeads(leads, currentSite.id);

      if (result.success) {
        if (result.errors && result.errors.length > 0) {
          toast.warning(`Imported ${result.count} leads, but some rows had errors.`);
          console.warn("Import errors:", result.errors);
          // Wait a bit before reloading so user can see the toast
          setTimeout(() => {
            safeReload(false, "Leads imported with some errors");
          }, 3000);
        } else {
          // Recargar la página para mostrar los nuevos leads
          safeReload(false, "Leads imported successfully");
        }
      }

      return result;
    } catch (error) {
      console.error("Error importing leads:", error);
      return {
        success: false,
        count: 0,
        errors: ["Failed to import leads"],
      };
    }
  };

  const handleCreateCampaign = async (
    values: any,
  ): Promise<{ data?: any; error?: string }> => {
    try {
      const response = await createCampaign(values);
      if (response.error) {
        return { error: response.error };
      }
      return { data: response.data };
    } catch (error) {
      console.error("Error creating campaign:", error);
      return {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
      };
    }
  };

  // Handle logout function
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      toast.loading(t("layout.topbar.signingOut"));

      const supabase = createClient();
      await supabase.auth.signOut();

      window.location.href = "/api/auth/logout";
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Error signing out");

      window.location.href = "/api/auth/logout";
    }
  };

  return (
    <div className="flex items-center gap-4">
      {pathname.startsWith("/content/") &&
        pathname !== "/content/deepResearch" && (
          <Button
            variant="default"
            className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90"
            title={t("layout.topbar.publishToSocial") || "Publish"}
            onClick={() =>
              window.dispatchEvent(new CustomEvent("content:publish"))
            }
          >
            <Globe className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline font-inter font-medium text-sm">
              {t("layout.topbar.publishToSocial") || "Publish"}
            </span>
          </Button>
        )}

      {isControlCenterPage && currentSite ? (
        <CreateTaskDialog
          trigger={
            <Button
              className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
              title={t("layout.topbar.newTask")}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline ml-2">
                {t("layout.topbar.newTask")}
              </span>
            </Button>
          }
        />
      ) : null}

      {/* Docs Button */}
      {isSecurityPage && (
        <Button
          variant="ghost"
          size="default"
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() => window.open("https://docs.makinari.com", "_blank")}
          title="Documentation"
        >
          <BookOpen className="h-5 w-5 shrink-0" />
          <span className="hidden sm:inline">{t("layout.topbar.docs")}</span>
        </Button>
      )}

      {currentSite ? (
        <>
          {isDashboardPage &&
            (() => {
              if (typeof window !== "undefined") {
                const params = new URLSearchParams(window.location.search);
                const tab = params.get("tab");
                // Show export button only if explicitly NOT on onboarding tab
                return tab !== "onboarding";
              }
              return true; // Default to showing it if we can't determine
            })() && (
              <Button
                className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                onClick={async () => {
                  if (!userId) {
                    toast.error("User not authenticated");
                    return;
                  }

                  try {
                    const response = await fetch(
                      `/api/dashboard/export?siteId=${currentSite.id}&segmentId=${selectedSegment}&userId=${userId}&startDate=${format(dateRange.startDate, "yyyy-MM-dd")}&endDate=${format(dateRange.endDate, "yyyy-MM-dd")}`,
                      {
                        method: "GET",
                        headers: {
                          "Content-Type": "application/json",
                        },
                      },
                    );

                    if (!response.ok) throw new Error("Export failed");

                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `dashboard-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);

                    toast.success("Report exported successfully");
                  } catch (error) {
                    console.error("Error exporting dashboard data:", error);
                    toast.error("Failed to export report");
                  }
                }}
                title={t("layout.topbar.export")}
              >
                <Download className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline ml-2">
                  {t("layout.topbar.export")}
                </span>
              </Button>
            )}
        </>
      ) : null}

      {/* Requirement Detail Page Build Button */}
      {requirementData && currentSite && (
        <Button
          variant="default"
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("requirement:build-trigger"));
          }}
          disabled={requirementData.isBuilding}
          title={
            requirementData.hasRequirementStatus
              ? "Rebuild Requirement"
              : "Build Requirement"
          }
        >
          {requirementData.isBuilding ? (
            <>
              <div className="h-4 w-4 animate-pulse bg-primary-foreground/50 rounded" />
              <span className="hidden sm:inline font-inter font-medium text-sm">
                Building...
              </span>
            </>
          ) : (
            <>
              <Bot className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline font-inter font-medium text-sm">
                {requirementData.hasRequirementStatus
                  ? "Rebuild Requirement"
                  : "Build Requirement"}
              </span>
            </>
          )}
        </Button>
      )}
      {segmentData && (
        <>
          {(segmentData.activeTab === "analysis" ||
            segmentData.activeTab === "icp") && (
            <Button
              variant="secondary"
              size="default"
              className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
              onClick={() => segmentData.openAIModal("analysis")}
              disabled={segmentData.isAnalyzing}
              title={t("layout.topbar.analyzeWithAI")}
            >
              {segmentData.isAnalyzing ? (
                <>
                  <LoadingSkeleton variant="button" size="sm" />
                  <span className="hidden sm:inline font-inter font-medium text-sm">
                    {t("layout.topbar.analyzing")}
                  </span>
                </>
              ) : (
                <>
                  <BarChart className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline font-inter font-medium text-sm">
                    {t("layout.topbar.analyzeWithAI")}
                  </span>
                </>
              )}
            </Button>
          )}
          {segmentData.activeTab === "topics" && (
            <Button
              variant="secondary"
              size="default"
              className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
              onClick={() => segmentData.openAIModal("topics")}
              disabled={segmentData.isGeneratingTopics}
              title={t("layout.topbar.getTopicsWithAI")}
            >
              {segmentData.isGeneratingTopics ? (
                <>
                  <LoadingSkeleton variant="button" size="sm" />
                  <span className="hidden sm:inline font-inter font-medium text-sm">
                    {t("layout.topbar.gettingTopics")}
                  </span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">
                    {t("layout.topbar.getTopicsWithAI")}
                  </span>
                </>
              )}
            </Button>
          )}
        </>
      )}
      {isSegmentsPage &&
        (currentSite ? (
          <CreateSegmentDialog
            onCreateSegment={handleCreateSegment}
            trigger={
              <Button
                className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                title={t("layout.topbar.newSegment")}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline ml-2">
                  {t("layout.topbar.newSegment")}
                </span>
              </Button>
            }
          />
        ) : null)}
      {isExperimentsPage &&
        (currentSite ? (
          <div className="flex items-center gap-2">
            <CreateExperimentDialog
              segments={segments || []}
              campaigns={campaigns}
              onCreateExperiment={handleCreateExperiment}
              trigger={
                <Button
                  className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                  title={t("layout.topbar.newExperiment")}
                >
                  <PlusCircle className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline ml-2">
                    {t("layout.topbar.newExperiment")}
                  </span>
                </Button>
              }
            />
          </div>
        ) : null)}
      {isRequirementsPage &&
        (currentSite ? (
          <>
            <CreateRequirementDialog
              segments={segments || []}
              campaigns={campaigns}
              onCreateRequirement={handleCreateRequirement}
              trigger={
                <Button
                  className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                  title={t("layout.topbar.newRequirement")}
                >
                  <PlusCircle className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline ml-2">
                    {t("layout.topbar.newRequirement")}
                  </span>
                </Button>
              }
            />
          </>
        ) : null)}
      {isLeadsPage &&
        (currentSite ? (
          <>
            <ImportLeadsDialog
              segments={segments.length > 0 ? segments : propSegments || []}
              onImportLeads={handleImportLeads}
              trigger={
                <Button
                  variant="secondary"
                  className="flex items-center justify-center gap-2 md:h-9 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                  title={t("layout.topbar.import")}
                >
                  <UploadCloud className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline ml-2">
                    {t("layout.topbar.import")}
                  </span>
                </Button>
              }
            />
            <Button
              variant="secondary"
              className="flex items-center justify-center gap-2 md:h-9 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
              title={t("layout.topbar.export")}
              onClick={async () => {
                try {
                  const response = await fetch(
                    `/api/leads/export?siteId=${currentSite.id}`,
                    {
                      method: "GET",
                      headers: {
                        "Content-Type": "application/json",
                      },
                    },
                  );

                  if (!response.ok) throw new Error("Export failed");

                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } catch (error) {
                  console.error("Error exporting leads:", error);
                  toast.error("Failed to export leads");
                }
              }}
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline ml-2">
                {t("layout.topbar.export")}
              </span>
            </Button>
            <CreateLeadDialog
              segments={segments.length > 0 ? segments : propSegments || []}
              campaigns={campaigns}
              onCreateLead={handleCreateLead}
              trigger={
                <Button
                  className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                  title="Add Lead"
                >
                  <PlusCircle className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline ml-2">
                    {t("layout.topbar.addLead")}
                  </span>
                </Button>
              }
            />
          </>
        ) : null)}
      {isAgentsPage && (currentSite ? <></> : null)}
      {isAssetsPage &&
        (currentSite ? (
          <UploadAssetDialog onUploadAsset={handleCreateAsset} />
        ) : null)}
      {isContentPage &&
        (currentSite ? (
          <CreateContentDialog
            segments={segments.length > 0 ? segments : propSegments || []}
            onSuccess={() => {
              if (
                typeof window !== "undefined" &&
                (window as any).refreshContentList
              ) {
                (window as any).refreshContentList();
              } else {
                safeReload(false, "New content created");
              }
            }}
            trigger={
              <Button
                className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                title={t("layout.topbar.newContent")}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline ml-2">
                  {t("layout.topbar.newContent")}
                </span>
              </Button>
            }
          />
        ) : null)}
      {isCampaignsPage &&
        (currentSite ? (
          <CreateCampaignDialog
            segments={segments.length > 0 ? segments : propSegments || []}
            requirements={requirements}
            onCreateCampaign={handleCreateCampaign}
            trigger={
              <Button
                className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                title={t("layout.topbar.newCampaign")}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline ml-2">
                  {t("layout.topbar.newCampaign")}
                </span>
              </Button>
            }
          />
        ) : null)}
        
            {isRecordsPage && currentSite && (
              <Button
                className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("records:create"))
                }
                title={t("layout.topbar.newRecord") || "New Record"}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline ml-2">
                  {t("layout.topbar.newRecord") || "New Record"}
                </span>
              </Button>
            )}

            {isSalesPage &&
        (currentSite ? (
          <>
            <Button
              variant="secondary"
              className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
              title={t("layout.topbar.export")}
              onClick={async () => {
                try {
                  const response = await fetch(
                    `/api/sales/export?siteId=${currentSite.id}`,
                    {
                      method: "GET",
                      headers: {
                        "Content-Type": "application/json",
                      },
                    },
                  );

                  if (!response.ok) throw new Error("Export failed");

                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `sales-${new Date().toISOString().split("T")[0]}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } catch (error) {
                  console.error("Error exporting sales:", error);
                  toast.error("Failed to export sales");
                }
              }}
            >
              <Download className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline ml-2">
                {t("layout.topbar.export")}
              </span>
            </Button>
            <Button
              onClick={onCreateSale}
              className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
              title={t("layout.topbar.addSale")}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline ml-2">
                {t("layout.topbar.addSale")}
              </span>
            </Button>
          </>
        ) : null)}

      {isPosPage && currentSite && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="default"
            className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() => { window.location.href = '/pos/check-in' }}
            title={t("pos.checkIn.title") || "Ticket Check-in"}
          >
            <Ticket className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline font-inter font-medium text-sm">
              {t("pos.checkIn.title") || "Ticket Check-in"}
            </span>
          </Button>
          <Button
            variant="secondary"
            size="default"
            className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm overflow-visible"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("pos:send-order"))
            }
            title={t("layout.topbar.sendOrder") || "Send Order"}
          >
            <div className="relative">
              <ShoppingCart className="h-4 w-4 shrink-0" />
              {posCartQty > 0 && (
                <span className="absolute -top-2 -right-2 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-1 ring-background z-10">
                  {posCartQty > 99 ? '99+' : posCartQty}
                </span>
              )}
            </div>
            <span className="hidden sm:inline font-inter font-medium text-sm">
              {t("layout.topbar.sendOrder") || "Send Order"}
            </span>
          </Button>
        </div>
      )}

      {pathname === "/catalog" && currentSite && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() => router.push("/catalog/modifier-groups")}
            title={t("catalog.modifiers.groupsTitle") || "Modifier groups"}
          >
            <ModifierGroups className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">
              {t("catalog.modifiers.groupsTitle") || "Modifier groups"}
            </span>
          </Button>
          <Button
            className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("catalog:create"))
            }
            title={t("catalog.addItem") || "Add Item"}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">
              {t("catalog.addItem") || "Add Item"}
            </span>
          </Button>
        </div>
      )}

      {pathname === "/catalog/modifier-groups" && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("modifier-groups:create"))
          }
          title={t("catalog.modifiers.create") || "New group"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">
            {t("catalog.modifiers.create") || "New group"}
          </span>
        </Button>
      )}

      {pathname === "/orders" && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() => window.dispatchEvent(new CustomEvent("orders:create"))}
          title={t("orders.add") || "Create Order"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">
            {t("orders.add") || "Create Order"}
          </span>
        </Button>
      )}

      {pathname === "/shipments" && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("shipments:create"))
          }
          title={t("shipments.add") || "Create Shipment"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">
            {t("shipments.add") || "Create Shipment"}
          </span>
        </Button>
      )}

      {pathname === "/inventory" && currentSite && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("inventory:open-location-dialog"),
              )
            }
            title={t("inventory.addLocation") || "Add Location"}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">
              {t("inventory.addLocation") || "Add Location"}
            </span>
          </Button>
          <Button
            className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("inventory:create-stock"))
            }
            title={t("inventory.addStock") || "Add Stock"}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">
              {t("inventory.addStock") || "Add Stock"}
            </span>
          </Button>
        </div>
      )}

      {pathname === "/price-lists" && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("price-lists:create"))
          }
          title={t("priceLists.addList") || "Create List"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">
            {t("priceLists.addList") || "Create List"}
          </span>
        </Button>
      )}

      {pathname.startsWith("/price-lists/") && pathname !== "/price-lists" && currentSite && priceListData && (
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
             <Label htmlFor="active-status" className="text-sm font-medium">Active</Label>
             <Switch 
                id="active-status" 
                checked={priceListData.is_active} 
                onCheckedChange={() => window.dispatchEvent(new CustomEvent("price-list:toggle-active"))} 
             />
          </div>
          <Button
            variant="outline"
            className="!min-w-0 sm:!min-w-[120px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("price-list:edit"))
            }
            title={t("priceLists.editAction") || "Edit list"}
          >
            <Edit className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">
              {t("priceLists.editAction") || "Edit list"}
            </span>
          </Button>
          <Button
            className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("price-list:add-price"))
            }
            title="Add Price"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">
              Add Price
            </span>
          </Button>
        </div>
      )}

      {pathname === "/promotions" && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("promotions:create"))
          }
          title={t("promotions.add") || "Create Promotion"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">
            {t("promotions.add") || "Create Promotion"}
          </span>
        </Button>
      )}

      {pathname === "/subscriptions" && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("subscriptions:create"))
          }
          title="Create Subscription"
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">Create Subscription</span>
        </Button>
      )}

      {pathname === "/reservations" && currentSite && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="!min-w-0 sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm text-destructive hover:text-destructive hover:bg-destructive/10 border-transparent bg-transparent shadow-none"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("calendarBlocks:create"))
            }
            title="Block Time"
          >
            <Ban className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">Block Time</span>
          </Button>
          <Button
            className="!min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("reservations:create"))
            }
            title="Create Reservation"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">Create Reservation</span>
          </Button>
        </div>
      )}

      {isQuotationsPage && pathname === "/quotations" && currentSite && (
        <CreateQuotationDialog
          trigger={
            <Button
              className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
              title="Create Quotation"
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline ml-2">Create Quotation</span>
            </Button>
          }
        />
      )}
      {isDealsPage &&
        (currentSite ? (
          <CreateDealDialog
            onCreateDeal={handleCreateDeal}
            trigger={
              <Button
                className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                title={t("layout.topbar.createDeal")}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline ml-2">
                  {t("layout.topbar.createDeal")}
                </span>
              </Button>
            }
          />
        ) : null)}
      {isRobotsPage &&
        (currentSite ? (
          viewMode === "workflow" ? (
            <WorkflowRunButton />
          ) : (
            <RobotStartButton currentSite={currentSite} viewMode={viewMode} />
          )
        ) : null)}

      {/* New Purchase button in toolbar */}
      {pathname.startsWith("/purchases/orders") && currentSite && (
        <Button
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => router.push(`/marketplace?ownerSiteId=${currentSite.id}&returnTo=/purchases/orders`)}
          title={t("buyer.orders.newPurchase") || "New Purchase"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline font-inter font-medium text-sm">
            {t("buyer.orders.newPurchase") || "New Purchase"}
          </span>
        </Button>
      )}

      {/* New Subscription button in toolbar */}
      {pathname.startsWith("/purchases/subscriptions") && currentSite && (
        <Button
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => router.push(`/marketplace?ownerSiteId=${currentSite.id}&returnTo=/purchases/subscriptions&filter=recurring`)}
          title={t("buyer.subscriptions.newSubscription") || "New Subscription"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline font-inter font-medium text-sm">
            {t("buyer.subscriptions.newSubscription") || "New Subscription"}
          </span>
        </Button>
      )}

      {/* New Bill button in toolbar */}
      {pathname.startsWith("/bills") && currentSite && (
        <Button
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => {
            if (pathname === "/bills") {
              window.dispatchEvent(new CustomEvent("bills:create"))
            } else {
              router.push("/bills")
              setTimeout(() => window.dispatchEvent(new CustomEvent("bills:create")), 100)
            }
          }}
          title={t("bills.create.button") || "New bill"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline font-inter font-medium text-sm">
            {t("bills.create.button") || "New bill"}
          </span>
        </Button>
      )}

      {/* Add Expense button in toolbar */}
      {pathname === "/transactions" && currentSite && (
        <Button
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => {
            // Desencadenamos un evento personalizado para que la página lo escuche y abra su diálogo
            const event = new CustomEvent('transactions:create');
            window.dispatchEvent(event);
          }}
          title={t("expenses.create.button") || "Add Expense"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline font-inter font-medium text-sm">
            {t("expenses.create.button") || "Add Expense"}
          </span>
        </Button>
      )}

      {/* Accounting Actions */}
      {isAccountingPage && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() => window.dispatchEvent(new CustomEvent('accounting:openingBalances'))}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">Opening Balances</span>
          </Button>
          <Button
            className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => window.dispatchEvent(new CustomEvent('accounting:create'))}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">Add Account</span>
          </Button>
        </div>
      )}

      {/* Finance Actions */}
      {isFinancePage && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() => window.dispatchEvent(new CustomEvent('finance:exportReport'))}
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">Export</span>
          </Button>
          <Button
            className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => window.dispatchEvent(new CustomEvent('finance:loadReport'))}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">Generate Report</span>
          </Button>
        </div>
      )}

      {/* Journal Entries Actions */}
      {isJournalEntriesPage && (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() => window.dispatchEvent(new CustomEvent('journal:load'))}
          >
            <Repeat className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">{t('common.sync') || "Sync"}</span>
          </Button>
          <Button
            className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => window.dispatchEvent(new CustomEvent('journal:create'))}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">{t('accounting.newEntry') || "New Entry"}</span>
          </Button>
        </div>
      )}

      {/* Logout button in toolbar - only visible on profile page */}
      {pathname.startsWith("/profile") && (
        <Button
          variant="secondary"
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={handleLogout}
          title={
            isLoggingOut
              ? t("layout.topbar.signingOut")
              : t("layout.topbar.logOut")
          }
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline font-inter font-medium text-sm pt-0.5">
            {isLoggingOut
              ? t("layout.topbar.signingOut")
              : t("layout.topbar.logOut")}
          </span>
        </Button>
      )}
    </div>
  );
}
