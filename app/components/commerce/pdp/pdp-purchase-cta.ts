/** Catalogs larger than this treat Add to Cart as the primary PDP action. */
export const PDP_ADD_TO_CART_PRIMARY_AFTER = 5

/** Matches Tailwind `md` — cart drawer is desktop-only after add-to-cart. */
export const PDP_CART_DRAWER_MIN_WIDTH = 768

export function isAddToCartPrimary(catalogSize: number): boolean {
  return catalogSize > PDP_ADD_TO_CART_PRIMARY_AFTER
}

export function afterAddToCartHref(
  backUrl: string,
  viewportWidth: number = typeof window !== "undefined" ? window.innerWidth : PDP_CART_DRAWER_MIN_WIDTH,
): string {
  if (viewportWidth < PDP_CART_DRAWER_MIN_WIDTH) return backUrl
  const separator = backUrl.includes("?") ? "&" : "?"
  return `${backUrl}${separator}cart=1`
}
