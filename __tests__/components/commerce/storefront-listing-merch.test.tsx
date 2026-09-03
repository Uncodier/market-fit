/**
 * @jest-environment jsdom
 */

import React from "react"
import { render, screen } from "@testing-library/react"
import { StorefrontListingMerch } from "@/app/components/commerce/StorefrontListingMerch"
import type { CatalogItem } from "@/app/types"

const baseItem = {
  id: "1",
  site_id: "s1",
  kind: "product",
  name: "Test",
  track_inventory: true,
  availability_mode: "inventory",
  availability_status: "available",
  status: "active",
  sort_order: 0,
  is_pos_available: false,
  is_recurring: false,
  is_reservation: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as CatalogItem

const t = (key: string, vars?: Record<string, unknown>) =>
  vars?.count != null ? `${key}:${vars.count}` : key

describe("StorefrontListingMerch", () => {
  it("renders nothing without flags or low stock", () => {
    const { container } = render(
      <StorefrontListingMerch item={baseItem} shop={{ availableQty: 20 }} t={t} />
    )
    expect(container.firstChild).toBeNull()
  })

  it("keeps shop-only low stock when the toggle is off and showSeller is false", () => {
    render(
      <StorefrontListingMerch
        item={baseItem}
        shop={{ availableQty: 3 }}
        showSeller={false}
        t={t}
      />
    )
    expect(screen.getByText("shop.onlyLeft:3")).toBeInTheDocument()
  })

  it("hides legacy leftover on marketplace when the toggle is off", () => {
    const { container } = render(
      <StorefrontListingMerch
        item={baseItem}
        shop={{ availableQty: 3 }}
        showSeller={true}
        t={t}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("shows leftover on marketplace when show_available_inventory is on", () => {
    render(
      <StorefrontListingMerch
        item={{ ...baseItem, metadata: { show_available_inventory: true } }}
        shop={{ availableQty: 12 }}
        showSeller={true}
        t={t}
      />
    )
    expect(screen.getByText("shop.onlyLeft:12")).toBeInTheDocument()
  })

  it("renders buyer stack only when the flag and data are present", () => {
    const { rerender } = render(
      <StorefrontListingMerch
        item={baseItem}
        shop={{ buyers: [{ id: "u1", name: "Ada", avatar_url: null }], buyerCount: 1 }}
        t={t}
      />
    )
    expect(screen.queryByText("A")).not.toBeInTheDocument()

    rerender(
      <StorefrontListingMerch
        item={{ ...baseItem, metadata: { show_buyers: true } }}
        shop={{ buyers: [{ id: "u1", name: "Ada", avatar_url: null }], buyerCount: 1 }}
        t={t}
      />
    )
    expect(screen.getByText("A")).toBeInTheDocument()
  })
})
