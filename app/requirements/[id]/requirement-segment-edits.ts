"use client"

import { toast } from "sonner"


import type { RequirementState } from "./use-requirement-state"
export function createRequirementSegmentEdits(state: RequirementState) {
  const { requirement, error, setUnsavedChanges, pendingSegmentChanges, setPendingSegmentChanges, editForm, setEditForm, segments, setSelectedSegmentId } = state
  // Add these segment handler functions
  const handleSegmentSelect = (value: string) => {
    if (!value) return;
    
    // Check if segment is already added
    const isAlreadyAdded = editForm.segments.includes(value);
    if (isAlreadyAdded) {
      toast.error("Segment already added to this requirement");
      setSelectedSegmentId("");
      return;
    }
    
    // Find the segment name
    const segment = segments.find(seg => seg.id === value);
    if (!segment) {
      toast.error("Selected segment not found");
      setSelectedSegmentId("");
      return;
    }
    
    // Update the pending segments
    const pendingSegments = [
      ...editForm.segments.map(id => {
        const seg = segments.find(s => s.id === id);
        return { id, name: seg?.name || "Unknown" };
      }),
      { id: segment.id, name: segment.name }
    ];
    
    const segmentNames = pendingSegments.map(s => s.name);
    const segmentIds = pendingSegments.map(s => s.id);
    
    // Update the edit form
    setEditForm(prev => ({
      ...prev,
      segments: segmentIds,
      segmentNames: segmentNames
    }));
    
    // If this segment was previously removed, remove it from removedSegmentIds
    if (pendingSegmentChanges?.removedSegmentIds.includes(value)) {
      setPendingSegmentChanges(prev => ({
        ...prev!,
        removedSegmentIds: prev!.removedSegmentIds.filter(id => id !== value)
      }));
    }
    
    // Create event for segment changes
    const event = new CustomEvent('requirement:segment-changes', {
      detail: {
        pendingSegments,
        removedSegmentIds: pendingSegmentChanges?.removedSegmentIds || [],
        requirementId: requirement?.id
      }
    });
    window.dispatchEvent(event);
    
    // Reset selected segment
    setSelectedSegmentId("");
  };
  
  const handleRemoveSegment = (segmentId: string) => {
    // Check if the segment was originally from the requirement
    const isOriginalSegment = requirement?.segments.includes(segmentId);
    
    // Create a copy of current pending segment changes or initialize new one
    const currentChanges = pendingSegmentChanges || {
      pendingSegments: editForm.segments.map(id => {
        const seg = segments.find(s => s.id === id);
        return { id, name: seg?.name || "Unknown" };
      }),
      removedSegmentIds: []
    };
    
    // If it was original, add to removedSegmentIds
    if (isOriginalSegment) {
      currentChanges.removedSegmentIds = [...currentChanges.removedSegmentIds, segmentId];
    }
    
    // Remove from pendingSegments in editForm
    const updatedSegments = editForm.segments.filter(id => id !== segmentId);
    const updatedSegmentNames = editForm.segmentNames.filter((_, i) => editForm.segments[i] !== segmentId);
    
    setEditForm(prev => ({
      ...prev,
      segments: updatedSegments,
      segmentNames: updatedSegmentNames
    }));
    
    // Update pendingSegmentChanges
    setPendingSegmentChanges({
      pendingSegments: currentChanges.pendingSegments.filter(s => s.id !== segmentId),
      removedSegmentIds: currentChanges.removedSegmentIds
    });
    
    // Create event for segment changes
    const event = new CustomEvent('requirement:segment-changes', {
      detail: {
        pendingSegments: currentChanges.pendingSegments.filter(s => s.id !== segmentId),
        removedSegmentIds: currentChanges.removedSegmentIds,
        requirementId: requirement?.id
      }
    });
    window.dispatchEvent(event);
    
    setUnsavedChanges(true);
  };

  return { handleSegmentSelect, handleRemoveSegment }
}
