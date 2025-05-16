import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Button } from "@/app/components/ui/button"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { CampaignRequirements } from "@/app/components/campaign-requirements"
import { CampaignRequirementDialog } from "@/app/components/create-requirement-dialog-for-campaign"
import { PlusCircle, Pencil, Trash2, Check, X, User, Users, ClipboardList, MessageSquare, Phone, MoreVertical, MoreHorizontal, Settings, Loader as Loader2, Globe as Globe, Plus } from "@/app/components/ui/icons"
import { AddCampaignLeadDialog } from "@/app/components/add-campaign-lead-dialog"
import { Lead } from "@/app/leads/types"
import ReactMarkdown from 'react-markdown'
import { createRequirement } from "@/app/requirements/actions"
import { createSubtask } from "@/app/campaigns/actions/subtasks/create"
import { updateCampaign } from "@/app/campaigns/actions/campaigns/update"
import type { SubtaskFormValues } from "@/app/components/add-subtask-dialog"
import type { CampaignRequirementFormValues } from "@/app/components/create-requirement-dialog-for-campaign"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
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
import { Checkbox } from "@/app/components/ui/checkbox"
import { toast } from "sonner"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Switch } from "@/app/components/ui/switch"
import { cn } from "@/lib/utils"
import { Campaign } from "@/app/types"
import { type CampaignFormValues } from "@/app/campaigns/schema"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/app/components/ui/dialog"
import { useRouter } from "next/navigation"
import { CampaignDetailTabs } from './campaign-detail-tabs'

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

// Helper functions for lead status formatting
const getLeadStatusStyles = (status: string): string => {
  switch (status) {
    case "new": 
      return "bg-blue-100 text-blue-800 hover:bg-blue-200 border border-blue-200";
    case "contacted": 
      return "bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-200";
    case "qualified": 
      return "bg-green-100 text-green-800 hover:bg-green-200 border border-green-200";
    case "proposal": 
      return "bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200";
    case "negotiation": 
      return "bg-orange-100 text-orange-800 hover:bg-orange-200 border border-orange-200";
    case "converted": 
      return "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-200";
    case "lost": 
      return "bg-red-100 text-red-800 hover:bg-red-200 border border-red-200";
    default: 
      return "bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200";
  }
};

