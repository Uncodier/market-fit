"use client"

import React, { useState, useEffect, createContext } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent } from "@/app/components/ui/card"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { useCommandK } from "@/app/hooks/use-command-k"
import { Button } from "@/app/components/ui/button"
import { getCampaignById } from "@/app/control-center/actions/campaigns/read"
import { createSubtask } from "@/app/control-center/actions/subtasks/create"
import { deleteCampaign } from "@/app/control-center/actions/campaigns/delete"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/app/components/ui/alert-dialog"
import { Revenue, Budget } from "@/app/types"
import { SubtaskFormValues } from "@/app/components/add-subtask-dialog"
import { CampaignRequirementFormValues } from "@/app/components/create-requirement-dialog-for-campaign"
import { createRequirement } from "@/app/requirements/actions"
import { getLeadsByCampaignId } from "@/app/leads/actions"
import { Lead } from "@/app/leads/types"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { getSegments } from "@/app/segments/actions"
import { 
  CampaignSummary, 
  FinancialDetails, 
  TaskDetailSkeleton,
  TaskDetailContextType
} from "@/app/components/campaign-detail"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Settings } from "@/app/components/ui/icons"

// Mock long description with markdown
const longDescription = `
## Campaign Purpose
This campaign aims to improve our organic search presence through strategic content creation and optimization.

### Key Objectives
- Increase organic traffic by 30%
- Improve keyword rankings for target terms
- Generate more leads through content

### Target Audience
The campaign primarily focuses on marketing professionals and decision makers in the tech industry who are looking for solutions to improve their digital presence.

### Strategy Overview
1. Conduct comprehensive keyword research
2. Create a content calendar based on findings
3. Develop and publish optimized content
4. Monitor performance and adjust as needed
`;

// Mock cost breakdown data
const costBreakdown = [
  { id: 1, category: "Content Creation", amount: 3500, type: "fixed", date: "2023-09-15" },
  { id: 2, category: "Digital Advertising", amount: 2500, type: "variable", date: "2023-09-20" },
  { id: 3, category: "Marketing Tools", amount: 1000, type: "fixed", date: "2023-09-25" },
  { id: 4, category: "Freelancer Support", amount: 2500, type: "fixed", date: "2023-10-01" },
  { id: 5, category: "Ad Spend", amount: 2500, type: "variable", date: "2023-10-05" }
];

// Mock segments data
const segments = [
  { id: "s-1", name: "Tech Enthusiasts" },
  { id: "s-2", name: "Decision Makers" },
  { id: "s-3", name: "Marketing Professionals" }
];

