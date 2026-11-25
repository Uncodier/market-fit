import { catalogIconUrl } from "@/__tests__/fixtures/module-icon-url"
import { NAVIGATION_AREAS, getNavItemTitle } from "@/app/config/navigation-areas"
import { shouldUseLayout, shouldUseWorkspaceProviders } from "@/app/config/routes"
import { NAV_ITEM_ICON } from "@/app/config/module-visuals"
import { getModuleImagePrompt, getModuleImageUrl } from "@/app/config/module-image-visuals"
import { getBlockableNavItems, getNavKeyForPath } from "@/lib/auth/screen-access"
import { getWorkspaceSiteRedirect } from "@/lib/auth/workspace-site-redirect"
import { translate } from "./fixtures"

test("connectors share navigation, workspace providers, blocked-screen registry and visuals", () => {
  const item = NAVIGATION_AREAS.automation.items.find(entry => entry.key === "connectors")!
  expect(item.href).toBe("/connectors")
  expect(getNavItemTitle(item, translate)).toBe("Connectors")
  expect(getBlockableNavItems()).toContainEqual(item)
  expect(NAV_ITEM_ICON.connectors).toBeDefined()
  for (const path of ["/connectors", "/connectors/mail", "/connectors/callback"]) {
    expect(shouldUseLayout(path)).toBe(true)
    expect(shouldUseWorkspaceProviders(path)).toBe(true)
    expect(getNavKeyForPath(path, new URLSearchParams())).toBe("connectors")
  }
})

test("connectors use their own generated module artwork", () => {
  const prompt = getModuleImagePrompt("automation", "connectors", "Connectors")
  expect(getModuleImageUrl("automation", "connectors", "Connectors")).toEqual(catalogIconUrl("connectors"))
  expect(prompt).toBe(getModuleImagePrompt("automation", "connectors", "Conectores"))
  expect(prompt).toContain("two chunky rounded connector halves joining")
  expect(prompt).toContain("strong legibility at small UI sizes")
  expect(prompt).not.toBe(getModuleImagePrompt("settings", "integrations", "Integrations"))
})

test("callback can recover its original workspace without active SiteContext selection", () => {
  expect(getWorkspaceSiteRedirect({ pathname: "/connectors/callback", isDemoMode: false, hasValidSession: true, realSiteCount: 1, hasRealCurrentSite: false })).toBeNull()
  expect(getWorkspaceSiteRedirect({ pathname: "/connectors", isDemoMode: false, hasValidSession: true, realSiteCount: 1, hasRealCurrentSite: false })).toBe("/projects")
})