const getLeadStatusLabel = (status: string): string => {
  switch (status) {
    case "new": return "New";
    case "contacted": return "Contacted";
    case "qualified": return "Qualified";
    case "proposal": return "Proposal";
    case "negotiation": return "Negotiation";
    case "converted": return "Converted";
    case "lost": return "Lost";
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
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
  campaignRequirements?: any[];
  loadingRequirements?: boolean;
  onReloadRequirements?: () => void;
}

// formatCurrency function
const formatCurrency = (amount: number, currency: string = "USD"): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(amount);
};

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
  onReloadLeads,
  campaignRequirements = [],
  loadingRequirements = false,
  onReloadRequirements
}: CampaignSummaryProps) {
  const router = useRouter();
  const { loadingSegments, campaignSegments } = taskDetailContext;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showEditLeadDialog, setShowEditLeadDialog] = useState(false);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const convertedLeads = campaignLeads.filter(lead => lead.status === "converted");
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
  
  // Debug log para ver los requirements que llegan
  useEffect(() => {
    console.log("CampaignSummary received requirements:", {
      count: campaignRequirements?.length || 0,
      requirements: campaignRequirements
    });
  }, [campaignRequirements]);
  
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

  const handleSaveEditedLead = () => {
    if (!editingLead) return;
    
    toast.success(`Lead "${editingLead.name}" updated successfully`);
    setIsEditingLead(false);
    
    if (onReloadLeads) {
      onReloadLeads();
    }
  };

  return (
    <div className="grid grid-cols-5 gap-8">
      {/* Tables area - 60% */}
      <div className="col-span-3 space-y-8">
        {/* Requirements Component - sin card redundante */}
        <CampaignRequirements 
          campaignId={campaign.id} 
          externalRequirements={campaignRequirements}
          externalLoading={loadingRequirements}
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
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        <div className="mt-2 text-sm text-muted-foreground">Loading leads...</div>
                      </td>
                    </tr>
                  ) : campaignLeads && campaignLeads.length > 0 ? (
                    campaignLeads.map((lead, index) => (
                      <tr key={lead.id || index} className={index % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                        <td className="p-3 text-sm">
                          <div className="font-medium">{lead.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {typeof lead.company === 'object' && lead.company?.name 
                              ? lead.company.name 
                              : (typeof lead.company === 'string' ? lead.company : "")}
                          </div>
                        </td>
                        <td className="p-3 text-sm">{lead.email || "—"}</td>
                        <td className="p-3 text-sm">{lead.phone || "—"}</td>
                        <td className="p-3 text-sm">
                          <Badge className={getLeadStatusStyles(lead.status)}>
                            {getLeadStatusLabel(lead.status)}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm">
                          {lead.created_at 
                            ? new Date(lead.created_at).toLocaleDateString() 
                            : "—"}
                        </td>
                        <td className="p-3 text-sm text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditLead(lead)}>
                            <span className="sr-only">Edit</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-center">
                        <div className="py-6">
                          <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <h3 className="text-sm font-medium mb-1">No leads yet</h3>
                          <p className="text-sm text-muted-foreground">
                            Add your first lead to start tracking potential customers for this campaign.
                          </p>
                        </div>
                      </td>
                    </tr>
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
                  {/* Display converted leads (status === "converted") */}
                  {loadingLeads ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        <div className="mt-2 text-sm text-muted-foreground">Loading converted clients...</div>
                      </td>
                    </tr>
                  ) : convertedLeads && convertedLeads.length > 0 ? (
                    convertedLeads.map((lead, index) => (
                      <tr key={lead.id || index} className={index % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                        <td className="p-3 text-sm">
                          <div className="font-medium">{lead.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {typeof lead.company === 'object' && lead.company?.name 
                              ? lead.company.name 
                              : (typeof lead.company === 'string' ? lead.company : "")}
                          </div>
                        </td>
                        <td className="p-3 text-sm">{lead.email || "—"}</td>
                        <td className="p-3 text-sm">{lead.phone || "—"}</td>
                        <td className="p-3 text-sm font-medium text-success">
                          {formatCurrency((lead as any).value || 0, "USD")}
                        </td>
                        <td className="p-3 text-sm">
                          {lead.created_at 
                            ? new Date(lead.created_at).toLocaleDateString() 
                            : "—"}
                        </td>
                        <td className="p-3 text-sm text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditLead(lead)}>
                            <span className="sr-only">Edit</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-4 text-center">
                        <div className="py-6">
                          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                          <h3 className="text-sm font-medium mb-1">No clients yet</h3>
                          <p className="text-sm text-muted-foreground">
                            Update leads to "Converted" status when they become clients.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Card with Tabs - 40% */}
      <div className="col-span-2">
        {/* Campaign Overview Card with Tabs */}
        <CampaignDetailTabs campaign={campaign}>
          {/* Details tab content */}
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
                  <>
                    <Button variant="outline" onClick={handleEditToggle}>Cancel</Button>
                    <Button onClick={handleSaveChanges}>Save Changes</Button>
                  </>
                ) : (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleEditToggle}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Campaign
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onEditCampaign}>
                          <Settings className="mr-2 h-4 w-4" />
                          Advanced Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Campaign
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </div>
            
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description"
                    name="description"
                    value={editedCampaign.description}
                    onChange={handleInputChange}
                    className="mt-1 min-h-[150px]"
                    placeholder="Enter a description for this campaign..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="dueDate">Due Date (Optional)</Label>
                  <Input 
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    value={editedCampaign.dueDate || ""}
                    onChange={handleInputChange}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="segments">Target Segments</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {segments.map(segment => (
                      <div key={segment.id} className="inline-flex">
                        <Checkbox 
                          id={`segment-${segment.id}`}
                          checked={editedCampaign.segments.includes(segment.id)}
                          onCheckedChange={(checked: boolean) => handleSegmentToggle(segment.id, segment.name, !!checked)}
                          className="mr-2"
                        />
                        <Label htmlFor={`segment-${segment.id}`} className="text-sm cursor-pointer">
                          {segment.name}
                        </Label>
                      </div>
                    ))}
                    {segments.length === 0 && (
                      <div className="text-sm text-muted-foreground">
                        No segments available. <Link href="/segments" className="text-primary hover:underline">Create segments</Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4 mt-6">
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
            )}
            
            {!isEditing && campaign.description && (
              <div className="mt-4">
                <Label className="text-sm font-medium">Description</Label>
                <div className="mt-1.5 text-sm text-muted-foreground whitespace-pre-line">
                  {campaign.description}
                </div>
              </div>
            )}
            
            {!isEditing && campaign.segments && campaign.segments.length > 0 && (
              <div className="mt-4">
                <Label className="text-sm font-medium">Target Segments</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {taskDetailContext.loadingSegments ? (
                    <div className="flex items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Loading segments...</span>
                    </div>
                  ) : taskDetailContext.campaignSegments && taskDetailContext.campaignSegments.length > 0 ? (
                    taskDetailContext.campaignSegments.map(segment => (
                      <Badge key={segment.id} variant="outline" className="bg-muted/50">
                        {segment.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No segments assigned</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </CampaignDetailTabs>
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
        <Dialog open={isEditingLead} onOpenChange={() => setIsEditingLead(false)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Lead</DialogTitle>
              <DialogDescription>
                Make changes to the lead information.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={editingLead.name}
                  onChange={(e) => setEditingLead({ ...editingLead, name: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="email" className="text-right">
                  Email
                </Label>
                <Input
                  id="email"
                  value={editingLead.email || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, email: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Select
                  value={editingLead.status as "new" | "contacted" | "qualified" | "converted" | "lost"}
                  onValueChange={(value: "new" | "contacted" | "qualified" | "converted" | "lost") => 
                    setEditingLead({ ...editingLead, status: value })}
                >
                  <SelectTrigger className="col-span-3">
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
            <DialogFooter>
              <Button type="submit" onClick={handleSaveEditedLead}>Save changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 