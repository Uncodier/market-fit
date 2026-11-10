/** Keep cart composition, never the previous account's amounts, across an identity change. */
export function scrubStorefrontCartPrices() {
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)
      if (!key || (!key.startsWith("market-cart-") && key !== "market-checkout-buynow")) continue
      const rows: unknown = JSON.parse(localStorage.getItem(key) || "[]")
      if (!Array.isArray(rows)) continue
      localStorage.setItem(key, JSON.stringify(rows.map(row => ({ ...row,
        // Dynamic quotes are buyer-entered, not a lead price-list amount.
        ...(row.is_dynamic_price ? {} : { cartPrice: 0, target_sale_price: null }),
        modifiers: Array.isArray(row.modifiers) ? row.modifiers.map((option: Record<string, unknown>) => ({ ...option, cartPrice: 0 })) : [],
      }))))
    }
  } catch {
    // Storage may be disabled. The next page still blocks checkout until repriced.
  }
}