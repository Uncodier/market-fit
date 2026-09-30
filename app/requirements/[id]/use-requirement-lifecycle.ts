"use client"

import { useEffect } from "react"
import { updateRequirementStatus } from "../actions"
import { markdownToHTML } from "../utils"


import { htmlToMarkdown } from "./requirement-markdown"
import type { RequirementState } from "./use-requirement-state"
export function useRequirementLifecycle(state: RequirementState, loadRequirement: () => Promise<void>, handleSaveChanges: () => Promise<boolean>, handleBuildRequirement: () => Promise<void>) {
  const { params, user, isAuthLoading, requirement, setIsLoading, isBuilding, setError, hasRequirementStatus, unsavedChanges, setUnsavedChanges, pendingSegmentChanges, setPendingSegmentChanges, editForm, editor } = state
  // Load requirement data
  useEffect(() => {
    if (params.id && user) {
      loadRequirement()
    } else if (!isAuthLoading && !user) {
      // If we're not loading auth and there's no user, show auth error
      setError("You must be signed in to view requirements")
      setIsLoading(false)
    }
  }, [params.id, user, isAuthLoading])

  // Update the page title when requirement is loaded
  useEffect(() => {
    if (requirement) {
      document.title = `${requirement.title} | Requirements`
      
      // Emit a custom event to update the breadcrumb with requirement title
      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: requirement.title,
          path: `/requirements/${requirement.id}`,
          section: 'requirements'
        }
      })
      
      setTimeout(() => {
        window.dispatchEvent(event)
      }, 0)
    }
    
    return () => {
      document.title = 'Requirements | Market Fit'
    }
  }, [requirement])

  // Add listener for segment changes
  useEffect(() => {
    const handleSegmentChanges = (event: CustomEvent) => {
      if (event.detail) {
        console.log("Segment changes detected:", event.detail);
        setPendingSegmentChanges({
          pendingSegments: event.detail.pendingSegments || [],
          removedSegmentIds: event.detail.removedSegmentIds || []
        });
        setUnsavedChanges(true);
      }
    };
    
    window.addEventListener('requirement:segment-changes', handleSegmentChanges as EventListener);
    
    return () => {
      window.removeEventListener('requirement:segment-changes', handleSegmentChanges as EventListener);
    };
  }, []);

  // Check for unsaved changes when form values change
  useEffect(() => {
    if (requirement) {
      // Convert current editor content to markdown for comparison
      const currentMarkdownInstructions = htmlToMarkdown(editForm.instructions);
      
      const hasFormChanges = 
        editForm.title !== (requirement.title || '') ||
        editForm.description !== (requirement.description || '') ||
        currentMarkdownInstructions !== (requirement.instructions || '') ||
        editForm.outsourceInstructions !== (requirement.instructions || '') ||
        editForm.type !== (requirement.type || 'task') ||
        editForm.priority !== (requirement.priority || 'medium') ||
        editForm.status !== (requirement.status || 'backlog') ||
        editForm.completionStatus !== (requirement.completionStatus || 'pending') ||
        editForm.source !== (requirement.source || '') ||
        editForm.budget !== requirement.budget;
      
      setUnsavedChanges(hasFormChanges || pendingSegmentChanges !== null);
    }
  }, [editForm, pendingSegmentChanges, requirement]);

  // Reset unsaved changes after successful save
  useEffect(() => {
    const handleRequirementSaved = () => {
      setUnsavedChanges(false);
      setPendingSegmentChanges(null);
    };
    
    window.addEventListener('requirement:saved', handleRequirementSaved);
    
    return () => {
      window.removeEventListener('requirement:saved', handleRequirementSaved);
    };
  }, []);

  // Update editor when requirement is loaded
  useEffect(() => {
    if (editor && requirement?.instructions) {
      // Convert markdown to HTML for proper display
      const formattedHTML = markdownToHTML(requirement.instructions);
      editor.commands.setContent(formattedHTML);
    }
  }, [requirement, editor])


  useEffect(() => {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('requirement:update', {
        detail: {
          id: params.id,
          isBuilding,
          hasRequirementStatus
        }
      }));
    }, 0);
  }, [params.id, isBuilding, hasRequirementStatus]);

  // Listen for build trigger from TopBarActions
  useEffect(() => {
    const handleBuildTrigger = () => {
      handleBuildRequirement();
    };
    
    window.addEventListener('requirement:build-trigger', handleBuildTrigger);
    
    return () => {
      window.removeEventListener('requirement:build-trigger', handleBuildTrigger);
    };
  }, [unsavedChanges, params.id, handleSaveChanges, updateRequirementStatus]);

}
