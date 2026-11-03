import { NAVIGATION_AREAS, getNavItemTitle, getModuleArea, getNavigationMenuItems, isAreaActive } from "@/app/config/navigation-areas"
import { MODULE_VARIANTS, NAV_ITEM_ICON, getModuleVisual } from "@/app/config/module-visuals"
import { getModuleImagePrompt, getModuleImageUrl } from "@/app/config/module-image-visuals"
import { Receipt } from "@/app/components/ui/icons"
import { routes } from "@/app/config/routes"
import { reduceBreadcrumb } from "@/lib/navigation/breadcrumb-engine"
import { getBlockableNavGroups, getBlockableNavItems, getNavKeyForPath, isScreenBlocked, sanitizeBlockedScreens } from "@/lib/auth/screen-access"
import { rawLocaleMessages } from "@/app/context/locale-catalog"

describe("accounts payable workspace integration", () => {
  it.each(["en", "es", "fr", "de", "ja"] as const)("provides native %s page, picker and sidebar messages without fallback", locale => {
    const messages = rawLocaleMessages[locale]
    const item = NAVIGATION_AREAS.buying.items.find(item => item.key === "accountsPayable")!
    expect(getNavItemTitle(item, key => messages[key] || key)).toBe(messages["operations.payables.title"])
    const englishKeys = Object.keys(rawLocaleMessages.en).filter(key => key.startsWith("operations.payables."))
    expect(englishKeys.length).toBeGreaterThan(30)
    for (const key of englishKeys) expect(messages[key]).toBeTruthy()
  })
  it("registers the Buying destination after Bills with the existing workspace layout and readable title", () => {
    const item = NAVIGATION_AREAS.buying.items.find(item => item.key === "accountsPayable")!
    expect(item.href).toBe("/accounts-payable")
    expect(getModuleArea(item.key)).toBe("buying")
    expect(getNavItemTitle(item, key => key)).toBe("Accounts Payable")
    expect(routes.find(route => route.path === item.href)?.hasLayout).toBe(true)
    const buyingItems = getNavigationMenuItems("buying")
    expect(buyingItems.filter(entry => entry.key === item.key)).toEqual([item])
    expect(buyingItems[buyingItems.indexOf(item) - 1].key).toBe("bills")
    expect(getNavigationMenuItems("finance").some(entry => entry.key === item.key)).toBe(false)
    expect(isAreaActive("buying", item.href, new URLSearchParams())).toBe(true)
    expect(isAreaActive("finance", item.href, new URLSearchParams())).toBe(false)
    const crumbs = reduceBreadcrumb([{ path: "/buying", label: "Buying", timestamp: 1 }], {
      type: "navigate", path: `${item.href}/detail`, label: "Detail", timestamp: 2,
    })
    expect(crumbs[0]).toMatchObject({ path: item.href, label: "Accounts Payable" })
  })

  it("keeps the existing firewall key and lists the app once under Buying", () => {
    const key = "accountsPayable"
    expect(getBlockableNavItems().filter(item => item.key === key)).toHaveLength(1)
    expect(getBlockableNavGroups().filter(group => group.items.some(item => item.key === key)).map(group => group.area)).toEqual(["buying"])
    expect(sanitizeBlockedScreens([key, key])).toEqual([key])
    expect(getNavKeyForPath("/accounts-payable", new URLSearchParams())).toBe(key)
    expect(isScreenBlocked("collaborator", [key], key)).toBe(true)
    expect(isScreenBlocked("owner", [key], key)).toBe(false)
    expect(isScreenBlocked("admin", [key], key)).toBe(false)
  })

  it("preserves the dedicated emerald/sage visual and receipt icon in Buying", () => {
    expect(NAV_ITEM_ICON.accountsPayable).toBe(Receipt)
    expect(MODULE_VARIANTS.accountsPayable).toBeDefined()
    expect(getModuleVisual("buying", "accountsPayable")).toBe(MODULE_VARIANTS.accountsPayable)
  })

  it("builds the receipt with the same shared 3D prompt style and image endpoint", () => {
    const prompt = getModuleImagePrompt("buying", "accountsPayable", "Accounts Payable")
    expect(prompt).toContain("Front-facing 3D invoice receipt")
    expect(prompt).toContain("folded upper corner")
    expect(prompt).toContain("coin emblem integrated into the lower half")
    expect(prompt).toContain("viewed straight on at eye level")
    expect(prompt).toContain("smooth glossy plastic and frosted glass texture")
    expect(prompt).toContain("no payment card, wallet, calculator")
    expect(prompt).toContain("do not place it inside an app tile")
    expect(prompt).toContain("Octane render, 8k resolution")
    expect(prompt.length).toBeLessThanOrEqual(2_000)
    expect(getModuleImagePrompt("buying", "accountsPayable", "Another title")).toBe(prompt)
    expect(getModuleImagePrompt("finance", "accountsPayable", "Accounts Payable")).toBe(prompt)
    const url = getModuleImageUrl("buying", "accountsPayable", "Accounts Payable")
    expect(url).toContain(`/api/public/image/prompt/${encodeURIComponent(prompt)}?width=256&height=256`)
  })
})