import { StrictMode } from "react"
import { act, cleanup, renderHook } from "@testing-library/react"
import { useBadgeCount } from "@/app/components/navigation/use-badge-count"
import { fetchBadgeCount } from "@/app/components/navigation/badge-count-queries"

let mockSite: { id: string } | null = { id: "site-a" }
let mockSiteLoading = false
let mockAuthLoading = false
let mockUser: { id: string; last_sign_in_at: string } | null = { id: "user-a", last_sign_in_at: "first-sign-in" }

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: mockSite, isLoading: mockSiteLoading }),
}))
jest.mock("@/app/components/auth/auth-context", () => ({
  useAuthContext: () => ({ user: mockUser, isLoading: mockAuthLoading }),
}))
jest.mock("@/app/components/navigation/badge-count-queries", () => ({ fetchBadgeCount: jest.fn() }))

const query = jest.mocked(fetchBadgeCount)

function deferred() {
  let resolve!: (value: number) => void
  let reject!: (error: Error) => void
  const promise = new Promise<number>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

async function settle(action: () => void) {
  await act(async () => { action(); await Promise.resolve() })
}

async function advance(ms: number) {
  await act(async () => { jest.advanceTimersByTime(ms); await Promise.resolve() })
}

function visibility(value: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value })
  document.dispatchEvent(new Event("visibilitychange"))
}

function network(online: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online })
  window.dispatchEvent(new Event(online ? "online" : "offline"))
}

beforeEach(() => {
  jest.useFakeTimers()
  query.mockReset()
  query.mockImplementation(() => new Promise(() => {}))
  mockSite = { id: "site-a" }
  mockUser = { id: "user-a", last_sign_in_at: "first-sign-in" }
  mockSiteLoading = false
  mockAuthLoading = false
  visibility("visible")
  network(true)
  jest.spyOn(Math, "random").mockReturnValue(0.5)
})

afterEach(() => {
  cleanup()
  // React 19 act schedules microtasks; Jest's count includes that queue too.
  jest.runAllTicks()
  expect(jest.getTimerCount()).toBe(0)
  jest.useRealTimers()
  jest.restoreAllMocks()
})

test("completion-driven cadence starts after success, not request start", async () => {
  const first = deferred()
  query.mockReturnValueOnce(first.promise)
  const { result } = renderHook(() => useBadgeCount("chats"))
  await advance(5_000)
  expect(query).toHaveBeenCalledTimes(1)
  await settle(() => first.resolve(7))
  expect(result.current).toBe(7)
  await advance(9_999)
  expect(query).toHaveBeenCalledTimes(1)
  await advance(1)
  expect(query).toHaveBeenCalledTimes(2)
})

test("timeout passes a real signal, retains slot when abort is ignored, and waits on failure", async () => {
  const first = deferred()
  query.mockReturnValueOnce(first.promise)
  const { result } = renderHook(() => useBadgeCount("chats"))
  const signal = query.mock.calls[0][2]
  expect(signal).toBeInstanceOf(AbortSignal)
  await advance(8_000)
  expect(signal.aborted).toBe(true)
  await advance(120_000)
  expect(query).toHaveBeenCalledTimes(1)
  await settle(() => first.resolve(99))
  expect(result.current).toBe(0)
  await advance(17_999)
  expect(query).toHaveBeenCalledTimes(1)
  await advance(1)
  expect(query).toHaveBeenCalledTimes(2)
})

test("site changes abort but wait for settlement; no old-site values reach the hook", async () => {
  const first = deferred()
  const second = deferred()
  query.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const { result, rerender } = renderHook(() => useBadgeCount("requirements"))
  const oldSignal = query.mock.calls[0][2]
  mockSite = { id: "site-b" }
  rerender()
  expect(oldSignal.aborted).toBe(true)
  await advance(100_000)
  expect(query).toHaveBeenCalledTimes(1)
  await settle(() => first.resolve(53))
  expect(result.current).toBe(0)
  expect(query).toHaveBeenCalledTimes(2)
  expect(query.mock.calls[1][1]).toBe("site-b")
  await settle(() => second.resolve(4))
  expect(result.current).toBe(4)
})

test.each(["user", "sign-in"])("same-site %s identity changes discard pending and displayed data", async change => {
  const pending = deferred()
  query.mockResolvedValueOnce(8).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(2)
  const { result, rerender } = renderHook(() => useBadgeCount("chats"))
  await settle(() => {})
  expect(result.current).toBe(8)
  await advance(10_000)
  const oldSignal = query.mock.calls[1][2]
  mockUser = { id: change === "user" ? "user-b" : "user-a", last_sign_in_at: "second-sign-in" }
  rerender()
  expect(result.current).toBe(0)
  expect(oldSignal.aborted).toBe(true)
  expect(query).toHaveBeenCalledTimes(2)
  await settle(() => pending.resolve(55))
  expect(result.current).toBe(2)
  expect(query).toHaveBeenCalledTimes(3)
})

