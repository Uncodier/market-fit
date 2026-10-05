import {
  assignLocation, cancelNavigationWatchdog, getNavigationFeedback, hrefToString,
  isSameDestination, navigateOrAssign, NAVIGATION_SLOW_MS, recoverPendingNavigation,
  startNavigationWatchdog,
} from "@/lib/navigation/stale-router"
import { rememberArtifactSession } from "@/lib/navigation/artifact-url"
import { navigateToLead } from "@/lib/navigation/navigation-helpers"

function mockLocation(pathname = "/robots", search = "") {
  const location = { pathname, search, origin: "http://localhost", assign: jest.fn(), replace: jest.fn(), reload: jest.fn(),
    href: `http://localhost${pathname}${search}` }
  Object.defineProperty(window, "location", { configurable: true, value: location })
  return location
}

describe("SPA-first navigation", () => {
  const originalLocation = window.location
  beforeEach(() => {
    jest.useFakeTimers()
    cancelNavigationWatchdog()
    delete (window as Window & { _isArtifactSession?: boolean })._isArtifactSession
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    mockLocation()
  })
  afterEach(() => {
    cancelNavigationWatchdog()
    jest.restoreAllMocks()
    jest.useRealTimers()
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
  })

  it("builds string hrefs from Next UrlObjects", () => {
    expect(hrefToString("/leads")).toBe("/leads")
    expect(hrefToString({ pathname: "/dashboard", search: "tab=overview" })).toBe("/dashboard?tab=overview")
    expect(hrefToString({ pathname: "/robots", query: { mode: "imprenta" } })).toBe("/robots?mode=imprenta")
  })

  it("uses SPA navigation and never reloads merely because time elapses", () => {
    const location = mockLocation()
    const router = { push: jest.fn(), replace: jest.fn() }
    navigateOrAssign(router, "/leads")
    expect(router.push).toHaveBeenCalledWith("/leads")
    jest.advanceTimersByTime(1200)
    expect(getNavigationFeedback()?.status).toBe("pending")
    jest.advanceTimersByTime(10 * 60_000)
    expect(getNavigationFeedback()?.status).toBe("slow")
    expect(location.assign).not.toHaveBeenCalled()
    expect(location.replace).not.toHaveBeenCalled()
    expect(location.reload).not.toHaveBeenCalled()
  })

  it("preserves SPA replace options and only reloads the current document on request", () => {
    const location = mockLocation()
    const router = { push: jest.fn(), replace: jest.fn() }
    navigateOrAssign(router, "/leads", { replace: true, scroll: false })
    expect(router.replace).toHaveBeenCalledWith("/leads", { scroll: false })
    jest.advanceTimersByTime(NAVIGATION_SLOW_MS)
    recoverPendingNavigation(getNavigationFeedback()!.id)
    expect(location.reload).toHaveBeenCalledTimes(1)
    expect(location.replace).not.toHaveBeenCalled()
    expect(location.assign).not.toHaveBeenCalled()
    expect(getNavigationFeedback()).toBeNull()
  })

  it("ignores obsolete recovery actions and keeps only the latest destination", () => {
    const location = mockLocation()
    startNavigationWatchdog("/leads")
    jest.advanceTimersByTime(NAVIGATION_SLOW_MS)
    const oldId = getNavigationFeedback()!.id
    startNavigationWatchdog("/sales")
    jest.advanceTimersByTime(NAVIGATION_SLOW_MS)
    recoverPendingNavigation(oldId)
    expect(location.assign).not.toHaveBeenCalled()
    recoverPendingNavigation(getNavigationFeedback()!.id)
    expect(location.reload).toHaveBeenCalledTimes(1)
    expect(location.assign).not.toHaveBeenCalled()
  })

  it("dismisses feedback after a successful SPA commit and ignores stale callbacks", () => {
    const location = mockLocation()
    startNavigationWatchdog("/leads")
    jest.advanceTimersByTime(NAVIGATION_SLOW_MS)
    const id = getNavigationFeedback()!.id
    location.pathname = "/leads"
    recoverPendingNavigation(id)
    jest.advanceTimersByTime(250)
    expect(getNavigationFeedback()).toBeNull()
    expect(location.assign).not.toHaveBeenCalled()
    expect(location.reload).not.toHaveBeenCalled()
  })

  it("never replays an old target over an untracked newer router intent", () => {
    const location = mockLocation()
    startNavigationWatchdog("/leads")
    jest.advanceTimersByTime(NAVIGATION_SLOW_MS)
    const directRouter = { push: jest.fn() }
    directRouter.push("/sales")
    recoverPendingNavigation(getNavigationFeedback()!.id)
    expect(location.reload).toHaveBeenCalledTimes(1)
    expect(location.assign).not.toHaveBeenCalled()
    expect(location.replace).not.toHaveBeenCalled()
  })

  it.each(["popstate", "current destination"])("cancels recovery on %s", (intent) => {
    const location = mockLocation("/dashboard", "?tab=overview")
    startNavigationWatchdog("/dashboard?tab=traffic")
    jest.advanceTimersByTime(NAVIGATION_SLOW_MS)
    const id = getNavigationFeedback()!.id
    if (intent === "popstate") window.dispatchEvent(new PopStateEvent("popstate"))
    else startNavigationWatchdog("/dashboard?tab=overview")
    recoverPendingNavigation(id)
    expect(getNavigationFeedback()).toBeNull()
    expect(location.assign).not.toHaveBeenCalled()
  })

  it("does not count time in a hidden tab as a stalled navigation", () => {
    startNavigationWatchdog("/leads")
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
    document.dispatchEvent(new Event("visibilitychange"))
    jest.advanceTimersByTime(10 * 60_000)
    expect(getNavigationFeedback()).toBeNull()
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    document.dispatchEvent(new Event("visibilitychange"))
    jest.advanceTimersByTime(1200)
    expect(getNavigationFeedback()?.status).toBe("pending")
  })

  it("handles relative query/hash destinations and external origins correctly", () => {
    mockLocation("/dashboard", "?tab=overview")
    expect(isSameDestination("?tab=overview")).toBe(true)
    expect(isSameDestination("#section")).toBe(true)
    expect(isSameDestination("https://external.example/dashboard?tab=overview")).toBe(false)
    startNavigationWatchdog("#section")
    jest.advanceTimersByTime(NAVIGATION_SLOW_MS)
    expect(getNavigationFeedback()).toBeNull()
  })

  it("preserves artifacts for SPA and does not replace the URL on explicit recovery", () => {
    const location = mockLocation()
    rememberArtifactSession()
    const router = { push: jest.fn(), replace: jest.fn() }
    navigateOrAssign(router, "/leads")
    expect(router.push).toHaveBeenCalledWith("/leads?artifact=true")
    jest.advanceTimersByTime(NAVIGATION_SLOW_MS)
    recoverPendingNavigation(getNavigationFeedback()!.id)
    expect(location.reload).toHaveBeenCalledTimes(1)
    expect(location.assign).not.toHaveBeenCalled()
  })

  it("keeps external navigation explicit and rejects unsafe protocols", () => {
    const location = mockLocation()
    const router = { push: jest.fn(), replace: jest.fn() }
    navigateOrAssign(router, "https://external.example", { replace: true })
    expect(location.replace).toHaveBeenCalledWith("https://external.example/")
    expect(router.push).not.toHaveBeenCalled()
    expect(() => navigateOrAssign(router, "javascript:alert(1)")).toThrow()
    expect(() => assignLocation("data:text/html,hello")).toThrow()
  })

  it("provides recovery for breadcrumb helpers even when storage is unavailable", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked") })
    const router = { push: jest.fn(), replace: jest.fn() }
    navigateToLead({ leadId: "lead-a", leadName: "A B", router })
    expect(router.push).toHaveBeenCalledWith("/leads/lead-a?name=A%20B")
    jest.advanceTimersByTime(NAVIGATION_SLOW_MS)
    expect(getNavigationFeedback()?.status).toBe("slow")
  })
})