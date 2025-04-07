import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Button } from "@/app/components/ui/button"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { CampaignRequirements } from "@/app/components/campaign-requirements"
import { CampaignRequirementDialog } from "@/app/components/create-requirement-dialog-for-campaign"
import { PlusCircle, Pencil, Trash2, Check, X, User, Users, ClipboardList, MessageSquare, Phone } from "@/app/components/ui/icons"
import { AddCampaignLeadDialog } from "@/app/components/add-campaign-lead-dialog"
import { Lead } from "@/app/leads/types"
import ReactMarkdown from 'react-markdown'
import { createRequirement } from "@/app/requirements/actions"
import { createSubtask } from "@/app/control-center/actions/subtasks/create"
import { updateCampaign } from "@/app/control-center/actions/campaigns/update"
import type { SubtaskFormValues } from "@/app/components/add-subtask-dialog"
import type { CampaignRequirementFormValues } from "@/app/components/create-requirement-dialog-for-campaign"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
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
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Switch } from "@/app/components/ui/switch"
import { cn } from "@/lib/utils"
import { Campaign } from "@/app/types"
import { type CampaignFormValues } from "@/app/control-center/schema"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/app/components/ui/dialog"
import { useRouter } from "next/navigation"

// Constants for styling
const priorityColor: Record<string, string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  low: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
};

const priorityLabels: Record<string, string> = {
  high: "High Relevance",
  medium: "Medium Relevance",
  low: "Low Relevance"
};

// Campaign type labels with icons
const campaignTypeLabels: Record<string, { label: string, icon: string }> = {
  "inbound": { label: "Inbound Marketing", icon: "📥" },
  "outbound": { label: "Outbound Marketing", icon: "📤" },
  "branding": { label: "Branding", icon: "🎨" },
  "product": { label: "Product Marketing", icon: "📦" },
  "events": { label: "Events", icon: "🎪" },
  "success": { label: "Customer Success", icon: "🏆" },
  "account": { label: "Account-Based Marketing", icon: "👥" },
  "community": { label: "Community Marketing", icon: "🌐" },
  "guerrilla": { label: "Guerrilla Marketing", icon: "🦍" },
  "affiliate": { label: "Affiliate Marketing", icon: "🤝" },
  "experiential": { label: "Experiential Marketing", icon: "🎭" },
  "programmatic": { label: "Programmatic Advertising", icon: "🤖" },
  "performance": { label: "Performance Marketing", icon: "📈" },
  "publicRelations": { label: "Public Relations", icon: "📢" }
};

const sourceIcons: Record<string, string> = {
  "Website": "🌐",
  "Email Campaign": "✉️",
  "Social Media": "📱",
  "Referral": "👤",
  "Event": "📅"
};

const formatDateWithYear = (dateStr: string) => {
  return dateStr + ", 2023";
};

// Define context interface to export
export interface TaskDetailContextType {
  loadingSegments: boolean;
  campaignSegments: Array<{ id: string; name: string; description: string | null }>;
}

// Define props for CampaignSummary component
export interface CampaignSummaryProps {
  campaign: any;
  loadingLeads: boolean;
  campaignLeads: Lead[];
  onCreateRequirement: (values: CampaignRequirementFormValues) => Promise<{ data?: any; error?: string }>;
  taskDetailContext: TaskDetailContextType;
  segments: any[];
  longDescription: string;
  onEditCampaign?: () => void;
  onDeleteCampaign?: () => void;
  onUpdateCampaign?: (data: any) => void;
  onReloadLeads?: () => void;
}

