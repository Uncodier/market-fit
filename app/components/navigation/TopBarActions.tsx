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
  ArrowUpRight
} from "@/app/components/ui/icons";

import { subMonths, format, startOfDay, endOfDay } from "date-fns";
import { safeReload } from "../../utils/safe-reload";
import { useSearchParams } from "next/navigation";
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";

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

      window.dispatchEvent(new Event('requirements:reload'));
      
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
      const supabase = createClient();
      const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .insert({
          title: values.title,
          description: values.description,
          priority: values.priority,
          status: values.status && values.status !== "draft" ? values.status : "active",
          due_date: values.dueDate,
          type: values.type,
          site_id: values.site_id,
          user_id: values.user_id,
          assignees: 0,
          issues: 0,
          revenue: values.revenue || { actual: 0, projected: 0, estimated: 0, currency: "USD" },
          budget: values.budget || { allocated: 0, remaining: 0, currency: "USD" },
        })
        .select()
        .single();

      if (campaignError) {
        return { error: campaignError.message };
      }

      if (values.segments?.length) {
        const { error: segmentError } = await supabase
          .from("campaign_segments")
          .insert(values.segments.map((segmentId: string) => ({
            campaign_id: campaign.id,
            segment_id: segmentId,
          })));
        if (segmentError) console.error("Error linking segments:", segmentError);
      }

      if (values.requirements?.length) {
        const { error: requirementError } = await supabase
          .from("campaign_requirements")
          .insert(values.requirements.map((requirementId: string) => ({
            campaign_id: campaign.id,
            requirement_id: requirementId,
          })));
        if (requirementError) console.error("Error linking requirements:", requirementError);
      }

      return { data: campaign };
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
            className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90"
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
              className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
                className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
        </>
      )}
      {isSegmentsPage &&
        (currentSite ? (
          <CreateSegmentDialog
            onCreateSegment={handleCreateSegment}
            trigger={
              <Button
                className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
                  className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
                  className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
            <CreateLeadDialog
              segments={segments.length > 0 ? segments : propSegments || []}
              campaigns={campaigns}
              onCreateLead={handleCreateLead}
              trigger={
                <Button
                  className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
                className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
                className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
                className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
              onClick={onCreateSale}
              className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
            className="hidden sm:flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() => { window.location.href = '/pos/check-in' }}
            title={t("pos.checkIn.title") || "Ticket Check-in"}
          >
            <Ticket className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline font-inter font-medium text-sm">
              {t("pos.checkIn.title") || "Ticket Check-in"}
            </span>
          </Button>
          <Button
            variant="default"
            size="default"
            className="hidden sm:flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90"
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
            className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
            className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
          <Button
            className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
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
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
            className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
              className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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
                className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
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

      {/* New Purchase button in toolbar */}
      {pathname.startsWith("/purchases/orders") && currentSite && (
        <Button
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
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
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => router.push(`/marketplace?ownerSiteId=${currentSite.id}&returnTo=/purchases/subscriptions&filter=recurring`)}
          title={t("buyer.subscriptions.newSubscription") || "New Subscription"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline font-inter font-medium text-sm">
            {t("buyer.subscriptions.newSubscription") || "New Subscription"}
          </span>
        </Button>
      )}

      {/* Payouts actions */}
      {pathname.startsWith("/payments") && currentSite && (
        <Button
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => {
            const event = new CustomEvent("payouts:request-open")
            window.dispatchEvent(event)
          }}
          disabled={!currentSite.billing?.account_balance || currentSite.billing.account_balance <= 0}
          title="Request Payout"
        >
          <ArrowUpRight className="h-4 w-4" />
          <span className="hidden sm:inline">Request Payout</span>
        </Button>
      )}

      {/* New Bill button in toolbar */}
      {pathname.startsWith("/bills") && currentSite && (
        <Button
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
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
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
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
            className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
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
            className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
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
            className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
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
          variant="default"
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
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
