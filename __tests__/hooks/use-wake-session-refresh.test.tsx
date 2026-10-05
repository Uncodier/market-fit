import { StrictMode } from "react"
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react"
import { useRouter } from "next/navigation"
import { useWakeSessionRefresh } from "@/app/hooks/use-wake-session-refresh"
import { createClient } from "@/lib/supabase/client"
import { cancelNavigationWatchdog, navigateOrAssign } from "@/lib/navigation/stale-router"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))

const IDLE_MS = 120_001
const BUDGET_MS = 5000
const COALESCE_MS = 1500
const invalidToken = { code: "refresh_token_not_found", message: "Invalid refresh token" }
const transientError = { code: "request_timeout", message: "Network unavailable" }
type AuthResult = {
  data?: { session: { expires_at?: number } | null }
  error: typeof invalidToken | null
}
const auth = { getSession: jest.fn(), refreshSession: jest.fn(), signOut: jest.fn() }
const router = {
  push: jest.fn(), replace: jest.fn(), refresh: jest.fn(), back: jest.fn(),
  forward: jest.fn(), prefetch: jest.fn(), bfcacheId: "wake-test",
}
const sessionResult = (seconds = 3600): AuthResult => ({
  data: { session: { expires_at: Math.floor(Date.now() / 1000) + seconds } }, error: null,
})

