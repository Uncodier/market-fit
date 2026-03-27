import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/ui/use-toast'
import { PlanStep, InstancePlan } from '../types'

interface UseStepManagementProps {
  activeRobotInstance?: any
  steps: PlanStep[]
  instancePlans: InstancePlan[]
  onSetSteps?: (steps: PlanStep[]) => void
}

export const useStepManagement = ({ 
  activeRobotInstance, 
  steps, 
  instancePlans, 
  onSetSteps 
}: UseStepManagementProps) => {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingStep, setEditingStep] = useState<PlanStep | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const { toast } = useToast()

  // Check if a step can be edited or deleted (completed steps cannot be edited/deleted)
  const canEditOrDeleteStep = (step: PlanStep) => {
    return step.status !== 'completed'
  }

  // Step management functions
  const openEditModal = (step: PlanStep) => {
    setEditingStep(step)
    setEditTitle(step.title)
    setEditDescription(step.description || '')
    setIsEditModalOpen(true)
  }

  const closeEditModal = () => {
    setIsEditModalOpen(false)
    setEditingStep(null)
    setEditTitle('')
    setEditDescription('')
  }

  const saveStep = async () => {
    if (!editingStep || !editTitle.trim() || !activeRobotInstance?.id) return

    // Check if step can be edited
    if (!canEditOrDeleteStep(editingStep)) {
      closeEditModal()
      return
    }

    try {
      const supabase = createClient()
      
      // Find which plan contains this step
      const planWithStep = instancePlans.find(plan => {
        if (plan.steps && Array.isArray(plan.steps)) {
          return plan.steps.some((step: any) => step.id === editingStep.id)
        }
        return false
      })

      if (!planWithStep) {
        toast({
          title: "Error saving step",
          description: "Step not found in any plan",
          variant: "destructive"
        })
        return
      }

      // Update the step in the plan's steps array
      const updatedSteps = (planWithStep.steps as any[]).map((step: any) => {
        if (step.id === editingStep.id) {
          return {
            ...step,
            title: editTitle.trim(),
            description: editDescription.trim() || null
          }
        }
        return step
      })
      
      // Update the plan in the database
      const { error } = await supabase
        .from('instance_plans')
        .update({
          steps: updatedSteps,
          updated_at: new Date().toISOString()
        })
        .eq('id', planWithStep.id)

      if (error) {
        console.error('Error updating plan:', error)
        toast({
          title: "Error saving step",
          description: error.message || "Failed to update the plan",
          variant: "destructive"
        })
      }
      
      // The real-time subscription will handle updating the local state on success
      closeEditModal()
    } catch (error) {
      console.error('Error saving step:', error)
      toast({
        title: "Error saving step",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      })
      closeEditModal()
    }
  }

  const deleteStep = async (stepId: string) => {
    if (!activeRobotInstance?.id) return

    // Find the step to check if it can be deleted
    const stepToDelete = steps.find(step => step.id === stepId)
    if (!stepToDelete || !canEditOrDeleteStep(stepToDelete)) {
      toast({
        title: "Cannot delete step",
        description: "Completed steps cannot be deleted",
        variant: "destructive"
      })
      return
    }

    try {
      const supabase = createClient()

      // Find which plan contains this step
      const planWithStep = instancePlans.find(plan => {
        if (plan.steps && Array.isArray(plan.steps)) {
          return plan.steps.some((step: any) => step.id === stepId)
        }
        return false
      })

      if (!planWithStep) {
        toast({
          title: "Error deleting step",
          description: "Step not found in any plan",
          variant: "destructive"
        })
        return
      }

      // Remove the step from the plan's steps array
      const updatedSteps = (planWithStep.steps as any[]).filter((step: any) => step.id !== stepId)
      
      // If no steps remain, delete the plan entirely
      if (updatedSteps.length === 0) {
        const { error } = await supabase
          .from('instance_plans')
          .delete()
          .eq('id', planWithStep.id)

        if (error) {
          console.error('Error deleting plan:', error)
          toast({
            title: "Error deleting step",
            description: error.message || "Failed to delete the plan",
            variant: "destructive"
          })
        } else {
          toast({
            title: "Step deleted",
            description: "The step has been removed from the plan"
          })
        }
      } else {
        // Update the plan with the modified steps array
        const { error } = await supabase
          .from('instance_plans')
          .update({
            steps: updatedSteps,
            steps_total: updatedSteps.length,
            updated_at: new Date().toISOString()
          })
          .eq('id', planWithStep.id)

        if (error) {
          console.error('Error updating plan steps:', error)
          toast({
            title: "Error deleting step",
            description: error.message || "Failed to update the plan",
            variant: "destructive"
          })
        } else {
          toast({
            title: "Step deleted",
            description: "The step has been removed from the plan"
          })
        }
      }
    } catch (error) {
      console.error('Error deleting step:', error)
      toast({
        title: "Error deleting step",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      })
    }
  }

  const toggleStepStatus = async (stepId: string) => {
    if (!activeRobotInstance?.id) return

    try {
      const supabase = createClient()
      
      // Find the current status
      const currentStep = steps.find(step => step.id === stepId)
      if (!currentStep) return

      const newStatus = currentStep.status === 'completed' ? 'pending' : 
                       currentStep.status === 'pending' ? 'in_progress' : 'completed'
      
      // Find which plan contains this step
      const planWithStep = instancePlans.find(plan => {
        if (plan.steps && Array.isArray(plan.steps)) {
          return plan.steps.some((step: any) => step.id === stepId)
        }
        return false
      })

      if (!planWithStep) {
        toast({
          title: "Error updating step",
          description: "Step not found in any plan",
          variant: "destructive"
        })
        return
      }

      // Update the step status in the plan's steps array
      const updatedSteps = (planWithStep.steps as any[]).map((step: any) => {
        if (step.id === stepId) {
          return {
            ...step,
            status: newStatus
          }
        }
        return step
      })
      
      // Check if all steps are completed or some are in progress
      const allCompleted = updatedSteps.every(s => s.status === 'completed')
      const someInProgress = updatedSteps.some(s => s.status === 'in_progress')
      
      const newPlanStatus = allCompleted ? 'completed' : 
                            (someInProgress || newStatus === 'in_progress') ? 'in_progress' : planWithStep.status
                            
      // Calculate plan progress
      const completedStepsCount = updatedSteps.filter(s => s.status === 'completed').length
      const progressPercentage = Math.round((completedStepsCount / updatedSteps.length) * 100)

      // Update the plan in the database
      const { error } = await supabase
        .from('instance_plans')
        .update({
          steps: updatedSteps,
          status: newPlanStatus,
          progress_percentage: progressPercentage,
          steps_completed: completedStepsCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', planWithStep.id)

      if (error) {
        console.error('Error updating step status:', error)
        toast({
          title: "Error updating step",
          description: error.message || "Failed to update the step status",
          variant: "destructive"
        })
      } else {
        // Update local state immediately for better UX
        onSetSteps?.(steps.map(step => 
          step.id === stepId 
            ? { ...step, status: newStatus as 'pending' | 'in_progress' | 'completed' }
            : step
        ))
      }
    } catch (error) {
      console.error('Error toggling step status:', error)
      toast({
        title: "Error updating step",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      })
    }
  }

  const pausePlan = async (planId: string) => {
    
    // Validate planId is a string and not an object
    if (!planId || typeof planId !== 'string') {
      console.error('❌ Invalid planId:', planId)
      toast({
        title: "Error pausing plan",
        description: "Invalid plan ID provided",
        variant: "destructive"
      })
      return
    }
    
    if (!activeRobotInstance?.id) {
      return
    }

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('instance_plans')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .select()

      if (error) {
        console.error('❌ Supabase error:', error)
        throw new Error(error.message || 'Failed to pause plan')
      }

      toast({
        title: "Plan paused",
        description: "The plan has been paused successfully"
      })
    } catch (error) {
      console.error('❌ Error pausing plan:', error)
      toast({
        title: "Error pausing plan",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      })
    }
  }

  const resumePlan = async (planId: string) => {
    
    // Validate planId is a string and not an object
    if (!planId || typeof planId !== 'string') {
      console.error('❌ Invalid planId:', planId)
      toast({
        title: "Error resuming plan",
        description: "Invalid plan ID provided",
        variant: "destructive"
      })
      return
    }
    
    if (!activeRobotInstance?.id) {
      return
    }

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('instance_plans')
        .update({
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .select()

      if (error) {
        console.error('❌ Supabase error:', error)
        throw new Error(error.message || 'Failed to resume plan')
      }

      toast({
        title: "Plan resumed",
        description: "The plan has been resumed successfully"
      })
    } catch (error) {
      console.error('❌ Error resuming plan:', error)
      toast({
        title: "Error resuming plan",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      })
    }
  }

  const cancelPlan = async (planId: string) => {
    if (!planId || typeof planId !== 'string') {
      console.error('❌ Invalid planId:', planId)
      toast({
        title: "Error cancelling plan",
        description: "Invalid plan ID provided",
        variant: "destructive"
      })
      return
    }
    
    if (!activeRobotInstance?.id) {
      return
    }

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('instance_plans')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .select()

      if (error) {
        console.error('❌ Supabase error:', error)
        throw new Error(error.message || 'Failed to cancel plan')
      }

      toast({
        title: "Plan cancelled",
        description: "The plan has been cancelled successfully"
      })
    } catch (error) {
      console.error('❌ Error cancelling plan:', error)
      toast({
        title: "Error cancelling plan",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      })
    }
  }

  const addStep = async (planId: string, title: string) => {
    if (!activeRobotInstance?.id) return

    try {
      const supabase = createClient()
      
      // Get current plan to ensure we have latest steps
      const { data: plan, error: fetchError } = await supabase
        .from('instance_plans')
        .select('steps')
        .eq('id', planId)
        .single()
      
      if (fetchError || !plan) {
        console.error('Error fetching plan for add step:', fetchError)
        toast({
          title: "Error adding step",
          description: "Could not fetch plan details",
          variant: "destructive"
        })
        return
      }

      const currentSteps = Array.isArray(plan.steps) ? plan.steps : []
      
      // Create new step
      // Generate a simple ID if crypto.randomUUID is not available (though it should be in modern browsers)
      const stepId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      const newStep = {
        id: stepId,
        title: title.trim(),
        description: null, // Default to null
        status: 'pending',
        // order is implicit by array position, but we can store it if needed by the backend schema
        // The previous code in useInstancePlans assigns order based on index
      }
      
      const updatedSteps = [...currentSteps, newStep]
      
      
      const { error: updateError } = await supabase
        .from('instance_plans')
        .update({
          steps: updatedSteps,
          steps_total: updatedSteps.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)

      if (updateError) {
        console.error('Error updating plan with new step:', updateError)
        toast({
          title: "Error adding step",
          description: updateError.message || "Failed to add step",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Step added",
          description: "New step added to the plan"
        })
      }
    } catch (error) {
      console.error('Error adding step:', error)
      toast({
        title: "Error adding step",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      })
    }
  }

  return {
    isEditModalOpen,
    editingStep,
    editTitle,
    editDescription,
    setEditTitle,
    setEditDescription,
    openEditModal,
    closeEditModal,
    saveStep,
    deleteStep,
    toggleStepStatus,
    pausePlan,
    resumePlan,
    cancelPlan,
    canEditOrDeleteStep,
    addStep
  }
}
