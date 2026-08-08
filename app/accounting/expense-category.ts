/** UI helper: suggest a category key from linked dims (user can override). */
export function suggestExpenseCategory(dims: {
  catalogItemId?: string | null
  catalogCategoryId?: string | null
  leadId?: string | null
  campaignId?: string | null
  locationId?: string | null
}): string | null {
  if (dims.catalogItemId || dims.catalogCategoryId || dims.leadId) return 'cogs'
  if (dims.campaignId) return 'advertising'
  if (dims.locationId) return 'operating'
  return null
}
