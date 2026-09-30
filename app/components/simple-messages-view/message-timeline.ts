import { groupTimelineProcess, type ProcessGroupEntry } from "./group-timeline-process"
import type { InstanceLog, InstancePlan, PlanStep } from "./types"

export function buildMessageTimeline(logs: InstanceLog[], completedPlans: InstancePlan[], instancePlans: InstancePlan[], steps: PlanStep[], areAllStepsCompleted: () => boolean) {
  // Calculate timeline for Explorer view
  const timelineItems: ProcessGroupEntry[] = []
  
  logs.forEach(log => {
    timelineItems.push({
      type: 'log',
      timestamp: log.created_at,
      data: log
    })
  })
  
  // Collect all candidate plans (historical + active) with their display timestamp,
  // then only keep the most recent one (same behavior as requirement_status).
  const candidatePlans: Array<{ timestamp: string; data: InstancePlan }> = []
  const addedPlanIds = new Set<string>()

  // 1. Real historical plans (completed, failed, cancelled)
  completedPlans.forEach(plan => {
    if (addedPlanIds.has(plan.id)) return
    addedPlanIds.add(plan.id)

    const timestamp = plan.completed_at || plan.updated_at || plan.created_at
    candidatePlans.push({ timestamp, data: plan })
  })

  // 2. Active plans (pending, in_progress, etc.)
  instancePlans.forEach(plan => {
    if (addedPlanIds.has(plan.id)) return
    addedPlanIds.add(plan.id)

    const isAllStepsCompleted = areAllStepsCompleted() && steps.some(s => s.planId === plan.id || !s.planId)

    if (isAllStepsCompleted) {
      const timestamp = plan.updated_at || plan.created_at || new Date().toISOString()
      candidatePlans.push({
        timestamp,
        data: {
          ...plan,
          status: 'completed',
          steps: steps.filter(s => s.planId === plan.id || !s.planId)
        }
      })
    } else {
      candidatePlans.push({ timestamp: plan.created_at, data: plan })
    }
  })

  if (candidatePlans.length > 0) {
    const latestPlan = candidatePlans.reduce((latest, current) => {
      const latestTime = new Date(latest.timestamp).getTime()
      const currentTime = new Date(current.timestamp).getTime()
      return currentTime > latestTime ? current : latest
    }, candidatePlans[0])

    timelineItems.push({
      type: 'completed_plan',
      timestamp: latestPlan.timestamp,
      data: latestPlan.data
    })
  }
  
  const sortedTimeline = timelineItems.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime()
    const timeB = new Date(b.timestamp).getTime()
    
    if (timeA === timeB) {
      // Tie-breaker: logs come before plans at the same timestamp
      if (a.type === 'log' && b.type === 'completed_plan') return -1
      if (a.type === 'completed_plan' && b.type === 'log') return 1
    }
    
    return timeA - timeB
  })

  const processedTimeline = groupTimelineProcess(sortedTimeline)
  const lastProcessGroupId = [...processedTimeline]
    .reverse()
    .find((item) => item.type === 'process_group')
    ?.data?.groupId

return { sortedTimeline, processedTimeline, lastProcessGroupId }
}
