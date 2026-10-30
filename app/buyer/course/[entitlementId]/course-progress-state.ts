export type CourseProgress = { lastIndex: number; completedIndexes: number[] }
export type ProgressSnapshot = { progress: CourseProgress; saving: boolean; error: boolean }

const validIndex = (index: unknown, count: number): index is number =>
  typeof index === "number" && Number.isInteger(index) && index >= 0 && index < count

export function sanitizeCourseProgress(value: unknown, count: number): CourseProgress {
  const raw = value && typeof value === "object" ? value as Partial<CourseProgress> : {}
  return {
    lastIndex: validIndex(raw.lastIndex, count) ? raw.lastIndex : 0,
    completedIndexes: Array.isArray(raw.completedIndexes)
      ? [...new Set(raw.completedIndexes.filter(index => validIndex(index, count)))].sort((a, b) => a - b)
      : [],
  }
}

export function updateCourseProgress(progress: CourseProgress, index: number, completed: boolean, count: number): CourseProgress {
  if (!validIndex(index, count) || typeof completed !== "boolean") return progress
  return sanitizeCourseProgress({
    lastIndex: index,
    completedIndexes: completed
      ? [...progress.completedIndexes, index]
      : progress.completedIndexes.filter(value => value !== index),
  }, count)
}

type SaveProgress = (progress: CourseProgress) => Promise<unknown>

// One mounted course owns this queue. Pending snapshots coalesce; requests never overlap.
// SPA unmount removes listeners, not queued saves. Demo omits the writer entirely.
export function createCourseProgressState(initial: unknown, count: number, save?: SaveProgress) {
  let snapshot: ProgressSnapshot = { progress: sanitizeCourseProgress(initial, count), saving: false, error: false }
  let pending: CourseProgress | null = null
  let running = false
  const listeners = new Set<() => void>()
  const publish = (next: ProgressSnapshot) => {
    snapshot = next
    listeners.forEach(listener => listener())
  }

  const drain = async () => {
    if (running || !save || !pending) return
    running = true
    publish({ ...snapshot, saving: true, error: false })
    try {
      while (pending) {
        const next = pending
        pending = null
        const result = await save(next)
        if (!result || typeof result !== "object" || !("success" in result) || result.success !== true || ("error" in result && result.error)) {
          throw new Error("Course progress save was not confirmed")
        }
      }
      publish({ ...snapshot, saving: false, error: false })
    } catch {
      // Keep optimistic progress and retry the latest intent, not the failed older snapshot.
      pending = snapshot.progress
      publish({ ...snapshot, saving: false, error: true })
    } finally {
      running = false
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    update: (index: number, completed: boolean) => {
      const next = updateCourseProgress(snapshot.progress, index, completed, count)
      if (next === snapshot.progress) return
      publish({ ...snapshot, progress: next })
      if (!save) return
      pending = next
      if (!snapshot.error) void drain()
    },
    retry: () => { if (snapshot.error) void drain() },
  }
}