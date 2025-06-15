import { useState, useCallback } from 'react'

export type ActivityExecutionState = 'idle' | 'loading' | 'success' | 'error'

export interface ActivityExecutionStatus {
  state: ActivityExecutionState
  message?: string
}

export interface UseActivityExecutionReturn {
  activityStates: Record<string, ActivityExecutionStatus>
  setActivityState: (activityId: string, state: ActivityExecutionState, message?: string) => void
  getActivityState: (activityId: string) => ActivityExecutionStatus
  resetActivityState: (activityId: string) => void
  resetAllStates: () => void
}

export function useActivityExecution(): UseActivityExecutionReturn {
  const [activityStates, setActivityStates] = useState<Record<string, ActivityExecutionStatus>>({})

  const setActivityState = useCallback((activityId: string, state: ActivityExecutionState, message?: string) => {
    setActivityStates(prev => ({
      ...prev,
      [activityId]: { state, message }
    }))
  }, [])

  const getActivityState = useCallback((activityId: string): ActivityExecutionStatus => {
    return activityStates[activityId] || { state: 'idle' }
  }, [activityStates])

  const resetActivityState = useCallback((activityId: string) => {
    setActivityStates(prev => {
      const newStates = { ...prev }
      delete newStates[activityId]
      return newStates
    })
  }, [])

  const resetAllStates = useCallback(() => {
    setActivityStates({})
  }, [])

  return {
    activityStates,
    setActivityState,
    getActivityState,
    resetActivityState,
    resetAllStates
  }
} 