test("logout and site/auth loading disable polling and remove displayed data", async () => {
  query.mockResolvedValue(6)
  const { result, rerender } = renderHook(() => useBadgeCount("chats"))
  await settle(() => {})
  expect(result.current).toBe(6)
  mockUser = null
  rerender()
  expect(result.current).toBe(0)
  await advance(100_000)
  expect(query).toHaveBeenCalledTimes(1)
  mockUser = { id: "user-b", last_sign_in_at: "second" }
  mockAuthLoading = true
  rerender()
  mockAuthLoading = false
  mockSiteLoading = true
  rerender()
  await advance(100_000)
  expect(query).toHaveBeenCalledTimes(1)
  mockSiteLoading = false
  rerender()
  await settle(() => {})
  expect(query).toHaveBeenCalledTimes(2)
})

test.each(["hidden", "offline"])("%s pauses timer/in-flight query and reconnect cannot overlap ignored abort", async reason => {
  const first = deferred()
  query.mockReturnValueOnce(first.promise).mockResolvedValueOnce(3)
  const { result } = renderHook(() => useBadgeCount("content"))
  act(() => { if (reason === "hidden") visibility("hidden"); else network(false) })
  expect(query.mock.calls[0][2].aborted).toBe(true)
  expect(jest.getTimerCount()).toBe(0)
  await advance(300_000)
  act(() => { if (reason === "hidden") visibility("visible"); else network(true) })
  expect(query).toHaveBeenCalledTimes(1)
  await settle(() => first.resolve(77))
  expect(query).toHaveBeenCalledTimes(2)
  expect(result.current).toBe(3)
})

test("initial hidden/offline mount issues no requests until both conditions recover", async () => {
  visibility("hidden")
  network(false)
  renderHook(() => useBadgeCount("chats"))
  await advance(100_000)
  expect(query).not.toHaveBeenCalled()
  act(() => visibility("visible"))
  expect(query).not.toHaveBeenCalled()
  act(() => network(true))
  expect(query).toHaveBeenCalledTimes(1)
})

test("failure delay doubles, is jittered/bounded, survives wake events, and resets on success", async () => {
  query.mockRejectedValue(new Error("unavailable"))
  renderHook(() => useBadgeCount("chats"))
  await settle(() => {})
  for (const delay of [18_000, 36_000, 72_000, 144_000, 270_000, 270_000]) {
    const calls = query.mock.calls.length
    act(() => { visibility("hidden"); visibility("visible"); network(false); network(true) })
    await advance(delay - 1)
    expect(query).toHaveBeenCalledTimes(calls)
    await advance(1)
    expect(query).toHaveBeenCalledTimes(calls + 1)
  }
  query.mockResolvedValueOnce(5)
  await advance(270_000)
  const calls = query.mock.calls.length
  await advance(9_999)
  expect(query).toHaveBeenCalledTimes(calls)
  await advance(1)
  expect(query).toHaveBeenCalledTimes(calls + 1)
})

test("cleanup removes all listeners/timers, aborts request and ignores late rejection", async () => {
  const first = deferred()
  query.mockReturnValueOnce(first.promise)
  const removeDocument = jest.spyOn(document, "removeEventListener")
  const removeWindow = jest.spyOn(window, "removeEventListener")
  const { unmount } = renderHook(() => useBadgeCount("chats"))
  unmount()
  expect(query.mock.calls[0][2].aborted).toBe(true)
  expect(removeDocument).toHaveBeenCalledWith("visibilitychange", expect.any(Function))
  expect(removeWindow).toHaveBeenCalledWith("online", expect.any(Function))
  expect(removeWindow).toHaveBeenCalledWith("offline", expect.any(Function))
  await settle(() => first.reject(new Error("late abort")))
  visibility("visible")
  network(true)
  await advance(300_000)
  expect(query).toHaveBeenCalledTimes(1)
})

test("StrictMode effect replay does not free an unsettled slot", async () => {
  const first = deferred()
  query.mockReturnValueOnce(first.promise)
  renderHook(() => useBadgeCount("chats"), { wrapper: StrictMode })
  expect(query).toHaveBeenCalledTimes(1)
  expect(query.mock.calls[0][2].aborted).toBe(true)
  await settle(() => first.resolve(9))
  expect(query).toHaveBeenCalledTimes(2)
})