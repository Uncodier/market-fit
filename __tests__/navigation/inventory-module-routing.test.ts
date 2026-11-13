import { NAVIGATION_AREAS, isNavItemActive } from "@/app/config/navigation-areas"
import { ALL_SHORTCUT_ITEMS } from "@/app/components/navigation/dynamic-shortcut-utils"
import { getNavKeyForPath, isScreenBlocked } from "@/lib/auth/screen-access"
import { workspaceScreenRoot } from "@/lib/navigation/workspace-screen"
import { NAV_ITEM_ICON } from "@/app/config/module-visuals"
import { isSharedModuleImageKey } from "@/app/config/shared-module-images"
import { getModuleImageUrl } from "@/app/config/module-image-visuals"

const inventoryItems = NAVIGATION_AREAS.operations.items.filter(item => item.key.startsWith("inventory"))
it.each([
  ["/inventory", "inventory", "/inventory"],
  ["/inventory/movements", "inventoryMovements", "/inventory/movements"],
  ["/inventory/transfers", "inventoryTransfers", "/inventory/transfers"],
  ["/inventory/movements/transfer-id", "inventoryTransfers", "/inventory/transfers"],
  ["/inventory/transfers/transfer-id", "inventoryTransfers", "/inventory/transfers"],
  ["/inventory/minimums", "inventoryMinimums", "/inventory/minimums"],
  ["/inventory/minimums/rule-id", "inventoryMinimums", "/inventory/minimums"],
])("selects exactly one module for %s across menu, shortcuts and screen access", (path, key, root) => {
  const params = new URLSearchParams("demo=1")
  expect(inventoryItems.filter(item => isNavItemActive(item, path, params)).map(item => item.key)).toEqual([key])
  // Dynamic shortcuts take the first active item: parent inventory must not steal it.
  expect(ALL_SHORTCUT_ITEMS.find(item => isNavItemActive(item, path, params))?.key).toBe(key)
  expect(getNavKeyForPath(path, params)).toBe(key)
  expect(workspaceScreenRoot(`${path}?demo=1`)).toBe(root)
})
it("assigns transfer details to transfer access rules rather than ledger rules", () => {
  const key = getNavKeyForPath("/inventory/movements/transfer-id", new URLSearchParams())
  expect(isScreenBlocked("collaborator", ["inventoryTransfers"], key)).toBe(true)
  expect(isScreenBlocked("collaborator", ["inventoryMovements"], key)).toBe(false)
})
it("keeps module images and fallback icons distinct in /navigation and sidebar", () => {
  const keys = ["inventory", "inventoryMovements", "inventoryTransfers"]
  const urls = keys.map(key => getModuleImageUrl("operations", key, key))
  expect(new Set(urls).size).toBe(3)
  expect(NAV_ITEM_ICON.inventoryTransfers).not.toBe(NAV_ITEM_ICON.inventoryMovements)
  expect(isSharedModuleImageKey("inventoryMovements")).toBe(true)
  expect(isSharedModuleImageKey("inventoryTransfers")).toBe(true)
})
it("does not match a similarly named unrelated route", () => {
  expect(inventoryItems.some(item => isNavItemActive(item, "/inventory-other", new URLSearchParams()))).toBe(false)
})