import {
  getWorkspaceSiteRedirect,
  shouldClearDemoCookieOnPath,
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

  it("sends signed-in users with no real sites to the buyer portal", () => {
    expect(getWorkspaceSiteRedirect(base)).toBe("/buyer")
  })

  it("sends users with real sites but no selection to projects", () => {
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

  it("does not redirect without a session", () => {
    expect(getWorkspaceSiteRedirect({ ...base, hasValidSession: false })).toBeNull()
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
