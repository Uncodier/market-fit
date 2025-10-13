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
      console.log('Cannot edit completed step')
      closeEditModal()
      return
    }

    try {
      const supabase = createClient()
      
      // Update the plan in the database
      const { error } = await supabase
        .from('instance_plans')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingStep.id)

      if (error) {
        console.error('Error updating plan:', error)
        // Could show a toast notification here
      } else {
        console.log('Plan updated successfully')
        // The real-time subscription will handle updating the local state
        closeEditModal()
      }
    } catch (error) {
      console.error('Error saving step:', error)
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
      
      // Helper function to check if string is a valid UUID format
      const isValidUUID = (str: string) => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        return uuidRegex.test(str)
      }

      // If stepId is a valid UUID, it's likely a plan ID itself
      if (isValidUUID(stepId)) {
        // Try to find the plan by ID and delete it entirely
        const { error } = await supabase
          .from('instance_plans')
          .delete()
          .eq('id', stepId)

        if (error) {
          console.error('Error deleting plan:', error)
          toast({
            title: "Error deleting step",
            description: error.message || "Failed to delete the step",
            variant: "destructive"
          })
        } else {
          console.log('Plan deleted successfully')
          toast({
            title: "Step deleted",
            description: "The step has been removed from the plan"
          })
        }
      } else {
        // stepId is not a UUID, so it must be a step within a plan's steps array
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
            console.log('Plan deleted successfully (no steps remaining)')
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
            console.log('Step removed from plan successfully')
            toast({
              title: "Step deleted",
              description: "The step has been removed from the plan"
            })
          }
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
      
      // Update the plan status in the database
      const { error } = await supabase
        .from('instance_plans')
        .update({
          status: newStatus,
          progress_percentage: newStatus === 'completed' ? 100 : 
                             newStatus === 'in_progress' ? 50 : 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', stepId)

      if (error) {
        console.error('Error updating step status:', error)
        toast({
          title: "Error updating step",
          description: error.message || "Failed to update the step status",
          variant: "destructive"
        })
      } else {
        console.log('Step status updated successfully')
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
    console.log('⏸️ pausePlan called with planId:', planId)
    
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
      console.log('❌ No active robot instance')
      return
    }

    try {
      console.log('📡 Updating plan status to paused in Supabase...')
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

      console.log('✅ Plan paused successfully in Supabase:', data)
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
    console.log('▶️ resumePlan called with planId:', planId)
    
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
      console.log('❌ No active robot instance')
      return
    }

    try {
      console.log('📡 Updating plan status to in_progress in Supabase...')
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

      console.log('✅ Plan resumed successfully in Supabase:', data)
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
    canEditOrDeleteStep
  }
}