export function CampaignSummary({ 
  campaign, 
  loadingLeads, 
  campaignLeads, 
  onCreateRequirement,
  taskDetailContext,
  segments,
  longDescription,
  onEditCampaign,
  onDeleteCampaign,
  onUpdateCampaign,
  onReloadLeads
}: CampaignSummaryProps) {
  const router = useRouter();
  const { loadingSegments, campaignSegments } = taskDetailContext;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showEditLeadDialog, setShowEditLeadDialog] = useState(false);
  const [editedCampaign, setEditedCampaign] = useState({
    title: campaign.title,
    description: campaign.description || "",
    priority: campaign.priority,
    dueDate: campaign.dueDate,
    segments: campaign.segments || [],
    type: campaign.type || "inbound"
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<Array<string | { id: string; name: string }>>(() => {
    if (campaign.segmentObjects && Array.isArray(campaign.segmentObjects) && campaign.segmentObjects.length > 0) {
      console.log("[Init] Using segmentObjects:", campaign.segmentObjects);
      return campaign.segmentObjects;
    }
    
    if (campaign.segments && Array.isArray(campaign.segments) && campaign.segments.length > 0) {
      console.log("[Init] Converting segments to objects:", campaign.segments);
      return campaign.segments.map((id: string) => {
        const knownSegment = segments.find(s => s.id === id);
        return { 
          id, 
          name: knownSegment?.name || getSegmentNameById(id) || 'Unknown Segment'
        };
      });
    }
    
    console.log("[Init] No segments data found, initializing empty array");
    return [];
  });
  
  useEffect(() => {
    if (campaign.segmentObjects && Array.isArray(campaign.segmentObjects) && campaign.segmentObjects.length > 0) {
      console.log("[Effect] Updating from segmentObjects:", campaign.segmentObjects);
      setSelectedSegments(campaign.segmentObjects);
    } else if (campaign.segments && Array.isArray(campaign.segments) && campaign.segments.length > 0) {
      console.log("[Effect] Updating from segments:", campaign.segments);
      setSelectedSegments(campaign.segments.map((id: string) => {
        const knownSegment = segments.find(s => s.id === id);
        return { 
          id, 
          name: knownSegment?.name || getSegmentNameById(id) || 'Unknown Segment'
        };
      }));
    }
  }, [campaign.segments, campaign.segmentObjects, segments]);
  
  const handleDeleteCampaign = () => {
    if (onDeleteCampaign) {
      onDeleteCampaign();
    }
    setShowDeleteDialog(false);
  };
  
  const handleAddSubtask = async (values: SubtaskFormValues): Promise<{ data?: any; error?: string }> => {
    try {
      const result = await createSubtask({
        campaignId: values.campaignId,
        title: values.title,
        status: values.status
      });
      
      return { 
        data: result.data, 
        error: result.error as string | undefined 
      };
    } catch (error) {
      console.error("Error adding subtask:", error);
      return { data: null, error: error instanceof Error ? error.message : "An unknown error occurred" };
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // If we're currently editing, this will cancel the edit
      setEditedCampaign({
        title: campaign.title,
        description: campaign.description || "",
        priority: campaign.priority,
        dueDate: campaign.dueDate,
        segments: Array.isArray(campaign.segments) ? [...campaign.segments] : [],
        type: campaign.type || "inbound"
      });
    } else {
      // Starting edit mode - ensure campaign.segments is properly initialized
      console.log("Starting edit mode, campaign segments:", campaign.segments);
      setEditedCampaign({
        title: campaign.title,
        description: campaign.description || "",
        priority: campaign.priority,
        dueDate: campaign.dueDate,
        segments: Array.isArray(campaign.segments) ? [...campaign.segments] : [],
        type: campaign.type || "inbound"
      });
    }
    setIsEditing(!isEditing);
  };

  const handleSegmentToggle = (segmentId: string, segmentName: string, forcedValue?: boolean) => {
    console.log(`Toggle segment ${segmentId} (${segmentName})`, forcedValue !== undefined ? `to ${forcedValue}` : '');
    
    setSelectedSegments((prev) => {
      // Check if we already have this segment
      const existingIndex = prev.findIndex(segment => 
        typeof segment === 'object' 
          ? segment.id === segmentId 
          : segment === segmentId
      );
      
      // If forcedValue is provided, use it directly
      const shouldAdd = forcedValue !== undefined ? forcedValue : existingIndex < 0;
      
      if (shouldAdd && existingIndex < 0) {
        // Add new segment object with id and name
        console.log(`Adding segment ${segmentId} (${segmentName})`);
        return [...prev, { id: segmentId, name: segmentName }];
      } else if (!shouldAdd && existingIndex >= 0) {
        // Remove segment if it exists
        console.log(`Removing segment ${segmentId}`);
        return prev.filter((_, i) => i !== existingIndex);
      }
      
      // No change needed
      return prev;
    });
  };

  const handleSaveChanges = async () => {
    if (!campaign) return;
    
    setIsSubmitting(true);
    try {
      // Filtrar segmentos para eliminar los mock (con 's-')
      const realSegments = selectedSegments.filter(segment => {
        const id = typeof segment === 'object' ? segment.id : segment;
        return !id.startsWith('s-');
      });
      
      // Prepare form data
      const formData: Partial<CampaignFormValues> = {
        title: editedCampaign.title,
        description: editedCampaign.description,
        priority: editedCampaign.priority as "high" | "medium" | "low",
        dueDate: editedCampaign.dueDate,
        type: editedCampaign.type,
        segments: realSegments.map(segment => 
          typeof segment === 'object' ? segment.id : segment
        ),
        segmentObjects: realSegments.map(segment => 
          typeof segment === 'object' 
            ? segment 
            : { id: segment, name: 'Unknown Segment' }
        ),
      };
      
      // For logging purposes
      console.log("Saving campaign with real segments only:", 
        formData.segments, 
        "and segment objects:", 
        formData.segmentObjects
      );
      
      const result = await updateCampaign(campaign.id, formData);
      
      if (result.error) {
        console.error(`Error updating campaign: ${result.error}`);
        toast.error(`Failed to update campaign: ${result.error}`);
        return;
      }
      
      // Update local state with the returned data
      if (result.data) {
        // Use the correct setter for editedCampaign
        setEditedCampaign({
          ...editedCampaign,
          ...result.data,
        });
        
        // Make sure to update selectedSegments with returned segment objects if available
        if (result.data.segmentObjects) {
          setSelectedSegments(result.data.segmentObjects);
        } else if (result.data.segments) {
          // If no segment objects but we have segment IDs, convert to objects
          setSelectedSegments(result.data.segments.map(id => 
            ({ id, name: getSegmentNameById(id) || 'Unknown Segment' })
          ));
        }
      }
      
      // Exit edit mode
      setIsEditing(false);
      toast.success("Campaign updated successfully");
    } catch (err) {
      console.error("Error updating campaign:", err);
      toast.error("Failed to update campaign");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditedCampaign((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setEditedCampaign((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // Function to get segment name by ID, useful when we only have IDs
  const getSegmentNameById = (segmentId: string): string => {
    // Skip mock segment IDs (starting with 's-')
    if (segmentId.startsWith('s-')) {
      return ''; // Return empty string for mock segments
    }

    // First check if the ID exists in the segments array (site data)
    const siteSegment = segments.find(s => s.id === segmentId);
    if (siteSegment) return siteSegment.name;
    
    // Then check if it's in the campaignSegments
    const campaignSegment = campaignSegments.find(s => s.id === segmentId);
    if (campaignSegment) return campaignSegment.name;
    
    // If no match is found, return a more user-friendly ID
    return `Segment ${segmentId.substring(0, 8)}`;
  };

  // Functions for lead management
  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setShowEditLeadDialog(true);
  };

  const handleDeleteLead = (lead: Lead) => {
    // Implementar eliminación de lead
    toast.success(`Lead ${lead.name} deleted successfully`);
    if (onReloadLeads) {
      onReloadLeads();
    }
  };

  const navigateToLeadProfile = (leadId: string, e: React.MouseEvent) => {
    // Prevenir la navegación si se hizo clic en elementos interactivos como botones o menús
    if (
      (e.target as HTMLElement).closest('button') || 
      (e.target as HTMLElement).closest('[role="menuitem"]') ||
      (e.target as HTMLElement).closest('[data-radix-collection-item]')
    ) {
      return;
    }
    router.push(`/leads/${leadId}`);
  };

  const isSegmentSelected = (segmentId: string) => {
    // Debug to track which segments are selected
    console.log(`Checking if segment ${segmentId} is selected in:`, 
      selectedSegments.map(s => typeof s === 'object' ? s.id : s)
    );
    
    return selectedSegments.some(segment => 
      typeof segment === 'object' 
        ? segment.id === segmentId 
        : segment === segmentId
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-10 gap-6">
      {/* Left side: Requirements, Leads, Clients - 60% */}
      <div className="md:col-span-6 space-y-6 order-2 md:order-1">
        {/* Requirements Card */}
        <CampaignRequirements 
          campaignId={campaign.id}
          renderAddButton={() => (
            <CampaignRequirementDialog
              campaignId={campaign.id}
              onCreateRequirement={onCreateRequirement}
              trigger={
                <Button variant="outline" size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Requirement
                </Button>
              }
            />
          )}
        />
        
        {/* Generated Leads Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Generated Leads</h3>
              <AddCampaignLeadDialog
                campaignId={campaign.id}
                segments={segments}
                onLeadCreated={onReloadLeads}
                trigger={
                  <Button variant="outline" size="sm">
                    <User className="mr-2 h-4 w-4" />
                    Add Lead
                  </Button>
                }
              />
            </div>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full">
                <colgroup>
                  <col className="w-[25%]" />
                  <col className="w-[16.6%]" />
                  <col className="w-[16.6%]" />
                  <col className="w-[16.6%]" />
                  <col className="w-[16.6%]" />
                  <col className="w-[8.3%]" />
                </colgroup>
                <thead>
                  <tr className="bg-muted/30">
                    <th className="p-3 text-sm font-medium text-muted-foreground text-left">Name</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground text-left">Email</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground text-left">Phone</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground text-left">Status</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground text-left">Date Added</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLeads ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                          <span className="text-muted-foreground">Loading leads...</span>
                        </div>
                      </td>
                    </tr>
                  ) : campaignLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center">
                        <EmptyCard
                          icon={<User className="h-8 w-8 text-muted-foreground" />}
                          title="No leads found"
                          description="No leads found for this campaign"
                          className="border-none shadow-none"
                          contentClassName="py-4"
                        />
                      </td>
                    </tr>
                  ) : (
                    campaignLeads
                      .filter(lead => lead.status !== "converted")
                      .map(lead => (
                        <tr 
                          key={lead.id} 
                          className="hover:bg-muted/20 transition-colors border-t cursor-pointer" 
                          onClick={(e) => navigateToLeadProfile(lead.id, e)}
                        >
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{lead.name}</span>
                              {lead.company?.name && <span className="text-xs text-muted-foreground">Company: {lead.company.name}</span>}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-xs text-muted-foreground">{lead.email || "-"}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-xs text-muted-foreground">{lead.phone || "-"}</span>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="capitalize">{lead.status}</Badge>
                          </td>
                          <td className="p-3">
                            <span className="text-sm">{new Date(lead.created_at).toLocaleDateString()}</span>
                          </td>
                          <td className="p-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <span className="text-base leading-none">⋮</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditLead(lead)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit Lead
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteLead(lead)} className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Lead
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        
        {/* Converted Clients Card */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-4">Converted Clients</h3>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full">
                <colgroup>
                  <col className="w-[25%]" />
                  <col className="w-[16.6%]" />
                  <col className="w-[16.6%]" />
                  <col className="w-[16.6%]" />
                  <col className="w-[16.6%]" />
                  <col className="w-[8.3%]" />
                </colgroup>
                <thead>
                  <tr className="bg-muted/30">
                    <th className="p-3 text-sm font-medium text-muted-foreground text-left">Name</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground text-left">Email</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground text-left">Phone</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground text-left">Value</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground text-left">Date Converted</th>
                    <th className="p-3 text-sm font-medium text-muted-foreground text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {loadingLeads ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                          <span className="text-muted-foreground">Loading clients...</span>
                        </div>
                      </td>
                    </tr>
                  ) : campaignLeads.filter(lead => lead.status === "converted").length > 0 ? (
                    campaignLeads
                      .filter(lead => lead.status === "converted")
                      .map(lead => (
                        <tr 
                          key={lead.id} 
                          className="hover:bg-muted/20 transition-colors border-t cursor-pointer" 
                          onClick={(e) => navigateToLeadProfile(lead.id, e)}
                        >
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{lead.name}</span>
                              {lead.company?.name && <span className="text-xs text-muted-foreground">Company: {lead.company.name}</span>}
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-xs text-muted-foreground">{lead.email || "-"}</span>
                          </td>
                          <td className="p-3">
                            <span className="text-xs text-muted-foreground">{lead.phone || "-"}</span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center">
                              <span className="font-medium">$8,500</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="text-sm">{new Date(lead.created_at).toLocaleDateString()}</span>
                          </td>
                          <td className="p-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <span className="text-base leading-none">⋮</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditLead(lead)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit Client
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteLead(lead)} className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Client
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-center">
                        <EmptyCard
                          icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
                          title="No converted clients"
                          description="No converted clients yet"
                          className="border-none shadow-none" 
                          contentClassName="py-4"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Right side: Campaign Overview - 40% */}
      <div className="md:col-span-4 order-1 md:order-2 space-y-6">
        {/* Campaign Overview Card */}
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                {isEditing ? (
                  <div className="space-y-3 w-full">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input 
                        id="title"
                        name="title"
                        value={editedCampaign.title}
                        onChange={handleInputChange}
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="priority">Relevance</Label>
                        <Select 
                          value={editedCampaign.priority}
                          onValueChange={(value) => handleSelectChange("priority", value)}
                        >
                          <SelectTrigger id="priority" className="w-full">
                            <SelectValue placeholder="Select relevance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High Relevance</SelectItem>
                            <SelectItem value="medium">Medium Relevance</SelectItem>
                            <SelectItem value="low">Low Relevance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="type">Campaign Type</Label>
                        <Select 
                          value={editedCampaign.type}
                          onValueChange={(value) => handleSelectChange("type", value)}
                        >
                          <SelectTrigger id="type" className="w-full">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(campaignTypeLabels).map(([value, { label }]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium">{campaign.title}</h3>
                      <Badge className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityColor[campaign.priority]}`}>
                        <span className="mr-1">•</span> {priorityLabels[campaign.priority] || "Unknown Relevance"}
                      </Badge>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  {isEditing ? (
                    <></>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <span className="text-base leading-none">⋮</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleEditToggle}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Campaign
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setShowDeleteDialog(true)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Campaign
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-1 border rounded-md p-3 bg-muted/5 hover:bg-muted/10 transition-colors">
                  <div className="text-xs text-muted-foreground">Start Date</div>
                  <div className="font-medium mt-1">Oct 1, 2023</div>
                </div>
                <div className="col-span-1 border rounded-md p-3 bg-muted/5 hover:bg-muted/10 transition-colors">
                  <div className="text-xs text-muted-foreground">Due Date</div>
                  {isEditing ? (
                    <Input 
                      type="date"
                      name="dueDate"
                      value={editedCampaign.dueDate}
                      onChange={handleInputChange}
                      className="mt-1 h-7 text-sm"
                    />
                  ) : (
                    <div className="font-medium mt-1">{formatDateWithYear(campaign.dueDate)}</div>
                  )}
                </div>
                {/* Campaign Status Widget */}
                <div className="col-span-1 border rounded-md p-3 bg-muted/5 hover:bg-muted/10 transition-colors">
                  <div className="text-xs text-muted-foreground">Status</div>
                  {/* Assuming campaign.status exists. Needs adjustment if status comes from elsewhere */}
                  <div className="font-medium mt-1 capitalize">{campaign.status || 'Not Set'}</div>
                </div>
                {/* Campaign Type Widget */}
                <div className="col-span-1 border rounded-md p-3 bg-muted/5 hover:bg-muted/10 transition-colors">
                  <div className="text-xs text-muted-foreground">Type</div>
                  <div className="font-medium mt-1">
                    {campaignTypeLabels[campaign.type || "inbound"]?.icon || ""}{" "}
                    {campaignTypeLabels[campaign.type || "inbound"]?.label || "Inbound Marketing"}
                  </div>
                </div>
                <div className="col-span-1 border rounded-md p-3 bg-muted/5 hover:bg-muted/10 transition-colors">
                  <div className="text-xs text-muted-foreground">Assignees</div>
                  <div className="flex items-center mt-1">
                    <span className="font-medium mr-2">{campaign.assignees}</span>
                    <span className="text-xs text-muted-foreground">team members</span>
                  </div>
                </div>
                <div className="col-span-1 border rounded-md p-3 bg-muted/5 hover:bg-muted/10 transition-colors">
                  <div className="text-xs text-muted-foreground">Issues</div>
                  <div className="flex items-center mt-1">
                    <span className="font-medium mr-2">{campaign.issues}</span>
                    <span className="text-xs text-muted-foreground">open issues</span>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium mb-2">Target Segments</div>
                {isEditing ? (
                  <div className="relative">
                    <ScrollArea className="h-[150px] rounded-md border">
                      <div className="p-4">
                        {segments.length > 0 ? (
                          // Filtrar para mostrar solo segmentos reales (no los mock que comienzan con 's-')
                          segments
                            .filter(segment => !segment.id.startsWith('s-'))
                            .map((segment) => {
                              const isSelected = isSegmentSelected(segment.id);
                              
                              console.log(`Segment ${segment.id} (${segment.name}): isSelected=${isSelected}`);
                              
                              return (
                                <div 
                                  key={segment.id} 
                                  className={cn(
                                    "flex items-center justify-between space-x-3 space-y-0 rounded-lg border p-4 mb-2 last:mb-0",
                                    "transition-colors hover:bg-muted/50 cursor-pointer",
                                    isSelected ? "border-primary/50 bg-primary/5" : ""
                                  )}
                                  onClick={() => handleSegmentToggle(segment.id, segment.name, !isSelected)}
                                >
                                  <div className="grid gap-1.5 leading-none">
                                    <label
                                      htmlFor={`segment-${segment.id}`}
                                      className="text-sm font-medium leading-none cursor-pointer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {segment.name}
                                    </label>
                                    <span className="text-xs text-muted-foreground">
                                      Site segment
                                    </span>
                                  </div>
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <Switch
                                      id={`segment-${segment.id}`}
                                      checked={isSelected}
                                      onCheckedChange={(checked) => handleSegmentToggle(segment.id, segment.name, checked)}
                                    />
                                  </div>
                                </div>
                              );
                            })
                        ) : (
                          <div className="p-4 text-center">
                            <p className="text-sm text-muted-foreground">No segments available</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {loadingSegments ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                        <span className="text-xs text-muted-foreground">Loading segments...</span>
                      </div>
                    ) : campaignSegments.length > 0 ? (
                      // Display segments from campaignSegments array (objects with name)
                      campaignSegments.map(segment => (
                        <Badge 
                          key={segment.id} 
                          variant="outline" 
                          className="py-1.5 px-4 rounded-full bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors border-muted"
                        >
                          {segment.name}
                        </Badge>
                      ))
                    ) : campaign.segmentObjects && Array.isArray(campaign.segmentObjects) && campaign.segmentObjects.length > 0 ? (
                      // If we have segment objects directly in the campaign
                      campaign.segmentObjects.map((segment: {id: string, name: string}) => (
                        <Badge 
                          key={segment.id}
                          variant="outline" 
                          className="py-1.5 px-4 rounded-full bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors border-muted"
                        >
                          {segment.name}
                        </Badge>
                      ))
                    ) : campaign.segments && Array.isArray(campaign.segments) && campaign.segments.length > 0 ? (
                      // Fallback for when we only have segment IDs
                      campaign.segments.map((segmentId: string) => (
                        <Badge 
                          key={segmentId}
                          variant="outline" 
                          className="py-1.5 px-4 rounded-full bg-muted/20 hover:bg-muted/30 cursor-pointer transition-colors border-muted"
                        >
                          {getSegmentNameById(segmentId)}
                        </Badge>
                      ))
                    ) : (
                      <EmptyCard
                        icon={<Users className="h-6 w-6 text-muted-foreground" />}
                        title="No segments assigned"
                        description="This campaign doesn't have any segments assigned yet"
                        className="border-none shadow-none w-full py-2" 
                        contentClassName="py-2"
                      />
                    )}
                  </div>
                )}
              </div>
              
              <div>
                <div className="text-sm font-medium mb-2">Campaign Description</div>
                {isEditing ? (
                  <>
                    <Textarea 
                      name="description"
                      value={editedCampaign.description}
                      onChange={handleInputChange}
                      className="min-h-[150px]"
                      placeholder="Enter campaign description..."
                    />
                    <div className="flex justify-end mt-4 space-x-2">
                      <Button 
                        variant="outline" 
                        onClick={handleEditToggle}
                        disabled={isSubmitting}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button 
                        variant="default" 
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        onClick={handleSaveChanges}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? 
                          <span className="flex items-center"><span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent"></span> Saving</span> : 
                          <span className="flex items-center"><Check className="mr-2 h-4 w-4" /> Save</span>
                        }
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-medium prose-p:leading-relaxed prose-pre:bg-muted">
                    <ReactMarkdown>{campaign.description || "No description provided for this campaign."}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Delete Campaign Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the campaign and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCampaign} className="bg-red-600 hover:bg-red-700 text-white">
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Lead Dialog */}
      {editingLead && (
        <Dialog open={showEditLeadDialog} onOpenChange={setShowEditLeadDialog}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Edit Lead</DialogTitle>
              <DialogDescription>
                Update lead information below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-name"
                      value={editingLead.name}
                      className="h-12 pl-9"
                      onChange={(e) => setEditingLead({...editingLead, name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-email"
                      type="email"
                      value={editingLead.email}
                      className="h-12 pl-9"
                      onChange={(e) => setEditingLead({...editingLead, email: e.target.value})}
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="edit-phone"
                      type="tel"
                      value={editingLead.phone || ""}
                      className="h-12 pl-9"
                      onChange={(e) => setEditingLead({...editingLead, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editingLead.status}
                    onValueChange={(value: any) => setEditingLead({...editingLead, status: value})}
                  >
                    <SelectTrigger id="edit-status" className="h-12">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditLeadDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                toast.success(`Lead "${editingLead.name}" updated successfully`);
                setShowEditLeadDialog(false);
                if (onReloadLeads) {
                  onReloadLeads();
                }
              }}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 