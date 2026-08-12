const PENDING_PROMO_KEY = "storefront-pending-promo"

export type PendingStorefrontPromo = {
  code: string | null
  promotionId: string
  siteId: string
  surface: string
}

export function writePendingStorefrontPromo(payload: PendingStorefrontPromo) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(PENDING_PROMO_KEY, JSON.stringify(payload))
}

export function readPendingStorefrontPromo(): PendingStorefrontPromo | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(PENDING_PROMO_KEY)
    if (!raw) return null
    sessionStorage.removeItem(PENDING_PROMO_KEY)
    return JSON.parse(raw)
  } catch {
    return null
  }
}
