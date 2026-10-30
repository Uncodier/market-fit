"use client"

import { useState, useSyncExternalStore } from "react"
import { saveCourseProgress } from "@/app/commerce/course-progress"
import { createCourseProgressState } from "./course-progress-state"

// The parent keys this hook's owner by entitlement, course, lesson count and demo mode.
export function useCourseProgress(entitlementId: string, initial: unknown, count: number, demo: boolean) {
  const [state] = useState(() => createCourseProgressState(
    initial,
    count,
    demo ? undefined : progress => saveCourseProgress(entitlementId, progress),
  ))
  const snapshot = useSyncExternalStore(state.subscribe, state.getSnapshot, state.getSnapshot)
  return { ...snapshot, onProgressUpdate: state.update, retry: state.retry }
}