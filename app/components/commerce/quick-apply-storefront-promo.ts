"use client"

import { getCartItems, setCartItems } from "@/app/commerce/cart-storage"
import { getStorefrontPromotionDetail } from "@/app/promotions/storefront-promotions"
import { writePendingStorefrontPromo } from "@/app/components/commerce/storefront-pending-promo"

type QuickApplyResult =
  | { ok: true; redirectTo: string }
  | { needsDetail: true; href: string }
  | { error: string }

/**
 * Apply a storefront promo from a listing card:
 * - adds concrete required items when present
 * - stores pending code/promotionId for checkout
 * - if the promo needs category picks, send the user to the detail page
 */
export async function quickApplyStorefrontPromo(params: {
  promotionId: string
  siteId: string
  surface: "shop" | "marketplace"
  siteSlug?: string
  detailHref: string
}): Promise<QuickApplyResult> {
  const res = await getStorefrontPromotionDetail({
    promotionId: params.promotionId,
    siteId: params.surface === "shop" ? params.siteId : undefined,
  })
  if ("error" in res || !res.data) {
    return { error: res.error || "Promotion not found" }
  }

  const promo = res.data
  const requiredItems = promo.required_items || []
  const requiredCategories = promo.required_categories || []
  const hasConcreteRequired = requiredItems.some((r: any) => r.item)
  const needsPick =
    !hasConcreteRequired &&
    requiredCategories.length > 0 &&
    (promo.category_pick_items || []).length > 0

  if (needsPick) {
    return { needsDetail: true, href: params.detailHref }
  }

  const cartSource = params.surface === "marketplace" ? "marketplace" : "shop"
  const cartSiteId = params.surface === "shop" ? promo.site_id : null
  const existing = getCartItems("cart", cartSource, cartSiteId) as any[]
  const nextCart = [...existing]

  for (const row of requiredItems) {
    if (!row.item) continue
    const qty = Math.max(1, row.min_quantity || 1)
    const idx = nextCart.findIndex((c) => c.id === row.item.id)
    if (idx >= 0) {
      nextCart[idx] = {
        ...nextCart[idx],
        cartQty: (nextCart[idx].cartQty || 1) + qty,
      }
    } else {
      nextCart.push({
        id: row.item.id,
        name: row.item.name || "Item",
        image_url: row.item.image_url,
        target_sale_price: row.item.target_sale_price,
        currency: row.item.currency,
        site_id: row.item.site_id || promo.site_id,
        cartQty: qty,
        cartPrice: Number(row.item.target_sale_price) || 0,
      })
    }
  }

  setCartItems("cart", cartSource, cartSiteId, nextCart)
  writePendingStorefrontPromo({
    code: promo.code || null,
    promotionId: promo.id,
    siteId: promo.site_id,
    surface: params.surface,
  })

  const redirectTo =
    params.surface === "shop" && params.siteSlug
      ? `/shop/${params.siteSlug}?cart=1`
      : `/marketplace?cart=1`

  return { ok: true, redirectTo }
}
