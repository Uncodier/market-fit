import {
  getWorkspaceSiteRedirect,
  shouldClearDemoCookieOnPath,
  unauthorizedSitesLoadAction,
} from "@/lib/auth/workspace-site-redirect"

describe("getWorkspaceSiteRedirect", () => {
  const base = {
    pathname: "/robots",
    isDemoMode: false,
    hasValidSession: true,
    realSiteCount: 0,
    hasRealCurrentSite: false,
  }

  it("does not kick demo accounts off robots or other workspace pages", () => {
    expect(getWorkspaceSiteRedirect({ ...base, isDemoMode: true })).toBeNull()
    expect(getWorkspaceSiteRedirect({ ...base, isDemoMode: true, pathname: "/catalog" })).toBeNull()
  })

  it("sends signed-in users on a workspace page with no current site to projects picker", () => {
    // Both 0 sites and >0 sites bounce to /projects if there is no current site.
    // They no longer go to /buyer or /create-site.
    expect(getWorkspaceSiteRedirect({ ...base, realSiteCount: 0 })).toBe("/projects")
    expect(
      getWorkspaceSiteRedirect({
        ...base,
        realSiteCount: 2,
        hasRealCurrentSite: false,
      })
    ).toBe("/projects")
  })

  it("does not redirect commerce, auth, or demo selector routes", () => {
    expect(getWorkspaceSiteRedirect({ ...base, pathname: "/buyer" })).toBeNull()
    expect(getWorkspaceSiteRedirect({ ...base, pathname: "/buyer/profile" })).toBeNull()
    expect(getWorkspaceSiteRedirect({ ...base, pathname: "/auth" })).toBeNull()
    expect(getWorkspaceSiteRedirect({ ...base, pathname: "/demo" })).toBeNull()
    expect(getWorkspaceSiteRedirect({ ...base, pathname: "/projects" })).toBeNull()
  })

  it("does not kick buyers off account profile when no workspace site is selected", () => {
    expect(getWorkspaceSiteRedirect({ ...base, pathname: "/profile" })).toBeNull()
    expect(
      getWorkspaceSiteRedirect({
        ...base,
        pathname: "/profile",
        realSiteCount: 2,
        hasRealCurrentSite: false,
      })
    ).toBeNull()
  })

  it("does not redirect when a real site is already selected", () => {
    expect(
      getWorkspaceSiteRedirect({
        ...base,
        realSiteCount: 2,
        hasRealCurrentSite: true,
      })
    ).toBeNull()
  })

  it("does not redirect without a session", () => {
    expect(getWorkspaceSiteRedirect({ ...base, hasValidSession: false })).toBeNull()
  })

  it("never sends workspace users to /buyer or /create-site", () => {
    const destinations = [
      getWorkspaceSiteRedirect(base),
      getWorkspaceSiteRedirect({ ...base, realSiteCount: 3 }),
      getWorkspaceSiteRedirect({ ...base, pathname: "/catalog" }),
    ]
    for (const destination of destinations) {
      expect(destination).not.toBe("/buyer")
      expect(destination).not.toBe("/create-site")
    }
  })
})

describe("shouldClearDemoCookieOnPath", () => {
  it("keeps the demo cookie on the buyer portal", () => {
    expect(shouldClearDemoCookieOnPath("/buyer")).toBe(false)
    expect(shouldClearDemoCookieOnPath("/buyer/orders")).toBe(false)
  })

  it("clears the demo cookie on public storefronts", () => {
    expect(shouldClearDemoCookieOnPath("/shop/acme")).toBe(true)
    expect(shouldClearDemoCookieOnPath("/marketplace")).toBe(true)
    expect(shouldClearDemoCookieOnPath("/cart")).toBe(true)
  })
})

describe("unauthorizedSitesLoadAction", () => {
  it("retries while a local session exists (cookie race after login)", () => {
    expect(
      unauthorizedSitesLoadAction({ hasLocalUser: true, retriesSoFar: 0 })
    ).toBe("retry")
    expect(
      unauthorizedSitesLoadAction({ hasLocalUser: true, retriesSoFar: 1 })
    ).toBe("retry")
  })

  it("finishes the load after retries so the wrapper can bounce to /projects", () => {
    expect(
      unauthorizedSitesLoadAction({ hasLocalUser: true, retriesSoFar: 2 })
    ).toBe("finish")
  })

  it("waits for a session event when there is no local user", () => {
    expect(
      unauthorizedSitesLoadAction({ hasLocalUser: false, retriesSoFar: 0 })
    ).toBe("wait-for-session")
  })
})
