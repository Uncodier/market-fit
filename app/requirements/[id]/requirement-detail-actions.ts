"use client"

import { toast } from "sonner"
import { deleteRequirement,updateCompletionStatus,updateRequirement,updateRequirementInstructions,updateRequirementPriority,updateRequirementStatus } from "../actions"

import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { createClient } from "@/lib/supabase/client"

import { COMPLETION_STATUS,REQUIREMENT_STATUS,type CompletionStatusType,type RequirementStatusType } from "./requirement-detail-types"
import { htmlToMarkdown } from "./requirement-markdown"
import type { RequirementState } from "./use-requirement-state"
export function createRequirementDetailActions(state: RequirementState, loadRequirement: () => Promise<void>) {
  const { params, router, requirement, setIsEditing, setIsSaving, setIsBuilding, error, nodes, connections, unsavedChanges, pendingSegmentChanges, setPendingSegmentChanges, editForm, setEditForm, campaigns, segments } = state
  // Handle update requirement status
  const handleUpdateStatus = async (status: RequirementStatusType) => {
    if (!requirement) return
    
    try {
      setIsSaving(true)
      const { error } = await updateRequirementStatus(requirement.id, status)
      
      if (error) {
        throw new Error(error)
      }
      
      setEditForm(prev => ({ ...prev, status }))
      toast.success(`Status updated to ${status}`)
      
      // Refresh data
      loadRequirement()
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error("Failed to update status")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle update completion status
  const handleUpdateCompletionStatus = async (completionStatus: CompletionStatusType) => {
    if (!requirement) return
    
    try {
      setIsSaving(true)
      const { error } = await updateCompletionStatus(requirement.id, completionStatus)
      
      if (error) {
        throw new Error(error)
      }
      
      setEditForm(prev => ({ ...prev, completionStatus }))
      toast.success(`Completion status updated to ${completionStatus}`)
      
      // Refresh data
      loadRequirement()
    } catch (error) {
      console.error("Error updating completion status:", error)
      toast.error("Failed to update completion status")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle update priority
  const handleUpdatePriority = async (priority: "high" | "medium" | "low") => {
    if (!requirement) return
    
    try {
      setIsSaving(true)
      const { error } = await updateRequirementPriority(requirement.id, priority)
      
      if (error) {
        throw new Error(error)
      }
      
      setEditForm(prev => ({ ...prev, priority }))
      toast.success(`Priority updated to ${priority}`)
      
      // Refresh data
      loadRequirement()
    } catch (error) {
      console.error("Error updating priority:", error)
      toast.error("Failed to update priority")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle mark as done (both status and completion)
  const handleMarkAsDone = async () => {
    if (!requirement) return
    
    try {
      setIsSaving(true)
      
      // Update both status and completion status
      await handleUpdateStatus(REQUIREMENT_STATUS.DONE)
      await handleUpdateCompletionStatus(COMPLETION_STATUS.COMPLETED)
      
      toast.success("Requirement marked as done")
    } catch (error) {
      console.error("Error marking as done:", error)
      toast.error("Failed to mark as done")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle reject (both status and completion)
  const handleReject = async () => {
    if (!requirement) return
    
    try {
      setIsSaving(true)
      
      // Update both status and completion status
      await handleUpdateStatus(REQUIREMENT_STATUS.CANCELED)
      await handleUpdateCompletionStatus(COMPLETION_STATUS.REJECTED)
      
      toast.success("Requirement rejected")
    } catch (error) {
      console.error("Error rejecting requirement:", error)
      toast.error("Failed to reject requirement")
    } finally {
      setIsSaving(false)
    }
  }

  // Add save instructions function
  const handleSaveChanges = async (): Promise<boolean> => {
    if (!requirement) return false
    
    setIsSaving(true)
    try {
      // Convert HTML instructions back to markdown for storage (we'll use the outsourceInstructions if we're on the outsource tab)
      // Since outsourceInstructions is just plain text, we don't need to convert it, but we should make sure we're saving the right one
      const markdownInstructions = editForm.outsourceInstructions || htmlToMarkdown(editForm.instructions);
      
      // Update the requirement with instructions first
      const instructionsResult = await updateRequirementInstructions(requirement.id, markdownInstructions)
      
      if (instructionsResult.error) {
        throw new Error(instructionsResult.error)
      }
      
      // Update the requirement with other fields
      const updatedMetadata = {
        ...(requirement.metadata || {}),
        workflow_nodes: nodes,
        workflow_connections: connections
      };

      let resolvedCampaignId = editForm.campaign_id;
      if (editForm.campaignValue !== undefined) {
        const { id, error } = await resolveRelationId("campaign", editForm.campaignValue, requirement.siteId);
        if (error) throw new Error(error);
        resolvedCampaignId = id || "";
      }

      const { error } = await updateRequirement({
        id: requirement.id,
        title: editForm.title,
        description: editForm.description,
        type: editForm.type,
        priority: editForm.priority,
        status: editForm.status,
        completionStatus: editForm.completionStatus,
        source: editForm.source,
        budget: editForm.budget,
        segments: editForm.segments,
        campaigns: resolvedCampaignId ? [resolvedCampaignId] : [],
        campaign_id: resolvedCampaignId,
        outsourceInstructions: markdownInstructions,
        metadata: updatedMetadata
      })
      
      if (error) {
        throw new Error(error)
      }

      // Process segment changes if any
      if (pendingSegmentChanges) {
        console.log("Processing segment changes:", pendingSegmentChanges);
        const supabase = createClient();
        
        // 1. Remove segments that were deleted
        if (pendingSegmentChanges.removedSegmentIds.length > 0) {
          console.log("Removing segments:", pendingSegmentChanges.removedSegmentIds);
          
          const { error: removeError } = await supabase
            .from('requirement_segments')
            .delete()
            .eq('requirement_id', requirement.id)
            .in('segment_id', pendingSegmentChanges.removedSegmentIds);
            
          if (removeError) {
            console.error("Error removing segments:", removeError);
          }
        }
        
        // 2. Add new segments
        const existingSegmentIds = editForm.segments;
        const newSegments = pendingSegmentChanges.pendingSegments
          .filter(s => !existingSegmentIds.includes(s.id) && 
                       !pendingSegmentChanges.removedSegmentIds.includes(s.id))
          .map(s => s.id);
        
        if (newSegments.length > 0) {
          console.log("Adding new segments:", newSegments);
          
          const { error: addError } = await supabase
            .from('requirement_segments')
            .insert(
              newSegments.map(segmentId => ({
                requirement_id: requirement.id,
                segment_id: segmentId
              }))
            );
            
          if (addError) {
            console.error("Error adding segments:", addError);
          }
        }
        
        // Reset segment changes
        setPendingSegmentChanges(null);
      }
      
      setIsEditing(false)
      toast.success("Requirement updated successfully")
      
      // Dispatch event to notify the requirement was saved successfully
      window.dispatchEvent(new CustomEvent('requirement:saved'));
      
      // Refresh requirement data
      loadRequirement()
      return true
    } catch (error) {
      console.error("Error updating requirement:", error)
      toast.error("Failed to update requirement")
      return false
    } finally {
      setIsSaving(false)
    }
  }

  // Add handleDeleteRequirement function
  const handleDeleteRequirement = async () => {
    try {
      const result = await deleteRequirement(requirement!.id)
      
      if (result.error) {
        throw new Error(result.error)
      }
      
      toast.success("Requirement deleted successfully")
      router.push('/requirements') // Redirect to requirements list page
    } catch (error) {
      console.error("Error deleting requirement:", error)
      toast.error(error instanceof Error ? error.message : "Failed to delete requirement")
    }
  }

  const handleBuildRequirement = async () => {
    if (unsavedChanges) {
      const saved = await handleSaveChanges();
      if (!saved) return;
    }

    if (params.id && typeof params.id === 'string') {
      setIsBuilding(true);
      const currentDate = new Date().toISOString();
      const result = await updateRequirementStatus(params.id, "in-progress", currentDate);
      setIsBuilding(false);
      if (!result.error) {
        toast.success("Build started successfully");
        router.push('/requirements');
      } else {
        toast.error("Failed to start build");
      }
    }
  };

  // Sync state with TopBarActions
  return { handleUpdateStatus, handleUpdateCompletionStatus, handleUpdatePriority, handleMarkAsDone, handleReject, handleSaveChanges, handleDeleteRequirement, handleBuildRequirement }
}
