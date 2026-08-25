/** Food-style copy (Uber/Rappi) stays inline; longer retail copy also gets a below-the-fold section. */
export const SHORT_ITEM_DESCRIPTION_CHARS = 280

export function isShortItemDescription(description?: string | null): boolean {
  const text = description?.trim()
  if (!text) return true
  return text.length <= SHORT_ITEM_DESCRIPTION_CHARS
}

export function hasPdpProductDetails({
  description,
  attrCount,
  specCount,
}: {
  description?: string | null
  attrCount: number
  specCount: number
}): boolean {
  const hasLongAbout = Boolean(description?.trim()) && !isShortItemDescription(description)
  return hasLongAbout || attrCount > 0 || specCount > 0
}
