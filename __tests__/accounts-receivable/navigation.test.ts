import { NAVIGATION_AREAS, getNavItemTitle, getModuleArea, getNavigationMenuItems, isAreaActive } from "@/app/config/navigation-areas"
import { MODULE_VARIANTS, NAV_ITEM_ICON, getModuleVisual } from "@/app/config/module-visuals"
import { getModuleImagePrompt, getModuleImageUrl } from "@/app/config/module-image-visuals"
import { Receipt } from "@/app/components/ui/icons"
import { routes } from "@/app/config/routes"
import { reduceBreadcrumb } from "@/lib/navigation/breadcrumb-engine"
import { getBlockableNavGroups, getBlockableNavItems, getNavKeyForPath, isScreenBlocked, sanitizeBlockedScreens } from "@/lib/auth/screen-access"

describe("accounts receivable workspace integration", () => {
  it("registers the Sales destination after Subscriptions with the existing workspace layout and readable title", () => {
    const item = NAVIGATION_AREAS.sales.items.find(item => item.key === "accountsReceivable")!
    expect(item.href).toBe("/accounts-receivable")
    expect(getModuleArea(item.key)).toBe("sales")
    expect(getNavItemTitle(item, key => key)).toBe("Accounts Receivable")
    expect(routes.find(route => route.path === item.href)?.hasLayout).toBe(true)
    const salesItems = getNavigationMenuItems("sales")
    expect(salesItems.filter(entry => entry.key === item.key)).toEqual([item])
    expect(salesItems[salesItems.indexOf(item) - 1].key).toBe("subscriptions")
    expect(getNavigationMenuItems("finance").some(entry => entry.key === item.key)).toBe(false)
    expect(isAreaActive("sales", item.href, new URLSearchParams())).toBe(true)
    expect(isAreaActive("finance", item.href, new URLSearchParams())).toBe(false)
    const crumbs = reduceBreadcrumb([{ path: "/sales", label: "Sales", timestamp: 1 }], {
      type: "navigate", path: `${item.href}/detail`, label: "Detail", timestamp: 2,
    })
    expect(crumbs[0]).toMatchObject({ path: item.href, label: "Accounts Receivable" })
  })

  it("keeps the existing firewall key and lists the app once under Sales", () => {
    const key = "accountsReceivable"
    expect(getBlockableNavItems().filter(item => item.key === key)).toHaveLength(1)
    expect(getBlockableNavGroups().filter(group => group.items.some(item => item.key === key)).map(group => group.area)).toEqual(["sales"])
    expect(sanitizeBlockedScreens([key, key])).toEqual([key])
    expect(getNavKeyForPath("/accounts-receivable", new URLSearchParams())).toBe(key)
    expect(isScreenBlocked("collaborator", [key], key)).toBe(true)
    expect(isScreenBlocked("owner", [key], key)).toBe(false)
    expect(isScreenBlocked("admin", [key], key)).toBe(false)
  })

  it("preserves the dedicated emerald/sage visual and receipt icon in Sales", () => {
    expect(NAV_ITEM_ICON.accountsReceivable).toBe(Receipt)
    expect(MODULE_VARIANTS.accountsReceivable).toBeDefined()
    expect(getModuleVisual("sales", "accountsReceivable")).toBe(MODULE_VARIANTS.accountsReceivable)
  })

  it("builds the receipt with the same shared 3D prompt style and image endpoint", () => {
    const prompt = getModuleImagePrompt("sales", "accountsReceivable", "Accounts Receivable")
    expect(prompt).toContain("Front-facing 3D invoice receipt")
    expect(prompt).toContain("folded upper corner")
    expect(prompt).toContain("coin emblem integrated into the lower half")
    expect(prompt).toContain("viewed straight on at eye level")
    expect(prompt).toContain("smooth glossy plastic and frosted glass texture")
    expect(prompt).toContain("no payment card, wallet, calculator")
    expect(prompt).toContain("do not place it inside an app tile")
    expect(prompt).toContain("Octane render, 8k resolution")
    expect(prompt.length).toBeLessThanOrEqual(2_000)
    expect(getModuleImagePrompt("sales", "accountsReceivable", "Another title")).toBe(prompt)
    expect(getModuleImagePrompt("finance", "accountsReceivable", "Accounts Receivable")).toBe(prompt)
    const url = getModuleImageUrl("sales", "accountsReceivable", "Accounts Receivable")
    expect(url).toContain(`/api/public/image/prompt/${encodeURIComponent(prompt)}?width=256&height=256`)
  })
})