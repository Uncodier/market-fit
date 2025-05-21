import React, { useState, useEffect, createContext } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { Label } from "@/app/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Input } from "@/app/components/ui/input"
import { BarChart, Loader, MoreHorizontal, User, Users } from "@/app/components/ui/icons"
import { getCampaignById } from "@/app/campaigns/actions/campaigns/read"
import { createSubtask } from "@/app/campaigns/actions/subtasks/create"
import { Revenue, Budget, Campaign } from "@/app/types"
import { SubtaskFormValues } from "@/app/components/add-subtask-dialog"
import { CampaignRequirementFormValues } from "@/app/components/create-requirement-dialog-for-campaign"
import { createRequirement } from "@/app/requirements/actions"
import { getLeadsByCampaignId } from "@/app/leads/actions"
import { Lead } from "@/app/leads/types"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { getSegments } from "@/app/segments/actions"
import { FinancialDetails, TaskDetailSkeleton } from "@/app/components/campaign-detail"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { CampaignDetailTabs } from "./campaign-detail-tabs"
import { CampaignRequirements } from "@/app/components/campaign-requirements"
import { AddCampaignLeadDialog } from "@/app/components/add-campaign-lead-dialog"

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
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showEditLeadDialog, setShowEditLeadDialog] = useState(false);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const convertedLeads = campaignLeads.filter(lead => lead.status === "converted");

  // Functions for lead management
  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setShowEditLeadDialog(true);
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
                        <Loader className="h-5 w-5 animate-spin mx-auto" />
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
                        <Loader className="h-5 w-5 animate-spin mx-auto" />
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
        {/* Campaign Overview Card */}
        <CampaignDetailTabs campaign={campaign}>
          <div className="space-y-6">
            {/* Campaign Title and Priority */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium">{campaign.title}</h3>
                <Badge className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${priorityColor[campaign.priority]}`}>
                  <span className="mr-1">•</span> {priorityLabels[campaign.priority] || "Unknown Relevance"}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                {campaignTypeLabels[campaign.type || "inbound"]?.icon || ""}{" "}
                {campaignTypeLabels[campaign.type || "inbound"]?.label || "Inbound Marketing"}
              </div>
            </div>

            {/* Description */}
            {campaign.description && (
              <div className="mt-4">
                <Label className="text-sm font-medium">Description</Label>
                <div className="mt-1.5 text-sm text-muted-foreground whitespace-pre-line">
                  {campaign.description}
                </div>
              </div>
            )}

            {/* Target Segments */}
            {campaign.segments && campaign.segments.length > 0 && (
              <div className="mt-4">
                <Label className="text-sm font-medium">Target Segments</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {taskDetailContext.loadingSegments ? (
                    <div className="flex items-center">
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
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

            {/* Outsource section */}
            {campaign.budget?.allocated && campaign.budget.allocated > 0 && (
              <div className="mt-8 space-y-6">
                <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                    Outsource Instructions
                  </h3>
                  
                  <div className="space-y-4 max-w-full">
                    {/* Budget highlighted section */}
                    <div className="bg-primary/10 p-3 rounded-md border border-primary/20">
                      <Label className="text-sm font-semibold text-primary flex items-center gap-2 mb-2">
                        <BarChart className="h-4 w-4" />
                        Budget
                      </Label>
                      <div className="text-lg font-bold text-center py-1">
                        {campaign.budget?.allocated ? `$${campaign.budget.allocated.toLocaleString()}` : "No budget specified"}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Instructions for Outsourcing</Label>
                      <div className="min-h-[150px] w-full resize-none text-sm bg-muted/20 p-3 rounded-md border">
                        {campaign.outsourceInstructions || 
                          "Implement this campaign according to the project specifications and timeline. Follow best practices for execution and reporting."}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Timeline</Label>
                      <div className="text-muted-foreground text-sm break-words bg-muted/40 p-2 rounded">
                        Please complete this campaign within the specified timeframe.
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Deliverables</Label>
                      <div className="text-muted-foreground text-sm bg-muted/40 p-2 rounded">
                        <ul className="list-disc pl-4 space-y-1 break-words">
                          <li>Complete implementation of the campaign strategy</li>
                          <li>Performance metrics and analytics</li>
                          <li>Final report with insights and recommendations</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Communication</Label>
                      <div className="text-muted-foreground text-sm break-words bg-muted/40 p-2 rounded">
                        Please provide regular updates on progress and any questions via the project management system.
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <Button className="w-full" onClick={() => router.push(`/outsource/checkout?campaignId=${campaign.id}`)}>
                    Outsource Campaign
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CampaignDetailTabs>
      </div>
      
      {/* Edit Lead Dialog */}
      {editingLead && (
        <Dialog open={showEditLeadDialog} onOpenChange={setShowEditLeadDialog}>
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingLead({ ...editingLead, name: e.target.value })}
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingLead({ ...editingLead, email: e.target.value })}
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