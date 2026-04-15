import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InstancePlan, PlanStep } from '../types'
import { removeDuplicateSteps } from '../utils'

interface UseInstancePlansProps {
  activeRobotInstance?: any
}

export const useInstancePlans = ({ activeRobotInstance }: UseInstancePlansProps) => {
  const [steps, setSteps] = useState<PlanStep[]>([])
  const [instancePlans, setInstancePlans] = useState<InstancePlan[]>([])
  const [completedPlans, setCompletedPlans] = useState<InstancePlan[]>([])
  const [isLoadingPlans, setIsLoadingPlans] = useState(false)

  // Load instance plans with proper status management
  const loadInstancePlans = useCallback(async () => {
    
    // First, let's test if the table exists regardless of activeRobotInstance
    try {
      const supabase = createClient()
      
      const { data: tableTest, error: tableError, count: totalCount } = await supabase
        .from('instance_plans')
        .select('id', { count: 'exact' })
        .limit(1)
      
    } catch (testError) {
      console.error('🔧 Table test failed:', testError)
    }
    
    if (!activeRobotInstance?.id) {
      setInstancePlans([])
      setSteps([])
      return
    }

    const instanceId = activeRobotInstance.id
    

    setIsLoadingPlans(true)
    try {
      const supabase = createClient()
      
      
      // Query instance plans using the remote_instances.id
      const { data, error, count } = await supabase
        .from('instance_plans')
        .select('*', { count: 'exact' })
        .eq('instance_id', instanceId)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })


      if (error) {
        console.error('❌ Error loading instance plans:', error)
        setInstancePlans([])
        setSteps([])
        
        // Debug: Check if table exists and has any data
        try {
          const { data: allPlans, error: debugError, count: totalCount } = await supabase
            .from('instance_plans')
            .select('id, instance_id, title, status', { count: 'exact' })
            .limit(5)
          
        } catch (debugErr) {
          console.error('🔧 Debug query failed:', debugErr)
        }
      } else {
        const allPlans = data || []
        
        // Categorize plans by status for better management
        // Only ONE plan should be in_progress at a time
        const inProgressPlans = allPlans.filter((plan: InstancePlan) => plan.status === 'in_progress')
        const pausedPlans = allPlans.filter((plan: InstancePlan) => plan.status === 'paused')
        const pendingPlans = allPlans.filter((plan: InstancePlan) => plan.status === 'pending')
        const failedPlans = allPlans.filter((plan: InstancePlan) => plan.status === 'failed')
        const cancelledPlans = allPlans.filter((plan: InstancePlan) => plan.status === 'cancelled')
        const blockedPlans = allPlans.filter((plan: InstancePlan) => plan.status === 'blocked')
        const completedPlansData = allPlans.filter((plan: InstancePlan) => plan.status === 'completed')
        
        // Log plan status distribution for debugging
        
        // Warn if multiple plans are in_progress (should only be one)
        if (inProgressPlans.length > 1) {
          console.warn('⚠️ Multiple plans in progress detected! Only one plan should be in_progress at a time:', 
            inProgressPlans.map((p: InstancePlan) => ({ id: p.id, title: p.title }))
          )
        }
        
        // Active plans include: in_progress, paused, pending, and blocked (but NOT failed, cancelled, or completed)
        const activePlans = [...inProgressPlans, ...pausedPlans, ...pendingPlans, ...blockedPlans]
        
        // Historical plans include: completed, failed, and cancelled
        const historicalPlans = [...completedPlansData, ...failedPlans, ...cancelledPlans]
        
        
        setInstancePlans(activePlans)
        setCompletedPlans(historicalPlans)
        
        // If no active plans found, just continue without creating test data
        if (activePlans.length === 0) {
          setSteps([])
          return
        }
        
        // Convert only ACTIVE instance plans to step format for the UI
        let convertedSteps: PlanStep[] = []
        
        // Extract steps from the plan structure
        const usedIds = new Set<string>()
        
        // Find the most recently created active plan (if any)
        const latestActivePlan = activePlans.length > 0 
          ? [...activePlans].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
          : null;
          
        if (latestActivePlan && latestActivePlan.steps && Array.isArray(latestActivePlan.steps) && latestActivePlan.steps.length > 0) {
          // Use steps directly from the plan
          const planSteps = latestActivePlan.steps.map((step: any, stepIndex: number) => {
            let stepId = step.id
            
            // Ensure unique ID - use plan ID as prefix for uniqueness across plans
            if (!stepId || usedIds.has(stepId)) {
              stepId = `${latestActivePlan.id}_step_${stepIndex}_${Math.random().toString(36).substring(7)}`
              while (usedIds.has(stepId)) {
                stepId = `${latestActivePlan.id}_step_${stepIndex}_${Math.random().toString(36).substring(7)}`
              }
            }
            usedIds.add(stepId)
            
            return {
              id: stepId,
              title: step.title || `Step ${stepIndex + 1}`,
              description: step.description || undefined,
              status: step.status || 'pending' as const,
              order: stepIndex + 1,
              planId: latestActivePlan.id // Track which plan this step belongs to
            }
          })
          convertedSteps = planSteps
        }
        
        
        // Remove any duplicates before setting state
        const uniqueSteps = removeDuplicateSteps(convertedSteps)
        setSteps(uniqueSteps)
      }
    } catch (error) {
      console.error('Error loading instance plans:', error)
      setInstancePlans([])
      setSteps([])
    } finally {
      setIsLoadingPlans(false)
    }
  }, [activeRobotInstance])

  // Get current step
  const getCurrentStep = useCallback(() => {
    
    // Check if all steps are completed
    const allCompleted = steps.length > 0 && steps.every(step => step.status === 'completed')
    
    if (allCompleted) {
      // If all steps are completed, return the first step
      return steps[0]
    }
    
    const inProgressStep = steps.find(step => step.status === 'in_progress')
    if (inProgressStep) return inProgressStep
    
    const firstPendingStep = steps.find(step => step.status === 'pending')
    const result = firstPendingStep || steps[0]
    return result
  }, [steps])

  // Check if all steps are completed
  const areAllStepsCompleted = useCallback(() => {
    return steps.length > 0 && steps.every(step => step.status === 'completed')
  }, [steps])

  // Create unified timeline of logs and completed plans
  const createUnifiedTimeline = useCallback(() => {
    const timelineItems: Array<{
      type: 'log' | 'completed_plan'
      timestamp: string
      data: any
    }> = []

    // Add completed plans to timeline
    completedPlans.forEach(plan => {
      const timestamp = plan.completed_at || plan.updated_at || plan.created_at
      timelineItems.push({
        type: 'completed_plan',
        timestamp: timestamp,
        data: plan
      })
    })

    // Sort by timestamp
    return timelineItems.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )
  }, [completedPlans])

  // Load data when activeRobotInstance changes
  useEffect(() => {
    loadInstancePlans()
  }, [activeRobotInstance?.id])

  // Set up real-time subscription for plan updates
  useEffect(() => {
    if (!activeRobotInstance?.id) return

    
    const supabase = createClient()
    
    const subscription = supabase
      .channel('instance_plans_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'instance_plans',
          filter: `instance_id=eq.${activeRobotInstance.id}`
        },
        (payload) => {
          // Reload plans when there are changes
          loadInstancePlans()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [activeRobotInstance?.id])

  return {
    steps,
    instancePlans,
    completedPlans,
    isLoadingPlans,
    loadInstancePlans,
    getCurrentStep,
    areAllStepsCompleted,
    createUnifiedTimeline
  }
}
