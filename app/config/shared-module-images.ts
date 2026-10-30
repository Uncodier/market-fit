/** Only these server-owned module prompts may generate using Makinari credits. */
export const SHARED_MODULE_IMAGE_AREAS = {
  suppliers: "buying",
  purchaseRequests: "buying",
  procurementApprovals: "buying",
  procurementTenders: "buying",
  procurementRules: "buying",
  procurementSettings: "settings",
  inventoryMinimums: "operations",
} as const

export function isSharedModuleImageKey(key: string): key is keyof typeof SHARED_MODULE_IMAGE_AREAS {
  return Object.prototype.hasOwnProperty.call(SHARED_MODULE_IMAGE_AREAS, key)
}