function deferred() {
  let resolve!: (value: AuthResult) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<AuthResult>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function advance(ms: number) {
  act(() => jest.advanceTimersByTime(ms))
}

async function flush() {
  await act(async () => {})
}

function dispatch(type: string, persisted = false) {
  const event = new Event(type)
  if (type === "pageshow") Object.defineProperty(event, "persisted", { value: persisted })
  act(() => (type === "visibilitychange" ? document : window).dispatchEvent(event))
}

function NavigationHarness() {
  useWakeSessionRefresh()
  const navigation = useRouter()
  return <button onClick={() => navigateOrAssign(navigation, "/leads")}>Leads</button>
}

describe("useWakeSessionRefresh", () => {
  const originalLocation = window.location
  let visibility: DocumentVisibilityState
  let online: boolean
  let location: { href: string; assign: jest.Mock; replace: jest.Mock; reload: jest.Mock }

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["queueMicrotask"] })
    jest.setSystemTime(new Date("2026-10-01T12:00:00Z"))
    jest.clearAllMocks()
    visibility = "visible"
    online = true
    jest.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility)
    jest.spyOn(navigator, "onLine", "get").mockImplementation(() => online)
    location = {
      href: "http://localhost/dashboard", assign: jest.fn(), replace: jest.fn(), reload: jest.fn(),
    }
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...location, origin: "http://localhost", pathname: "/dashboard", search: "" },
    })
    jest.mocked(createClient).mockReturnValue({ auth } as ReturnType<typeof createClient>)
    jest.mocked(useRouter).mockReturnValue(router)
    auth.getSession.mockReset().mockImplementation(() => Promise.resolve(sessionResult()))
    auth.refreshSession.mockReset().mockResolvedValue({ error: null })
    auth.signOut.mockReset().mockResolvedValue({ error: null })
  })

  afterEach(async () => {
    cleanup()
    await flush()
    cancelNavigationWatchdog()
    expect(jest.getTimerCount()).toBe(0)
    expect(router.refresh).not.toHaveBeenCalled()
    expect(location.assign).not.toHaveBeenCalled()
    expect(location.replace).not.toHaveBeenCalled()
    expect(location.reload).not.toHaveBeenCalled()
    expect(window.location.href).toBe(location.href)
    document.body.style.pointerEvents = ""
    document.documentElement.style.pointerEvents = ""
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it("does not check on mount, brief focus, or ordinary pageshow", async () => {
    renderHook(useWakeSessionRefresh)
    advance(1000)
    dispatch("focus")
    dispatch("visibilitychange")
    advance(IDLE_MS)
    dispatch("pageshow")
    await flush()
    expect(auth.getSession).not.toHaveBeenCalled()
  })

  it.each(["focus", "visibilitychange", "pointerdown", "keydown"])(
    "checks fresh sessions after idle via %s without refreshing", async (event) => {
      renderHook(useWakeSessionRefresh)
      advance(IDLE_MS)
      dispatch(event)
      await flush()
      expect(auth.getSession).toHaveBeenCalledTimes(1)
      expect(auth.refreshSession).not.toHaveBeenCalled()
      expect(auth.signOut).not.toHaveBeenCalled()
    },
  )

  it.each(["fresh", "expiring", "missing"])("keeps the next click SPA-first with a %s session", async (state) => {
    auth.getSession.mockImplementation(() => Promise.resolve(state === "missing"
      ? { data: { session: null }, error: null } : sessionResult(state === "fresh" ? 121 : 120)))
    render(<NavigationHarness />)
    advance(IDLE_MS)
    dispatch("focus")
    await flush()
    expect(auth.refreshSession).toHaveBeenCalledTimes(state === "expiring" ? 1 : 0)
    expect(router.push).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Leads" }))
    expect(router.push).toHaveBeenCalledWith("/leads")
    advance(60_000)
  })

  it.each([120, 1, -1, undefined])("refreshes sessions expiring in %s seconds", async (seconds) => {
    auth.getSession.mockImplementation(() => Promise.resolve(seconds === undefined
      ? { data: { session: {} }, error: null } : sessionResult(seconds)))
    renderHook(useWakeSessionRefresh)
    advance(IDLE_MS)
    dispatch("focus")
    await flush()
    expect(auth.refreshSession).toHaveBeenCalledTimes(1)
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it("leaves missing sessions to existing auth boundaries", async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    renderHook(useWakeSessionRefresh)
    advance(IDLE_MS)
    dispatch("focus")
    await flush()
    expect(auth.getSession).toHaveBeenCalledTimes(1)
    expect(auth.refreshSession).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
    expect(router.replace).not.toHaveBeenCalled()
  })

  it("coalesces duplicate wake events even after auth settles, then permits another wake", async () => {
    renderHook(useWakeSessionRefresh)
    advance(IDLE_MS)
    dispatch("focus")
    dispatch("visibilitychange")
    dispatch("pageshow", true)
    dispatch("online")
    await flush()
    advance(COALESCE_MS - 1)
    dispatch("pageshow", true)
    dispatch("online")
    await flush()
    expect(auth.getSession).toHaveBeenCalledTimes(1)
    advance(1)
    dispatch("pageshow", true)
    await flush()
    expect(auth.getSession).toHaveBeenCalledTimes(2)
  })

  it("checks persisted bfcache restores even without a recorded idle period", async () => {
    renderHook(useWakeSessionRefresh)
    dispatch("pageshow", true)
    await flush()
    expect(auth.getSession).toHaveBeenCalledTimes(1)
  })

  it.each([true, false])("preserves hidden idle when pointerdown arrives first (visible=%s)", async (visibleFirst) => {
    renderHook(useWakeSessionRefresh)
    visibility = "hidden"
    dispatch("visibilitychange")
    advance(IDLE_MS)
    dispatch("visibilitychange") // Repeated hidden events must not reset the timestamp.
    if (visibleFirst) visibility = "visible"
    dispatch("pointerdown")
    visibility = "visible"
    dispatch("focus")
    dispatch("visibilitychange")
    await flush()
    expect(auth.getSession).toHaveBeenCalledTimes(1)
  })

  it("tracks ordinary activity and ignores wakes while hidden", async () => {
    renderHook(useWakeSessionRefresh)
    advance(60_000)
    dispatch("keydown")
    advance(60_000)
    dispatch("pointerdown")
    dispatch("focus")
    visibility = "hidden"
    dispatch("visibilitychange")
    advance(IDLE_MS)
    dispatch("focus")
    dispatch("pageshow", true)
    dispatch("online")
    await flush()
    expect(auth.getSession).not.toHaveBeenCalled()
    visibility = "visible"
    dispatch("visibilitychange")
    await flush()
    expect(auth.getSession).toHaveBeenCalledTimes(1)
  })

  it("skips offline auth and checks immediately when connectivity returns", async () => {
    online = false
    renderHook(useWakeSessionRefresh)
    advance(IDLE_MS)
    dispatch("focus")
    dispatch("pageshow", true)
    await flush()
    expect(auth.getSession).not.toHaveBeenCalled()
    online = true
    dispatch("online")
    dispatch("focus")
    await flush()
    expect(auth.getSession).toHaveBeenCalledTimes(1)
  })

  it("does not refresh when connectivity is lost while reading the session", async () => {
    const pending = deferred()
    auth.getSession.mockReturnValueOnce(pending.promise)
    renderHook(useWakeSessionRefresh)
    dispatch("online")
    online = false
    pending.resolve(sessionResult(1))
    await flush()
    expect(auth.refreshSession).not.toHaveBeenCalled()
  })

  it("preserves modal pointer-event styles", async () => {
    render(<div role="dialog" aria-modal="true">Open modal</div>)
    renderHook(useWakeSessionRefresh)
    document.body.style.pointerEvents = "none"
    document.documentElement.style.pointerEvents = "none"
    advance(IDLE_MS)
    dispatch("focus")
    await flush()
    expect(document.body.style.pointerEvents).toBe("none")
    expect(document.documentElement.style.pointerEvents).toBe("none")
  })

  describe.each(["getSession", "refreshSession"] as const)("%s failures", (method) => {
    it.each([
      ["returned", invalidToken, true], ["thrown", invalidToken, true],
      ["returned", transientError, false], ["thrown", transientError, false],
    ] as const)("handles %s errors (%j) with local logout=%s", async (mode, error, shouldLogout) => {
      auth.getSession.mockImplementation(() => Promise.resolve(sessionResult(1)))
      if (mode === "returned") auth[method].mockResolvedValue({ data: { session: null }, error })
      else auth[method].mockRejectedValue(error)
      renderHook(useWakeSessionRefresh)
      dispatch("online")
      await flush()
      if (shouldLogout) {
        expect(auth.signOut).toHaveBeenCalledTimes(1)
        expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" })
      } else expect(auth.signOut).not.toHaveBeenCalled()
      if (method === "getSession") expect(auth.refreshSession).not.toHaveBeenCalled()
    })
  })

  it("tolerates local logout rejection", async () => {
    auth.getSession.mockRejectedValue(invalidToken)
    auth.signOut.mockRejectedValue(transientError)
    renderHook(useWakeSessionRefresh)
    dispatch("online")
    await flush()
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(jest.getTimerCount()).toBe(0)
  })

  it("shares one complete session/refresh flight across mounted consumers", async () => {
    const reading = deferred()
    const refreshing = deferred()
    auth.getSession.mockReturnValueOnce(reading.promise)
    auth.refreshSession.mockReturnValueOnce(refreshing.promise)
    renderHook(useWakeSessionRefresh)
    renderHook(useWakeSessionRefresh)
    dispatch("online")
    expect(auth.getSession).toHaveBeenCalledTimes(1)
    reading.resolve(sessionResult(1))
    await flush()
    advance(COALESCE_MS)
    dispatch("pageshow", true)
    expect(auth.getSession).toHaveBeenCalledTimes(1)
    expect(auth.refreshSession).toHaveBeenCalledTimes(1)
    refreshing.resolve({ error: null })
    await flush()
    expect(jest.getTimerCount()).toBe(0)
  })

  it.each(["getSession", "refreshSession", "signOut"] as const)(
    "bounds observation of hanging %s without parallel auth or blocking SPA navigation", async (method) => {
      const pending = deferred()
      auth.getSession.mockImplementation(() => Promise.resolve(sessionResult(1)))
      if (method === "signOut") auth.refreshSession.mockResolvedValue({ error: invalidToken })
      auth[method].mockReturnValueOnce(pending.promise)
      render(<NavigationHarness />)
      advance(IDLE_MS)
      dispatch("focus")
      await flush()
      expect(auth[method]).toHaveBeenCalledTimes(1)
      advance(BUDGET_MS)
      expect(jest.getTimerCount()).toBe(0)
      renderHook(useWakeSessionRefresh)
      for (let i = 0; i < 3; i++) {
        advance(IDLE_MS)
        dispatch("online")
        dispatch("focus")
      }
      expect(auth.getSession).toHaveBeenCalledTimes(1)
      expect(auth[method]).toHaveBeenCalledTimes(1)
      fireEvent.click(screen.getByRole("button", { name: "Leads" }))
      expect(router.push).toHaveBeenCalledWith("/leads")
      advance(60_000)
      pending.resolve(method === "getSession" ? sessionResult(1) : { error: invalidToken })
      await flush()
      expect(auth.refreshSession).toHaveBeenCalledTimes(method === "getSession" ? 0 : 1)
      expect(auth.signOut).toHaveBeenCalledTimes(method === "signOut" ? 1 : 0)
      auth.getSession.mockImplementation(() => Promise.resolve(sessionResult()))
      dispatch("online")
      await flush()
      expect(auth.getSession).toHaveBeenCalledTimes(2)
    },
  )

  it.each(["returned", "thrown"])("ignores %s invalid errors after the budget even before timers resume", async (mode) => {
    const pending = deferred()
    auth.getSession.mockReturnValueOnce(pending.promise)
    renderHook(useWakeSessionRefresh)
    dispatch("online")
    // Sleeping browsers may resume promise callbacks before overdue timers.
    jest.setSystemTime(Date.now() + BUDGET_MS)
    if (mode === "returned") pending.resolve({ error: invalidToken })
    else pending.reject(invalidToken)
    await flush()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(auth.refreshSession).not.toHaveBeenCalled()
  })

  it.each(["getSession", "refreshSession"] as const)("suppresses late %s side effects across unmount/remount", async (method) => {
    const pending = deferred()
    auth.getSession.mockImplementation(() => Promise.resolve(sessionResult(1)))
    auth[method].mockReturnValueOnce(pending.promise)
    const first = renderHook(useWakeSessionRefresh)
    dispatch("online")
    await flush()
    first.unmount()
    expect(jest.getTimerCount()).toBe(0)
    renderHook(useWakeSessionRefresh)
    dispatch("online")
    expect(auth.getSession).toHaveBeenCalledTimes(1)
    pending.resolve(method === "getSession" ? sessionResult(1) : { error: invalidToken })
    await flush()
    expect(auth.refreshSession).toHaveBeenCalledTimes(method === "getSession" ? 0 : 1)
    expect(auth.signOut).not.toHaveBeenCalled()
    advance(COALESCE_MS)
    dispatch("online")
    await flush()
    expect(auth.getSession).toHaveBeenCalledTimes(2)
  })

  it("does not log out on an invalid getSession result delivered after unmount", async () => {
    const pending = deferred()
    auth.getSession.mockReturnValueOnce(pending.promise)
    const { unmount } = renderHook(useWakeSessionRefresh)
    dispatch("online")
    unmount()
    pending.resolve({ error: invalidToken })
    await flush()
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it("removes all listeners and timers, including Strict Mode effect replay", async () => {
    const removeWindow = jest.spyOn(window, "removeEventListener")
    const removeDocument = jest.spyOn(document, "removeEventListener")
    const { unmount } = renderHook(useWakeSessionRefresh, { wrapper: StrictMode })
    advance(IDLE_MS)
    dispatch("focus")
    await flush()
    expect(auth.getSession).toHaveBeenCalledTimes(1)
    unmount()
    for (const event of ["focus", "pageshow", "online", "pointerdown", "keydown"]) {
      expect(removeWindow).toHaveBeenCalledWith(event, expect.any(Function))
      dispatch(event, true)
    }
    expect(removeDocument).toHaveBeenCalledWith("visibilitychange", expect.any(Function))
    dispatch("visibilitychange")
    advance(IDLE_MS)
    await flush()
    expect(auth.getSession).toHaveBeenCalledTimes(1)
  })
})