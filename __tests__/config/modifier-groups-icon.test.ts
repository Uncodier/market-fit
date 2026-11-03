import { ModifierGroups } from "@/app/components/ui/icons"
import { NAV_ITEM_ICON } from "@/app/config/module-visuals"
import { getModuleImagePrompt, getModuleImageUrl } from "@/app/config/module-image-visuals"
import { findNavigationMenuItem, getNavItemTitle, isAreaActive } from "@/app/config/navigation-areas"

describe("modifier groups navigation", () => {
  it("has its own Operations destination, icon and localized title", () => {
    const entry = findNavigationMenuItem("modifierGroups")!
    expect(entry.area).toBe("operations")
    expect(entry.item.href).toBe("/catalog/modifier-groups")
    expect(NAV_ITEM_ICON.modifierGroups).toBe(ModifierGroups)
    expect(NAV_ITEM_ICON.modifierGroups).not.toBe(NAV_ITEM_ICON.catalog)
    expect(getNavItemTitle(entry.item, key => key)).toBe("Modifier groups")
    expect(getNavItemTitle(entry.item, key => key === "catalog.modifiers.groupsTitle" ? "Translated groups" : key))
      .toBe("Translated groups")
  })

  it.each(["/catalog/modifier-groups", "/catalog/modifier-groups/group-id"])(
    "activates Operations, not Sales, for %s", pathname => {
      expect(isAreaActive("operations", pathname, new URLSearchParams())).toBe(true)
      expect(isAreaActive("sales", pathname, new URLSearchParams())).toBe(false)
    },
  )

  it("requests a distinct shared image using a stable prompt", () => {
    const prompt = getModuleImagePrompt("operations", "modifierGroups", "Modifier groups")
    expect(prompt).toContain("Front-facing 3D grouped option cards")
    expect(prompt).toContain("grouped product extras")
    expect(prompt).toBe(getModuleImagePrompt("operations", "modifierGroups", "Translated groups"))
    expect(getModuleImageUrl("operations", "modifierGroups", "Modifier groups"))
      .toBe("/api/images/modules/modifierGroups")
  })
})