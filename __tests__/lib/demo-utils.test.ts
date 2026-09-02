import {
  getDemoSiteId,
  isDemoModeActive,
  isDemoSiteId,
  resolvePreferredSiteId,
} from "@/lib/demo-utils"

describe("getDemoSiteId", () => {
  const originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")

  beforeEach(() => {
    document.cookie = "market_fit_demo_site_id=; max-age=0; path=/"
    localStorage.clear()
    window.history.replaceState({}, "", "/deals")
  })

  afterAll(() => {
    if (originalCookie) {
      Object.defineProperty(document, "cookie", originalCookie)
    }
    localStorage.clear()
  })

  it("prefers ?client= over cookie and localStorage", () => {
    document.cookie = "market_fit_demo_site_id=demo-ecom-es-456; path=/"
    localStorage.setItem("currentSiteId", "demo-saas-en-123")
    window.history.replaceState({}, "", "/deals?client=demo-habituall")

    expect(getDemoSiteId()).toBe("demo-habituall")
    expect(isDemoModeActive()).toBe(true)
  })

  it("reads the demo cookie when the URL has no client", () => {
    document.cookie = "market_fit_demo_site_id=demo-saas-en-123; path=/"
    expect(getDemoSiteId()).toBe("demo-saas-en-123")
  })

  it("falls back to a demo currentSiteId in localStorage", () => {
    localStorage.setItem("currentSiteId", "demo-ecom-es-456")
    expect(getDemoSiteId()).toBe("demo-ecom-es-456")
  })

  it("does not invent a default demo when only the manual flag is set", () => {
    localStorage.setItem("market_fit_manual_demo", "true")
    localStorage.setItem("currentSiteId", "90af1cc6-5a65-48fa-9412-68348b505357")
    expect(getDemoSiteId()).toBeNull()
    expect(isDemoModeActive()).toBe(false)
  })

  it("ignores a real site id in localStorage", () => {
    localStorage.setItem("currentSiteId", "90af1cc6-5a65-48fa-9412-68348b505357")
    expect(isDemoSiteId(localStorage.getItem("currentSiteId"))).toBe(false)
    expect(getDemoSiteId()).toBeNull()
  })
})

describe("resolvePreferredSiteId", () => {
  it("selects the demo site even when localStorage still has a real site", () => {
    expect(
      resolvePreferredSiteId({
        savedSiteId: "90af1cc6-5a65-48fa-9412-68348b505357",
        demoSiteId: "demo-habituall",
      })
    ).toBe("demo-habituall")
  })

  it("keeps the saved site when demo mode is off", () => {
    expect(
      resolvePreferredSiteId({
        savedSiteId: "90af1cc6-5a65-48fa-9412-68348b505357",
        demoSiteId: null,
      })
    ).toBe("90af1cc6-5a65-48fa-9412-68348b505357")
  })
})