// Create a context to pass down the campaign segments data
const TaskDetailContext = createContext<TaskDetailContextType>({
  loadingSegments: false,
  campaignSegments: [],
});

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentSite } = useSite();
  const [campaign, setCampaign] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"active" | "completed" | "cancelled">("active");
  const [campaignLeads, setCampaignLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [editableDescription, setEditableDescription] = useState(longDescription);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [campaignSegments, setCampaignSegments] = useState<Array<{ id: string; name: string; description: string | null }>>([]);
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [siteSegments, setSiteSegments] = useState<Array<{ id: string; name: string; }>>([]);
  const [financialData, setFinancialData] = useState<{
    revenue: Revenue;
    budget: Budget;
    costs: {
      fixed: number;
      variable: number;
      total: number;
      currency: string;
    };
  }>({
    revenue: { actual: 0, projected: 0, estimated: 0, currency: "USD" },
    budget: { allocated: 0, remaining: 0, currency: "USD" },
    costs: { fixed: 0, variable: 0, total: 0, currency: "USD" }
  });
  const [transactions, setTransactions] = useState(costBreakdown);
  
  // Function to convert segment IDs to full segment objects
  const getSegmentObjectsFromIds = (segmentIds: string[]): Array<{ id: string; name: string; description: string | null }> => {
    if (!segmentIds || !Array.isArray(segmentIds) || segmentIds.length === 0) {
      return [];
    }
    
    return segmentIds.map(id => {
      // Skip mock segment IDs (starting with 's-')
      if (id.startsWith('s-')) {
        return {
          id,
          name: `Mock ${id}`,
          description: null
        };
      }
      
      // Find the segment in the siteSegments array (real data)
      const siteSegment = siteSegments.find(s => s.id === id);
      if (siteSegment) {
        return {
          id: siteSegment.id,
          name: siteSegment.name,
          description: null
        };
      }
      
      // Fallback for unknown segments
      return {
        id,
        name: `Segment ${id.substring(0, 8)}`,
        description: null
      };
    }).filter(segment => !segment.id.startsWith('s-')); // Filter out mock segments
  };
  
  // Initialize command-k hook
  useCommandK();

  // Add handleCreateRequirement inside the component to access campaignSegments
  const handleCreateRequirementInternal = async (values: CampaignRequirementFormValues): Promise<{ data?: any; error?: string }> => {
    try {
      // Extract segment IDs from the current campaignSegments state
      const segmentIds = campaignSegments.map(segment => segment.id);

      // Adapt the values for the createRequirement action
      const requirementData = {
        ...values,
        segments: segmentIds, // Use the campaign segments
        campaigns: [values.campaign_id], // Set the campaign
        source: "Campaign" // Set the source
      };

      const result = await createRequirement(requirementData as any);
      return result;
    } catch (error) {
      console.error("Error creating requirement:", error);
      return { 
        error: error instanceof Error ? error.message : "An unknown error occurred" 
      };
    }
  };

  // Function to load real segments from the site
  const loadSiteSegments = async () => {
    if (!currentSite?.id) return;
    
    try {
      setLoadingSegments(true);
      const result = await getSegments(currentSite.id);
      
      if (result.error) {
        console.error("Error loading segments:", result.error);
        return;
      }
      
      const siteSegmentData = result.segments || [];
      
      // Transform to our expected format
      const formattedSegments = siteSegmentData.map((segment: any) => ({
        id: segment.id,
        name: segment.name || 'Unnamed Segment'
      }));
      
      console.log("Loaded site segments:", formattedSegments);
      
      // Only use real site segments, don't include mock ones
      setSiteSegments(formattedSegments);
    } catch (error) {
      console.error("Error loading site segments:", error);
    } finally {
      setLoadingSegments(false);
    }
  };

  // Function to load leads for the campaign
  const loadCampaignLeads = async (campaignId: string) => {
    if (!params.id || !currentSite?.id) return;
    
    try {
      setLoadingLeads(true);
      
      const result = await getLeadsByCampaignId(campaignId, currentSite.id);
      
      if (result.error) {
        console.error("Error loading campaign leads:", result.error);
        return;
      }
      
      setCampaignLeads(result.leads || []);
    } catch (error) {
      console.error("Error loading leads:", error);
    } finally {
      setLoadingLeads(false);
    }
  };
  
  // Load campaign data
  useEffect(() => {
    if (params.id) {
      // Reset title to default when component mounts and while loading
      document.title = 'Campaign Details | Market Fit';
      const resetEvent = new CustomEvent('breadcrumb:update', {
        detail: {
          title: 'Campaign Details',
          path: `/control-center/${params.id}`,
          section: 'control-center'
        }
      });
      window.dispatchEvent(resetEvent);
      
      // Load segments for the site
      loadSiteSegments();
      
      // Load the campaign with the server action instead of the local function
      const fetchCampaign = async () => {
        try {
          const response = await getCampaignById(params.id as string);
          
          if (response && response.data) {
            console.log("Campaign data:", JSON.stringify(response.data));
            setCampaign(response.data);
            
            // Load campaign leads
            loadCampaignLeads(response.data.id);
            
            // Load campaign segments if available
            if (response.data.segments && Array.isArray(response.data.segments) && response.data.segments.length > 0) {
              console.log("Loading segments for campaign:", response.data.segments);
              const segmentObjects = getSegmentObjectsFromIds(response.data.segments);
              setCampaignSegments(segmentObjects);
            }
            
            // Initialize financial data
            setFinancialData({
              revenue: { 
                actual: response.data.revenue?.actual || 0,
                projected: response.data.revenue?.projected || 0,
                estimated: response.data.revenue?.estimated || 0,
                currency: response.data.revenue?.currency || "USD"
              },
              budget: { 
                allocated: response.data.budget?.allocated || 0,
                remaining: response.data.budget?.remaining || 0,
                currency: response.data.budget?.currency || "USD"
              },
              costs: {
                fixed: 0,
                variable: 0,
                total: response.data.budget?.allocated && response.data.budget?.remaining 
                  ? response.data.budget.allocated - response.data.budget.remaining 
                  : 0,
                currency: response.data.budget?.currency || "USD"
              }
            });
            
            // Update page title and breadcrumb
            document.title = `${response.data.title} | Campaigns`;
            const event = new CustomEvent('breadcrumb:update', {
              detail: {
                title: response.data.title,
                path: `/control-center/${params.id}`,
                section: 'control-center'
              }
            });
            
            setTimeout(() => {
              window.dispatchEvent(event);
            }, 0);
          } else {
            toast.error("Campaign not found");
            router.push("/control-center");
          }
        } catch (error) {
          console.error("Error fetching campaign:", error);
          toast.error("Failed to load campaign");
          router.push("/control-center");
        } finally {
          setLoading(false);
        }
      };
      
      fetchCampaign();
    }
  }, [params.id, router, currentSite]);
  
  // Add effect for component unmount to ensure clean state
  useEffect(() => {
    // When component mounts, set default title
    document.title = 'Campaign Details | Market Fit';
    
    // Cleanup when component unmounts
    return () => {
      document.title = 'Campaigns | Market Fit';
      const resetEvent = new CustomEvent('breadcrumb:update', {
        detail: {
          title: null,
          path: null,
          section: 'control-center'
        }
      });
      window.dispatchEvent(resetEvent);
    }
  }, []);
  
  const handleUpdateCampaign = (data: any) => {
    console.log("handleUpdateCampaign received data:", JSON.stringify(data));
    
    setCampaign((prev: any) => {
      if (!prev) return null;
      
      // Create a new campaign object with the updated data
      const updatedCampaign = {
        ...prev,
        ...data,
        // Ensure segments is an array
        segments: Array.isArray(data.segments) ? data.segments : (prev.segments || [])
      };
      
      console.log("Updated campaign state:", JSON.stringify(updatedCampaign));
      return updatedCampaign;
    });
    
    // Use the segmentObjects if available, otherwise generate from IDs
    if (data.segmentObjects && Array.isArray(data.segmentObjects) && data.segmentObjects.length > 0) {
      console.log("Using segment objects directly:", data.segmentObjects);
      
      // Convert to the expected format if needed
      const formattedSegments = data.segmentObjects.map((segment: any) => ({
        id: segment.id,
        name: segment.name,
        description: segment.description || null
      }));
      
      setCampaignSegments(formattedSegments);
    } else if (data.segments && Array.isArray(data.segments)) {
      console.log("Generating segment objects from IDs:", data.segments);
      
      // Convert segment IDs to full segment objects
      const segmentObjects = getSegmentObjectsFromIds(data.segments);
      
      console.log("Generated segment objects for display:", segmentObjects);
      setCampaignSegments(segmentObjects);
    } else {
      // If no segments, clear the display
      setCampaignSegments([]);
    }
    
    toast.success("Campaign updated successfully");
  };
  
  const handleCompleteClick = () => {
    handleUpdateCampaign({ status: "completed" });
    toast.success("Campaign marked as completed");
  };
  
  const handleAddSubtask = async (values: SubtaskFormValues): Promise<{ data?: any; error?: string }> => {
    try {
      const result = await createSubtask({
        campaignId: values.campaignId,
        title: values.title,
        status: values.status
      });
      
      if (result.data) {
        // Update local campaign state to include the new subtask
        setCampaign((prev: any) => {
          if (!prev) return null;
          
          return {
            ...prev,
            subtasks: [...prev.subtasks, result.data]
          };
        });
      }
      
      return { 
        data: result.data, 
        error: result.error as string | undefined 
      };
    } catch (error) {
      console.error("Error adding subtask:", error);
      return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" };
    }
  };
  
  const handleEditCampaign = () => {
    // Redirect to edit page
    router.push(`/control-center/edit/${params.id}`);
  };
  
  const handleDeleteCampaign = async () => {
    if (!params.id || !currentSite?.id) return;
    
    try {
      const result = await deleteCampaign(params.id as string);
      
      if (result.error) {
        toast.error(result.error);
        return;
      }
      
      toast.success("Campaign deleted successfully");
      router.push("/control-center");
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Failed to delete campaign");
    }
  };
  
  if (loading) {
    return <TaskDetailSkeleton />;
  }
  
  if (!campaign) {
    return (
      <div className="flex-1 p-0">
        <EmptyCard 
          className="m-16"
          title="Campaign not found"
          description="The campaign may have been deleted or you don't have permission to view it."
          icon={<Settings className="h-10 w-10 text-muted-foreground" />}
        />
      </div>
    );
  }
  
  return (
    <div className="flex-1 p-0">
      <TaskDetailContext.Provider value={{ loadingSegments, campaignSegments }}>
        <Tabs defaultValue="summary">
          <StickyHeader showAIButton={true}>
            <div className="px-16 pt-0">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="summary">Campaign Summary</TabsTrigger>
                  <TabsTrigger value="financials">Financial Details</TabsTrigger>
                </TabsList>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <span className="mr-2">✓</span> Complete Campaign
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Complete this campaign?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will mark the campaign as completed. All metrics and data will be final.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCompleteClick} className="bg-success hover:bg-success/90 text-white">
                        Complete Campaign
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </StickyHeader>
          
          <div className="px-16 py-8">
            <TabsContent value="summary" className="mt-0 p-0">
              <CampaignSummary 
                campaign={campaign}
                loadingLeads={loadingLeads}
                campaignLeads={campaignLeads}
                onCreateRequirement={handleCreateRequirementInternal}
                taskDetailContext={{ loadingSegments, campaignSegments }}
                segments={siteSegments}
                longDescription={longDescription}
                onEditCampaign={handleEditCampaign}
                onDeleteCampaign={handleDeleteCampaign}
                onUpdateCampaign={handleUpdateCampaign}
                onReloadLeads={() => loadCampaignLeads(campaign.id)}
              />
            </TabsContent>
            
            <TabsContent value="financials" className="mt-0 p-0">
              <FinancialDetails 
                campaign={campaign} 
                onUpdateCampaign={handleUpdateCampaign} 
              />
            </TabsContent>
          </div>
        </Tabs>
      </TaskDetailContext.Provider>
    </div>
  );
} 