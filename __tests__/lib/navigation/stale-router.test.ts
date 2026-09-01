import {
  assignLocation,
  clearClientRouterStale,
  hrefToString,
  isClientRouterStale,
  isSameDestination,
  markClientRouterStale,
  navigateOrAssign,
  startNavigationWatchdog,
} from "@/lib/navigation/stale-router"
import { rememberArtifactSession } from "@/lib/navigation/artifact-url"

function mockLocation(overrides: {
  pathname?: string
  search?: string
  origin?: string
  assign?: jest.Mock
}) {
  const assign = overrides.assign || jest.fn()
  const location = {
    pathname: overrides.pathname ?? "/robots",
    search: overrides.search ?? "",
    origin: overrides.origin ?? "http://localhost",
    href: `${overrides.origin ?? "http://localhost"}${overrides.pathname ?? "/robots"}${overrides.search ?? ""}`,
    assign,
  }
  Object.defineProperty(window, "location", {
    configurable: true,
    value: location,
  })
  return { assign, location }
}

describe("stale-router", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    clearClientRouterStale()
    delete (window as any)._isArtifactSession
    mockLocation({})
  })

  afterEach(() => {
    jest.useRealTimers()
    clearClientRouterStale()
  })

  it("builds string hrefs from Next UrlObjects", () => {
    expect(hrefToString("/leads")).toBe("/leads")
    expect(hrefToString({ pathname: "/dashboard", search: "tab=overview" })).toBe(
      "/dashboard?tab=overview"
    )
    expect(hrefToString({ pathname: "/robots", query: { mode: "imprenta" } })).toBe(
      "/robots?mode=imprenta"
    )
  })

  it("detects the current destination without firing the watchdog", () => {
    expect(isSameDestination("/robots")).toBe(true)
    expect(isSameDestination("/robots?tab=1")).toBe(false)
    expect(isSameDestination("/leads")).toBe(false)
  })

  it("hard-navigates immediately when the client router is stale", () => {
    const { assign } = mockLocation({})
    const router = { push: jest.fn(), replace: jest.fn() }
    markClientRouterStale()
    expect(isClientRouterStale()).toBe(true)

    navigateOrAssign(router, "/leads")

    expect(router.push).not.toHaveBeenCalled()
    expect(assign).toHaveBeenCalledWith("http://localhost/leads")
    expect(isClientRouterStale()).toBe(false)
  })

  it("uses router.push and falls back to assign if the URL does not change", () => {
    const { assign } = mockLocation({})
    const router = { push: jest.fn(), replace: jest.fn() }

    navigateOrAssign(router, "/leads")

    expect(router.push).toHaveBeenCalledWith("/leads")
    expect(assign).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1200)
    expect(assign).toHaveBeenCalledWith("http://localhost/leads")
  })

  it("does not hard-navigate when the destination is already current", () => {
    const { assign } = mockLocation({})
    const router = { push: jest.fn(), replace: jest.fn() }

    navigateOrAssign(router, "/robots")
    jest.advanceTimersByTime(2000)

    expect(router.push).toHaveBeenCalledWith("/robots")
    expect(assign).not.toHaveBeenCalled()
  })

  it("cancels an earlier watchdog when a later navigation starts", () => {
    const { assign, location } = mockLocation({})
    startNavigationWatchdog("/leads")
    location.pathname = "/leads"
    startNavigationWatchdog("/sales")
    jest.advanceTimersByTime(1200)
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith("http://localhost/sales")
  })

  it("assignLocation clears the stale flag", () => {
    const { assign } = mockLocation({})
    markClientRouterStale()
    assignLocation("/profile")
    expect(assign).toHaveBeenCalledWith("http://localhost/profile")
    expect(isClientRouterStale()).toBe(false)
  })

  it("preserves artifact flag when navigating with navigateOrAssign", () => {
    rememberArtifactSession()
    const router = { push: jest.fn(), replace: jest.fn() }
    navigateOrAssign(router, "/leads")
    expect(router.push).toHaveBeenCalledWith("/leads?artifact=true")
  })

  it("preserves artifact flag in assignLocation", () => {
    rememberArtifactSession()
    const { assign } = mockLocation({})
    assignLocation("/leads")
    expect(assign).toHaveBeenCalledWith(expect.stringContaining("/leads?artifact=true"))
  })
})
