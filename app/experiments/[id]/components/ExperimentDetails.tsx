"use client"

import { Experiment } from "../types"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Badge } from "@/app/components/ui/badge"
import {
  CalendarIcon,
  Tag,
  Users,
  Link,
  ExternalLink,
  Type,
  FileText,
  HelpCircle,
  Beaker,
  CheckSquare,
  Copy,
  Plus,
  X
} from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { createClient } from "@/lib/supabase/client"

interface ExperimentDetailsProps {
  experiment: Experiment
  editForm: {
    name: string
    description: string
    hypothesis: string
    validations: string
  }
  onFormChange: (field: string, value: string) => void
}

export function ExperimentDetails({
  experiment,
  editForm,
  onFormChange
}: ExperimentDetailsProps) {
  const [availableSegments, setAvailableSegments] = useState<Array<{id: string, name: string}>>([])
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("")
  const [previewUrl, setPreviewUrl] = useState(experiment.preview_url || "")
  const [pendingSegments, setPendingSegments] = useState<Array<{id: string, name: string, participants: number}>>([])
  const [removedSegmentIds, setRemovedSegmentIds] = useState<string[]>([])
  const [hasUnsavedSegmentChanges, setHasUnsavedSegmentChanges] = useState(false)
  const [showSegmentDropdown, setShowSegmentDropdown] = useState(false)

  // Fetch available segments on component mount
  useEffect(() => {
    const fetchSegments = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('segments')
          .select('id, name')
          .eq('site_id', experiment.site_id)
        
        if (error) {
          console.error("Error fetching segments:", error)
          return
        }
        
        setAvailableSegments(data || [])
      } catch (error) {
        console.error("Error fetching segments:", error)
      }
    }
    
    fetchSegments()
  }, [experiment.site_id])

  // Initialize pendingSegments with current experiment segments
  useEffect(() => {
    setPendingSegments(experiment.segments || [])
  }, [experiment.segments])

  // Listen for the experiment:saved event to clear unsaved segment changes
  useEffect(() => {
    const handleExperimentSaved = () => {
      setHasUnsavedSegmentChanges(false)
      setRemovedSegmentIds([])
    }
    
    window.addEventListener('experiment:saved', handleExperimentSaved)
    
    return () => {
      window.removeEventListener('experiment:saved', handleExperimentSaved)
    }
  }, [])

  // Update experiment on previewUrl change
  useEffect(() => {
    // Only update if the value has changed from initial value
    if (previewUrl !== experiment.preview_url) {
      const updatePreviewUrl = async () => {
        try {
          const supabase = createClient()
          const { error } = await supabase
            .from('experiments')
            .update({ preview_url: previewUrl })
            .eq('id', experiment.id)
          
          if (error) {
            throw new Error(error.message)
          }
          
          // Emit an event to refresh experiment data
          const event = new CustomEvent('experiment:refresh', {
            detail: {
              id: experiment.id
            }
          })
          window.dispatchEvent(event)
        } catch (error) {
          console.error("Error updating preview URL:", error)
          toast.error("Failed to update preview URL")
        }
      }
      
      // Use debounce to avoid too many updates
      const timer = setTimeout(() => {
        updatePreviewUrl()
      }, 1000)
      
      return () => clearTimeout(timer)
    }
  }, [previewUrl, experiment.preview_url, experiment.id])

  const handleCopyId = () => {
    navigator.clipboard.writeText(experiment.id)
    toast.success("ID copied to clipboard")
  }

  const handleSegmentSelect = (value: string) => {
    if (!value) return;
    
    // Check if segment is already added
    const isAlreadyAdded = pendingSegments.some(segment => segment.id === value)
    if (isAlreadyAdded) {
      toast.error("Segment already added to this experiment")
      setSelectedSegmentId("")
      return
    }
    
    // Find the segment name
    const segment = availableSegments.find(seg => seg.id === value)
    if (!segment) {
      toast.error("Selected segment not found")
      setSelectedSegmentId("")
      return
    }
    
    // Add to pendingSegments instead of saving to database
    setPendingSegments(prev => [
      ...prev, 
      { 
        id: segment.id, 
        name: segment.name, 
        participants: 0 
      }
    ])
    
    // If this segment was previously removed, remove it from removedSegmentIds
    if (removedSegmentIds.includes(value)) {
      setRemovedSegmentIds(prev => prev.filter(id => id !== value))
    }
    
    // Set flag for unsaved changes
    setHasUnsavedSegmentChanges(true)
    
    // Reset selected segment
    setSelectedSegmentId("")
  }
  
  const handleRemoveSegment = (segmentId: string) => {
    // Check if the segment was originally from the experiment
    const isOriginalSegment = experiment.segments.some(s => s.id === segmentId)
    
    // If it was original, add to removedSegmentIds
    if (isOriginalSegment) {
      setRemovedSegmentIds(prev => [...prev, segmentId])
    }
    
    // Remove from pendingSegments
    setPendingSegments(prev => prev.filter(segment => segment.id !== segmentId))
    
    // Set flag for unsaved changes
    setHasUnsavedSegmentChanges(true)
  }

  // Create a custom event with segment changes when there are unsaved changes
  useEffect(() => {
    if (hasUnsavedSegmentChanges) {
      const event = new CustomEvent('experiment:segment-changes', {
        detail: {
          pendingSegments,
          removedSegmentIds,
          experimentId: experiment.id
        }
      })
      window.dispatchEvent(event)
    }
  }, [hasUnsavedSegmentChanges, pendingSegments, removedSegmentIds, experiment.id])

  return (
    <>
      {/* Dates Section (previously part of Status) */}
      {(experiment.start_date || experiment.end_date) && (
        <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Timeline
          </h3>
          
          <div className="space-y-4">
            {experiment.start_date && (
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                  <CalendarIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Start Date</p>
                  <p className="text-sm font-medium">
                    {new Date(experiment.start_date).toLocaleDateString()} at {new Date(experiment.start_date).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )}

            {experiment.end_date && (
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
                  <CalendarIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">End Date</p>
                  <p className="text-sm font-medium">
                    {new Date(experiment.end_date).toLocaleDateString()} at {new Date(experiment.end_date).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Basic Information Section */}
      <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Basic Information
        </h3>
        
        <div className="space-y-5">
          <div className="space-y-2.5">
            <Label className="flex items-center gap-2">
              <Type className="h-4 w-4 text-muted-foreground" />
              Name
            </Label>
            <Input
              value={editForm.name}
              onChange={(e) => onFormChange('name', e.target.value)}
              placeholder="Enter experiment name"
              className="h-11 w-full max-w-full"
            />
          </div>
          <div className="space-y-2.5">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Description
            </Label>
            <Textarea
              value={editForm.description}
              onChange={(e) => onFormChange('description', e.target.value)}
              placeholder="Enter description"
              className="min-h-[100px] resize-none w-full max-w-full"
            />
          </div>
          <div className="space-y-2.5">
            <Label className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              Hypothesis
            </Label>
            <Textarea
              value={editForm.hypothesis}
              onChange={(e) => onFormChange('hypothesis', e.target.value)}
              placeholder="Enter hypothesis"
              className="min-h-[100px] resize-none w-full max-w-full"
            />
          </div>
          <div className="space-y-2.5">
            <Label className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 text-muted-foreground" />
              Validations
            </Label>
            <Textarea
              value={editForm.validations}
              onChange={(e) => onFormChange('validations', e.target.value)}
              placeholder="Enter validation criteria"
              className="min-h-[100px] resize-none w-full max-w-full"
            />
          </div>
        </div>
      </div>

      {/* Metrics section */}
      <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Metrics
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Conversion</p>
              <p className="text-sm font-medium">
                {experiment.conversion !== null ? `${experiment.conversion}%` : "N/A"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">ROI</p>
              <p className="text-sm font-medium">
                {experiment.roi !== null ? `${experiment.roi}%` : "N/A"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Segments */}
      <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider flex justify-between items-center">
          <span>Segments</span>
          {hasUnsavedSegmentChanges && (
            <span className="text-xs text-muted-foreground font-normal">Unsaved changes *</span>
          )}
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px' }}>
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Total Participants</p>
              <p className="text-sm font-medium">
                {pendingSegments.reduce((acc, segment) => acc + segment.participants, 0).toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 rounded-md flex items-center justify-center" style={{ width: '48px', height: '48px', marginTop: '4px' }}>
              <Tag className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Active Segments</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {pendingSegments.map((segment) => (
                  <Badge 
                    key={segment.id}
                    variant="secondary" 
                    className="px-3 py-1 text-xs font-medium group relative hover:pr-7"
                  >
                    {segment.name} ({segment.participants.toLocaleString()})
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 opacity-0 group-hover:opacity-100 h-4 w-4 p-0 hover:bg-transparent hover:text-destructive transition-opacity"
                      onClick={() => handleRemoveSegment(segment.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Add segment section */}
          <div className="pt-2 border-t border-border/30 mt-4">
            <p className="text-xs text-muted-foreground mb-2">Add segment to experiment</p>
            
            {!showSegmentDropdown ? (
              // Solo mostrar el botón Add Segment si hay segmentos disponibles para agregar
              availableSegments.filter(segment => !pendingSegments.some(ps => ps.id === segment.id)).length > 0 ? (
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
                {availableSegments.filter(segment => !pendingSegments.some(ps => ps.id === segment.id)).length > 0 ? (
                  <>
                    <Select 
                      value={selectedSegmentId} 
                      onValueChange={(value) => {
                        handleSegmentSelect(value);
                        // Keep the dropdown open after selection
                      }}
                    >
                      <SelectTrigger className="w-full max-w-full">
                        <SelectValue placeholder="Select segment" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSegments
                          .filter(segment => !pendingSegments.some(ps => ps.id === segment.id))
                          .map(segment => (
                            <SelectItem key={segment.id} value={segment.id}>
                              {segment.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Solo mostrar el botón Done si hay segmentos disponibles */}
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
      </div>

      {/* Preview URL - Now editable */}
      <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Experiment URL
        </h3>
        
        <div className="space-y-2.5">
          <Label className="flex items-center gap-2">
            <Link className="h-4 w-4 text-muted-foreground" />
            URL
          </Label>
          <div className="flex items-center gap-2">
            <Input 
              value={previewUrl || ""}
              onChange={(e) => setPreviewUrl(e.target.value)}
              placeholder="Enter experiment URL"
              className="w-full max-w-full"
            />
            {previewUrl && (
              <Button
                variant="ghost" 
                size="sm"
                className="h-8 px-2 flex-shrink-0"
                onClick={() => window.open(previewUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {previewUrl && (
            <div className="rounded-md border overflow-hidden mt-2 h-40">
              <iframe 
                src={previewUrl} 
                className="w-full h-full"
                title={`Preview of ${experiment.name}`}
                sandbox="allow-same-origin allow-scripts"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </div>

      {/* Experiment ID - New section at the bottom */}
      <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
        <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
          Experiment ID
        </h3>
        
        <div className="flex items-center gap-2">
          <code className="bg-muted p-2 rounded text-xs flex-1 overflow-x-auto font-mono">
            {experiment.id}
          </code>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleCopyId} 
            className="h-8 px-2"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  )
} 