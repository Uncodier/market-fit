import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/app/components/ui/use-toast"
import { cancelInstancePlan } from "./cancel-instance-plan"

export function usePlanRunActions(activeRobotInstance?: { id?: string }, onPlanCancelled?: () => Promise<boolean | void>) {
  const { toast } = useToast()
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

      // Also pause the robot instance
      const { error: instanceError } = await supabase
        .from('remote_instances')
        .update({
          status: 'paused',
          updated_at: new Date().toISOString()
        })
        .eq('id', activeRobotInstance.id)

      if (instanceError) {
        console.error('❌ Error pausing instance:', instanceError)
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

      // Also resume the robot instance
      const { error: instanceError } = await supabase
        .from('remote_instances')
        .update({
          status: 'running',
          updated_at: new Date().toISOString()
        })
        .eq('id', activeRobotInstance.id)

      if (instanceError) {
        console.error('❌ Error resuming instance:', instanceError)
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
      await cancelInstancePlan(planId, activeRobotInstance.id)

      toast({
        title: "Plan cancelled",
        description: "The plan and its unfinished steps have been cancelled"
      })
    } catch (error) {
      console.error('❌ Error cancelling plan:', error)
      toast({
        title: "Error cancelling plan",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      })
      return
    }
    // Refresh failure is not cancellation failure; never replay the mutation.
    try {
      if (await onPlanCancelled?.() === false) throw new Error("Plan refresh unavailable")
    } catch {
      toast({ title: "Plan cancelled", description: "Refresh the instance to load the updated plans." })
    }
  }

 return { pausePlan, resumePlan, cancelPlan }
}
