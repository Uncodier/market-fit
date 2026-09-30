import { mergeParentIntoCatalogItem } from "@/app/catalog/product-details"
import type { CatalogItem } from "@/app/types"

function catalogItem(id: string): CatalogItem {
  return {
    id, name: id, site_id: "site-1", kind: "product",
    track_inventory: false, availability_mode: "always",
    availability_status: "available", status: "active", sort_order: 0,
    is_pos_available: true, is_recurring: false, is_reservation: false,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  }
}

describe("commerce catalog projection contracts", () => {
  it("keeps the caller projection and identity when there is no parent", () => {
    const item = { ...catalogItem("child"), site: { id: "site-1", name: "Store" } }
    const result = mergeParentIntoCatalogItem(item, null)
    expect(result).toBe(item)
    expect(result.site.name).toBe("Store")
  })

  it("preserves the site join and server-resolved price while inheriting display fields", () => {
    const site = { id: "site-1", name: "Store", settings: { default_locale: "en" } }
    const parent = {
      ...catalogItem("parent"), description: "Parent description", image_url: "/parent.png",
      target_sale_price: 100,
      metadata: { gallery: ["/gallery.png"], payment_options: ["bank_transfer" as const] },
    }
    const child = {
      ...catalogItem("child"), parent_id: "parent", site,
      target_sale_price: 35, currency: "USD",
      metadata: { option_values: { size: "small" }, payment_options: ["card" as const] },
      _shop: { availableQty: 7, sellable: true },
    }
    const result = mergeParentIntoCatalogItem(child, parent)
    expect(result.site).toBe(site)
    expect(result.target_sale_price).toBe(35)
    expect(result.currency).toBe("USD")
    expect(result.description).toBe("Parent description")
    expect(result.image_url).toBe("/parent.png")
    expect(result.metadata?.payment_options).toEqual(["card"])
    expect(result.metadata?.option_values).toEqual({ size: "small" })
    expect(result.metadata?.gallery).toEqual(["/gallery.png"])
    expect(result._shop).toEqual({ availableQty: 7, sellable: true })
    expect(result._parent).toEqual({ id: "parent", name: "parent", image_url: "/parent.png" })
    expect(child).not.toHaveProperty("_parent")
  })
})