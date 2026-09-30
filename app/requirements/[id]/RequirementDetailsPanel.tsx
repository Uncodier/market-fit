"use client"

import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { ScrollArea } from "@/app/components/ui/scroll-area"
import { Textarea } from "@/app/components/ui/textarea"
import { toast } from "sonner"

import {
AlertCircle,
BarChart,
CalendarIcon,
CheckCircle2,
FileText,
Plus,
Tag,
Target,
FileText as TextIcon,
Type,
Users,
X
} from "@/app/components/ui/icons"
import { RelationSelect } from "@/app/components/ui/relation-select"
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/app/components/ui/select"
import { createClient } from "@/lib/supabase/client"

import { getCompletionStatusColor,getCompletionStatusLabel,getPriorityColor,getStatusColor,getStatusLabel } from "./requirement-detail-presentation"
import { COMPLETION_STATUS,REQUIREMENT_STATUS,type CompletionStatusType,type RequirementStatusType } from "./requirement-detail-types"
import type { RequirementController } from "./use-requirement-controller"
export function RequirementDetailsPanel({ controller }: { controller: RequirementController }) {
  const { requirement, isSaving, error, pendingSegmentChanges, editForm, setEditForm, campaigns, segments, selectedSegmentId, showSegmentDropdown, setShowSegmentDropdown, handleUpdateStatus, handleUpdateCompletionStatus, handleUpdatePriority, handleSegmentSelect, handleRemoveSegment } = controller
    return (
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-5 space-y-6">
            {/* Requirement Information */}
            <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                Requirement Information
              </h3>
              
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <Type className="h-4 w-4 text-muted-foreground" />
                    Title
                  </Label>
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                    className="h-11"
                    placeholder="Requirement title"
                  />
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <TextIcon className="h-4 w-4 text-muted-foreground" />
                    Description
                  </Label>
                  <Textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    className="min-h-[100px] resize-none"
                    placeholder="Enter a brief description"
                  />
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <BarChart className="h-4 w-4 text-muted-foreground" />
                    Budget
                  </Label>
                  {(requirement?.metadata?.payment_status?.outsourced && requirement?.metadata?.payment_status?.status === 'paid') || 
                   requirement?.campaignOutsourced ? (
                    <div className="h-11 flex items-center px-3 border border-border rounded-md bg-green-50 dark:bg-green-900/20">
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        Paid - Campaign Outsourced
                      </span>
                    </div>
                  ) : (
                    <Input
                      type="number"
                      value={editForm.budget || ''}
                      onChange={(e) => setEditForm({...editForm, budget: e.target.value ? parseFloat(e.target.value) : null})}
                      className="h-11"
                      placeholder="Enter budget amount"
                    />
                  )}
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    Tipo de entregable
                  </Label>
                  <Select
                    value={editForm.type}
                    onValueChange={(value: "app" | "automation" | "presentation" | "document" | "campaign" | "image" | "video" | "audio" | "report" | "message" | "segment" | "task" | "website") => {
                      setEditForm({...editForm, type: value})
                    }}
                  >
                    <SelectTrigger className="h-11 w-full">
                      <SelectValue placeholder="Selecciona el tipo de entregable">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          {
                            {
                              app: 'Apps',
                              automation: 'Automatización',
                              presentation: 'Presentación',
                              document: 'Documento',
                              campaign: 'Campaña',
                              image: 'Imagen',
                              video: 'Video',
                              audio: 'Audio',
                              report: 'Reporte',
                              message: 'Mensaje',
                              segment: 'Segmento',
                              task: 'Tarea',
                              website: 'Sitio web'
                            }[editForm.type] || editForm.type.charAt(0).toUpperCase() + editForm.type.slice(1)
                          }
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="app">Apps</SelectItem>
                      <SelectItem value="automation">Automatización</SelectItem>
                      <SelectItem value="presentation">Presentación</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                      <SelectItem value="campaign">Campaña</SelectItem>
                      <SelectItem value="image">Imagen</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="audio">Audio</SelectItem>
                      <SelectItem value="report">Reporte</SelectItem>
                      <SelectItem value="message">Mensaje</SelectItem>
                      <SelectItem value="segment">Segmento</SelectItem>
                      <SelectItem value="task">Tarea</SelectItem>
                      <SelectItem value="website">Sitio web</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    Status
                  </Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value: RequirementStatusType) => {
                      handleUpdateStatus(value)
                    }}
                    disabled={isSaving}
                  >
                    <SelectTrigger className={`h-11 w-full ${getStatusColor(editForm.status)}`}>
                      <SelectValue placeholder="Select status">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {getStatusLabel(editForm.status)}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={REQUIREMENT_STATUS.BACKLOG}>Backlog</SelectItem>
                      <SelectItem value={REQUIREMENT_STATUS.IN_PROGRESS}>In Progress</SelectItem>
                      <SelectItem value={REQUIREMENT_STATUS.ON_REVIEW}>On Review</SelectItem>
                      <SelectItem value={REQUIREMENT_STATUS.DONE}>Done</SelectItem>
                      <SelectItem value={REQUIREMENT_STATUS.VALIDATED}>Validated</SelectItem>
                      <SelectItem value={REQUIREMENT_STATUS.CANCELED}>Canceled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    Completion Status
                  </Label>
                  <Select
                    value={editForm.completionStatus}
                    onValueChange={(value: CompletionStatusType) => {
                      handleUpdateCompletionStatus(value)
                    }}
                    disabled={isSaving}
                  >
                    <SelectTrigger className={`h-11 w-full ${getCompletionStatusColor(editForm.completionStatus)}`}>
                      <SelectValue placeholder="Select completion status">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          {getCompletionStatusLabel(editForm.completionStatus)}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={COMPLETION_STATUS.PENDING}>Pending</SelectItem>
                      <SelectItem value={COMPLETION_STATUS.COMPLETED}>Completed</SelectItem>
                      <SelectItem value={COMPLETION_STATUS.REJECTED}>Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <BarChart className="h-4 w-4 text-muted-foreground" />
                    Priority
                  </Label>
                  <Select
                    value={editForm.priority}
                    onValueChange={(value: "high" | "medium" | "low") => {
                      handleUpdatePriority(value)
                    }}
                    disabled={isSaving}
                  >
                    <SelectTrigger className={`h-11 w-full ${getPriorityColor(editForm.priority)}`}>
                      <SelectValue placeholder="Select priority">
                        <div className="flex items-center gap-2">
                          <BarChart className="h-4 w-4" />
                          {editForm.priority.charAt(0).toUpperCase() + editForm.priority.slice(1)}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="low">Low Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            
            {/* Segments and Campaigns */}
            <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex justify-between items-center">
                <span>Segments & Campaigns</span>
                {pendingSegmentChanges && (
                  <span className="text-xs text-muted-foreground font-normal">Unsaved changes *</span>
                )}
              </h3>
              
              <div className="space-y-5">
                  <div className="space-y-2.5">
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Segments
                    </Label>
                  <div className="flex flex-wrap gap-2">
                    {editForm.segmentNames?.length > 0 ? (
                      editForm.segmentNames.map((segment, i) => (
                        <Badge
                          key={i}
                          variant="secondary"
                          className="px-3 py-1 text-xs font-medium bg-gray-100/20 text-gray-700 dark:text-gray-300 hover:bg-gray-200/20 transition-colors border border-gray-300/30 group relative hover:pr-7 max-w-full"
                        >
                          <span className="truncate block max-w-[150px]">{segment}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 opacity-0 group-hover:opacity-100 h-4 w-4 p-0 hover:bg-transparent hover:text-destructive transition-opacity"
                            onClick={() => handleRemoveSegment(editForm.segments[i])}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">No segments assigned</span>
                    )}
                  </div>

                  {/* Add segment section */}
                  <div className="pt-2 border-t border-border/30 mt-4">
                    <p className="text-xs text-muted-foreground mb-2">Add segment to requirement</p>
                    
                    {!showSegmentDropdown ? (
                      // Only show Add Segment button if there are segments available to add
                      segments.filter(segment => !editForm.segments.includes(segment.id)).length > 0 ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full flex items-center justify-center"
                          onClick={() => setShowSegmentDropdown(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" /> Add Segment
                        </Button>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No more segments available to add</p>
                      )
                    ) : (
                      <div className="space-y-2">
                        {segments.filter(segment => !editForm.segments.includes(segment.id)).length > 0 ? (
                          <>
                            <Select 
                              value={selectedSegmentId} 
                              onValueChange={(value) => {
                                handleSegmentSelect(value);
                                // Keep the dropdown open after selection
                              }}
                            >
                              <SelectTrigger className="w-full max-w-full">
                                <SelectValue placeholder="Select segment">
                                  <span className="truncate block max-w-[180px]">
                                    {selectedSegmentId ? segments.find(s => s.id === selectedSegmentId)?.name || "Selected segment" : "Select segment"}
                                  </span>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {segments
                                  .filter(segment => !editForm.segments.includes(segment.id))
                                  .map(segment => (
                                    <SelectItem key={segment.id} value={segment.id}>
                                      <span className="truncate block w-full overflow-hidden">
                                        {segment.name}
                                      </span>
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            
                            {/* Only show Done button if there are segments available */}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full flex items-center justify-center"
                              onClick={() => setShowSegmentDropdown(false)}
                            >
                              Done
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-muted-foreground italic">No more segments available to add</p>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full flex items-center justify-center"
                              onClick={() => setShowSegmentDropdown(false)}
                            >
                              Close
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    Campaigns
                  </Label>
                  <RelationSelect
                    options={campaigns.map(c => ({ id: c.id, label: c.title }))}
                    value={editForm.campaignValue}
                    onValueChange={(val) => {
                      if (val) {
                        const isExisting = val.mode === "existing";
                        const campaignId = isExisting ? val.id : "";
                        const campaignTitle = val.label;
                        
                        setEditForm(prev => ({ ...prev, campaignValue: val }));
                        
                        if (isExisting) {
                          // Load the selected campaign segments
                          const loadCampaignSegments = async () => {
                            try {
                              const supabase = createClient();
                              
                              // Get campaign segments
                              const { data: campaignSegments, error } = await supabase
                                .from("campaign_segments")
                                .select("segment_id")
                                .eq("campaign_id", campaignId);
                                
                              if (error) {
                                console.error("Error loading campaign segments:", error);
                                return;
                              }
                              
                              // Extract segment IDs
                              const segmentIds = campaignSegments.map((cs: { segment_id: string }) => cs.segment_id);
                              
                              // Get segment names
                              const segmentNames = segmentIds.map((id: string) => {
                                const segment = segments.find(s => s.id === id);
                                return segment ? segment.name : "Unknown";
                              });
                              
                              // Update the form with the new campaign and its segments
                              setEditForm(prev => ({ 
                                ...prev, 
                                campaign_id: campaignId,
                                campaigns: [campaignId],
                                campaignNames: [campaignTitle],
                                segments: segmentIds,
                                segmentNames: segmentNames
                              }));
                              
                              toast.success(`Campaign "${campaignTitle}" assigned. Segments updated to match campaign.`);
                            } catch (err) {
                              console.error("Error in loadCampaignSegments:", err);
                              toast.error("Failed to load campaign segments");
                            }
                          };
                          
                          loadCampaignSegments();
                        } else {
                           // For pending create, we just update the form's display state
                           setEditForm(prev => ({ 
                              ...prev, 
                              campaign_id: "",
                              campaigns: [],
                              campaignNames: [campaignTitle],
                              segments: [],
                              segmentNames: []
                            }));
                        }
                      } else {
                        // If null is selected, clear campaign data
                        setEditForm(prev => ({ 
                          ...prev, 
                          campaignValue: null,
                          campaign_id: "",
                          campaigns: [],
                          campaignNames: [],
                          // Also clear segments
                          segments: [],
                          segmentNames: []
                        }));
                        
                        toast.info("Campaign unassigned");
                      }
                    }}
                    placeholder="Select a campaign"
                    emptyMessage="No campaigns found"
                    className={`h-11 ${editForm.campaign_id ? 'bg-blue-100/20 text-blue-700 dark:text-blue-300 border-blue-300/30' : ''}`}
                  />
                </div>
              </div>
            </div>
            
            {/* Dates */}
            <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                Dates
              </h3>
              
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    Created
                  </Label>
                  <div className="text-sm font-medium">
                    {requirement?.createdAt ? new Date(requirement.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    }) : "Unknown"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
}
