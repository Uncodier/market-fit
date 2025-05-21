"use client"

import { useState, RefObject } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { Campaign, CampaignType, CampaignStatus, CampaignPriority } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { AlertTriangle, Trash2, DollarSign, CalendarIcon, Tag, ChevronDown } from "@/app/components/ui/icons"
import { DatePicker } from "@/app/components/ui/date-picker"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Switch } from "@/app/components/ui/switch"
import { cn } from "@/lib/utils"
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/components/ui/collapsible"

interface CampaignDetailsProps {
  campaign: Campaign;
  onUpdateCampaign: (updatedCampaign: Campaign) => void;
  onDeleteCampaign?: () => void;
  formRef: RefObject<HTMLFormElement>;
  segments: Array<{ id: string; name: string; description?: string | null }>;
}

export function CampaignDetails({ campaign, onUpdateCampaign, onDeleteCampaign, formRef, segments }: CampaignDetailsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSegmentsOpen, setIsSegmentsOpen] = useState(true);
  const [formData, setFormData] = useState({
    title: campaign.title,
    description: campaign.description || "",
    type: campaign.type || "inbound" as CampaignType,
    status: campaign.status as CampaignStatus,
    priority: (campaign.priority || "medium") as CampaignPriority,
    dueDate: campaign.dueDate || new Date().toISOString(),
    budget: {
      allocated: campaign.budget?.allocated || 0,
      remaining: campaign.budget?.remaining || 0,
      currency: campaign.budget?.currency || "USD"
    },
    revenue: {
      actual: campaign.revenue?.actual || 0,
      projected: campaign.revenue?.projected || 0,
      estimated: campaign.revenue?.estimated || 0,
      currency: campaign.revenue?.currency || "USD"
    },
    segments: campaign.segments || [],
    segmentObjects: campaign.segmentObjects || []
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Update campaign with form data
      const updatedCampaign = {
        ...campaign,
        ...formData
      }
      
      onUpdateCampaign(updatedCampaign)
      toast.success("Campaign updated successfully")
    } catch (error) {
      console.error('Error updating campaign:', error)
      toast.error("Failed to update campaign")
    }
  }

  const handleSegmentToggle = (segmentId: string, segmentName: string, checked: boolean) => {
    setFormData(prev => {
      const newSegments = checked 
        ? [...prev.segments, segmentId]
        : prev.segments.filter(id => id !== segmentId);
      
      const newSegmentObjects = checked
        ? [...prev.segmentObjects, { id: segmentId, name: segmentName }]
        : prev.segmentObjects.filter(obj => obj.id !== segmentId);

      return {
        ...prev,
        segments: newSegments,
        segmentObjects: newSegmentObjects
      };
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 max-w-3xl mx-auto">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>
            Edit the basic details of your campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter campaign title"
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter campaign description"
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value: CampaignType) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inbound">Inbound</SelectItem>
                <SelectItem value="outbound">Outbound</SelectItem>
                <SelectItem value="branding">Branding</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="events">Events</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="account">Account</SelectItem>
                <SelectItem value="community">Community</SelectItem>
                <SelectItem value="guerrilla">Guerrilla</SelectItem>
                <SelectItem value="affiliate">Affiliate</SelectItem>
                <SelectItem value="experiential">Experiential</SelectItem>
                <SelectItem value="programmatic">Programmatic</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="publicRelations">Public Relations</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="due-date" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              Due Date
            </Label>
            <DatePicker
              date={new Date(formData.dueDate)}
              setDate={(date) => setFormData({ ...formData, dueDate: date.toISOString() })}
              className="h-12"
              mode="task"
            />
          </div>
        </CardContent>
      </Card>

      {/* Target Segments */}
      <Collapsible open={isSegmentsOpen} onOpenChange={setIsSegmentsOpen}>
        <Card>
          <CardHeader className="pb-0">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between w-full cursor-pointer py-2">
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5 text-primary" />
                  Target Segments
                </CardTitle>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  isSegmentsOpen ? "transform rotate-180" : ""
                )} />
              </div>
            </CollapsibleTrigger>
            <CardDescription className="pb-4">
              Select the target segments for this campaign
            </CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="rounded-md border">
                <div className="p-4 space-y-2">
                  {segments.length > 0 ? (
                    segments.map((segment) => {
                      const isSelected = formData.segments.includes(segment.id);
                      
                      return (
                        <div 
                          key={segment.id} 
                          className={cn(
                            "flex items-center justify-between space-x-3 space-y-0 rounded-lg border p-4",
                            "transition-colors hover:bg-muted/50",
                            isSelected ? "border-primary/50 bg-primary/5" : ""
                          )}
                        >
                          <div className="grid gap-1.5 leading-none">
                            <label
                              htmlFor={`segment-${segment.id}`}
                              className="text-sm font-medium leading-none cursor-pointer"
                            >
                              {segment.name}
                            </label>
                            {segment.description && (
                              <p className="text-sm text-muted-foreground">
                                {segment.description}
                              </p>
                            )}
                          </div>
                          <Switch
                            id={`segment-${segment.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => handleSegmentToggle(segment.id, segment.name, checked)}
                          />
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center">
                      <p className="text-sm text-muted-foreground">No segments available</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Status and Priority */}
      <Card>
        <CardHeader>
          <CardTitle>Status and Priority</CardTitle>
          <CardDescription>
            Update the current status and priority of your campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value: CampaignStatus) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select 
              value={formData.priority} 
              onValueChange={(value: CampaignPriority) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Revenue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Revenue
          </CardTitle>
          <CardDescription>
            Update the actual revenue for your campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="actual-revenue">Actual Revenue</Label>
            <div className="flex items-center h-12 border rounded-md border-input px-3 bg-background">
              <span className="text-sm text-muted-foreground mr-2">$</span>
              <Input 
                id="actual-revenue" 
                type="number" 
                value={formData.revenue.actual}
                onChange={(e) => setFormData({
                  ...formData,
                  revenue: {
                    ...formData.revenue,
                    actual: Number(e.target.value)
                  }
                })}
                className="border-0 h-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="projected-revenue">Projected Revenue</Label>
            <div className="flex items-center h-12 border rounded-md border-input px-3 bg-muted">
              <span className="text-sm text-muted-foreground mr-2">$</span>
              <Input 
                id="projected-revenue" 
                type="number" 
                value={formData.revenue.projected}
                disabled
                className="border-0 h-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
              />
            </div>
            <p className="text-xs text-muted-foreground">Automatically calculated based on campaign performance</p>
          </div>
        </CardContent>
      </Card>

      {/* Budget */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Budget
          </CardTitle>
          <CardDescription>
            Set the budget for your campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="allocated-budget">Allocated Budget</Label>
            <div className="flex items-center h-12 border rounded-md border-input px-3 bg-background">
              <span className="text-sm text-muted-foreground mr-2">$</span>
              <Input 
                id="allocated-budget" 
                type="number" 
                value={formData.budget.allocated}
                onChange={(e) => setFormData({
                  ...formData,
                  budget: {
                    ...formData.budget,
                    allocated: Number(e.target.value)
                  }
                })}
                className="border-0 h-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="remaining-budget">Remaining Budget</Label>
            <div className="flex items-center h-12 border rounded-md border-input px-3 bg-muted">
              <span className="text-sm text-muted-foreground mr-2">$</span>
              <Input 
                id="remaining-budget" 
                type="number" 
                value={formData.budget.remaining}
                disabled
                className="border-0 h-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
              />
            </div>
            <p className="text-xs text-muted-foreground">Automatically calculated from allocated budget minus total costs</p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <div className="rounded-lg border-destructive/50 border bg-destructive/5 p-6">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold text-destructive mb-1">Danger Zone</h2>
            <p className="text-sm text-muted-foreground">
              Actions in this section cannot be undone
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium mb-1">Delete Campaign</h3>
              <p className="text-sm text-muted-foreground">
                Permanently delete this campaign and all of its data
              </p>
            </div>
            <Button
              variant="destructive"
              type="button"
              onClick={() => setIsDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center justify-center py-4">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDeleteCampaign?.();
                setIsDeleteDialogOpen(false);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
} 