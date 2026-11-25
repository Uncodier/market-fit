import type { WorkspaceArea } from "./navigation-areas"
import { MODULE_ICON_FILES } from "./module-icon-files"

/** Objects with strong silhouettes that benefit from a near edge-to-edge cutout composition. */
export const FULL_SIZE_MODULE_IMAGE_KEYS = new Set([
  "pos",
  "catalog",
  "records",
  "shipments",
  "reservations",
  "inventory",
  "printers",
  "channels",
  "payments",
  "reportTraffic",
  "company",
  "marketplace",
  "calendar",
  "settingsGeneral",
])

export function getModuleImageUrl(_area: WorkspaceArea, itemKey: string, _title: string): string {
  const file = Object.hasOwn(MODULE_ICON_FILES, itemKey) && MODULE_ICON_FILES[itemKey]
  return file ? `/images/modules/catalog/${file}` : ""
}
