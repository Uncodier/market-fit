import { createCourseProgressState, sanitizeCourseProgress, updateCourseProgress } from "@/app/buyer/course/[entitlementId]/course-progress-state"

const deferred = () => {
  let resolve!: (value: unknown) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { await Promise.resolve(); await Promise.resolve() }

it("sanitizes malformed, duplicate and out-of-range metadata without mutating it", () => {
  const raw = { lastIndex: 99, completedIndexes: [2, 0, 2, -1, 3, 0.5, "1", NaN, Infinity] }
  expect(sanitizeCourseProgress(raw, 3)).toEqual({ lastIndex: 0, completedIndexes: [0, 2] })
  expect(raw.completedIndexes).toHaveLength(9)
  for (const value of [null, undefined, "bad", [], { lastIndex: "1", completedIndexes: {} }]) {
    expect(sanitizeCourseProgress(value, 3)).toEqual({ lastIndex: 0, completedIndexes: [] })
  }
  expect(sanitizeCourseProgress({ lastIndex: 1, completedIndexes: [0, 1] }, 0)).toEqual({ lastIndex: 0, completedIndexes: [] })
})

it("completes, uncompletes and navigates without removing other lessons", () => {
  const initial = { lastIndex: 0, completedIndexes: [0, 2] }
  const next = updateCourseProgress(initial, 0, false, 3)
  expect(next).toEqual({ lastIndex: 0, completedIndexes: [2] })
  expect(updateCourseProgress(next, 2, true, 3)).toEqual({ lastIndex: 2, completedIndexes: [2] })
  expect(updateCourseProgress(next, 1, false, 3)).toEqual({ lastIndex: 1, completedIndexes: [2] })
  expect(updateCourseProgress(next, -1, true, 3)).toBe(next)
  expect(initial.completedIndexes).toEqual([0, 2])
})

it("serializes requests and coalesces rapid updates using the latest optimistic snapshot", async () => {
  const first = deferred()
  const second = deferred()
  const save = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const state = createCourseProgressState(null, 3, save)
  state.update(0, true)
  state.update(1, true)
  state.update(0, false)
  state.update(2, false)
  expect(save).toHaveBeenCalledTimes(1)
  expect(state.getSnapshot()).toEqual({ progress: { lastIndex: 2, completedIndexes: [1] }, saving: true, error: false })
  first.resolve({ success: true })
  await flush()
  expect(save).toHaveBeenNthCalledWith(2, { lastIndex: 2, completedIndexes: [1] })
  expect(state.getSnapshot().saving).toBe(true)
  second.resolve({ success: true })
  await flush()
  expect(state.getSnapshot().saving).toBe(false)
  expect(save).toHaveBeenCalledTimes(2)
})

it.each(["returned", "thrown", "unconfirmed"])("retains latest intent after a %s failure and retries only on request", async failure => {
  const first = deferred()
  const retry = deferred()
  const save = jest.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise)
  const state = createCourseProgressState(null, 3, save)
  state.update(0, true)
  state.update(1, true)
  if (failure === "thrown") first.reject(new Error("private provider details"))
  else first.resolve(failure === "returned" ? { error: "private database details" } : undefined)
  await flush()
  expect(state.getSnapshot().error).toBe(true)
  expect(state.getSnapshot().saving).toBe(false)
  expect(save).toHaveBeenCalledTimes(1)
  state.update(0, false)
  state.update(2, false)
  expect(save).toHaveBeenCalledTimes(1)
  state.retry()
  state.retry()
  expect(save).toHaveBeenCalledTimes(2)
  expect(save).toHaveBeenLastCalledWith({ lastIndex: 2, completedIndexes: [1] })
  retry.resolve({ success: true })
  await flush()
  expect(state.getSnapshot().error).toBe(false)
})

it("does not write initial metadata, invalid events or local-only demo progress", () => {
  const save = jest.fn()
  const state = createCourseProgressState(null, 0, save)
  state.update(0, true)
  state.retry()
  expect(save).not.toHaveBeenCalled()
  const demo = createCourseProgressState(null, 3)
  demo.update(1, true)
  demo.update(1, false)
  expect(demo.getSnapshot()).toEqual({ progress: { lastIndex: 1, completedIndexes: [] }, saving: false, error: false })
})

it("drains queued saves after subscribers unmount without notifying them", async () => {
  const first = deferred()
  const save = jest.fn().mockReturnValueOnce(first.promise).mockResolvedValue({ success: true })
  const state = createCourseProgressState(null, 3, save)
  const listener = jest.fn()
  const unsubscribe = state.subscribe(listener)
  state.update(0, true)
  state.update(2, true)
  unsubscribe()
  listener.mockClear()
  first.resolve({ success: true })
  await flush()
  expect(save).toHaveBeenLastCalledWith({ lastIndex: 2, completedIndexes: [0, 2] })
  expect(listener).not.toHaveBeenCalled()
})