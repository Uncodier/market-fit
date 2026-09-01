import { getEntitlementExperiencePath } from "@/app/buyer/experience-routes"
import type { DeviceOrder, DeviceOrderItem } from "@/app/commerce/device-order-storage"
import { sortDeviceOrderItemsForDisplay } from "@/app/commerce/device-order-storage"
import { withInternalFrom } from "@/app/documents/internal-back"
import { buildPublicDocPath } from "@/app/documents/public-token"

const DIGITAL_SUBTYPES = new Set(["ticket", "course", "file", "pass", "license"])

export function isDigitalAccessItem(item: DeviceOrderItem): boolean {
  if (item.kind === "digital_asset") return true
  return DIGITAL_SUBTYPES.has(item.digital_subtype || "")
}

function librarySubtypeForItem(item: DeviceOrderItem): string | null {
  const subtype = item.digital_subtype
  if (subtype === "ticket" || subtype === "course" || subtype === "pass") return subtype
  if (subtype === "file" || subtype === "license") return "file"
  return null
}

function salesOrderHref(order: DeviceOrder, fromHref: string): string {
  return withInternalFrom(buildPublicDocPath("so", order.publicAccessToken), fromHref)
}

/** Completed digital-only orders open the library experience; otherwise the public SO. */
export function getDeviceOrderHref(order: DeviceOrder, fromHref: string): string {
  const soHref = salesOrderHref(order, fromHref)
  if ((order.status || "").toLowerCase() !== "completed") return soHref

  const items = order.items || []
  if (items.length === 0 || !items.every(isDigitalAccessItem)) return soHref

  const hero = sortDeviceOrderItemsForDisplay(items)[0]
  if (hero.entitlementId) {
    const experiencePath = getEntitlementExperiencePath({
      id: hero.entitlementId,
      catalog_item: { digital_subtype: hero.digital_subtype },
    })
    if (experiencePath) return experiencePath
  }

  const subtype = librarySubtypeForItem(hero)
  return subtype ? `/buyer/library?subtype=${subtype}` : "/buyer/library"
}
