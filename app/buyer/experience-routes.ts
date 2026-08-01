export function getEntitlementExperiencePath(entitlement: {
  id: string
  catalog_item?: { digital_subtype?: string | null } | null
}): string | null {
  const subtype = entitlement.catalog_item?.digital_subtype
  if (subtype === "pass") return `/buyer/book/${entitlement.id}`
  if (subtype === "ticket") return `/buyer/ticket/${entitlement.id}`
  if (subtype === "course") return `/buyer/course/${entitlement.id}`
  if (subtype === "file" || subtype === "license") return `/buyer/downloads/${entitlement.id}`
  return null
}
