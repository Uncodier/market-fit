import { render, screen } from "@testing-library/react"
import type { CatalogItem } from "@/app/types"
import { PosCatalogGrid } from "@/app/pos/components/PosCatalogGrid"

jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ formatPrice: (amount: number) => `$${amount}` }),
}))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => true }))
jest.mock("@/app/lib/image-utils", () => ({
  resolveItemImage: () => "/test.jpg",
}))

const item = {
  id: "product",
  site_id: "site",
  name: "Product",
  status: "active",
  availability_mode: "always",
  target_sale_price: 10,
} as CatalogItem

describe("POS catalog card layout", () => {
  it("wraps products into automatic columns with a readable minimum width", () => {
    render(
      <PosCatalogGrid
        items={[item]}
        loading={false}
        onAdd={jest.fn()}
        t={() => ""}
      />,
    )

    const card = screen.getByRole("button", { name: "Product" })
    expect(card).toHaveClass("min-w-[180px]")
    expect(card.parentElement).toHaveClass(
      "grid-cols-[repeat(auto-fill,minmax(180px,1fr))]",
      "gap-4",
    )
    expect(card.parentElement).not.toHaveClass("grid-cols-2")
  })

  it("uses the same minimum width and wrapping for loading placeholders", () => {
    const { container } = render(
      <PosCatalogGrid
        items={[]}
        loading
        onAdd={jest.fn()}
        t={() => ""}
      />,
    )

    const grid = container.querySelector(".grid")!
    expect(grid).toHaveClass("grid-cols-[repeat(auto-fill,minmax(180px,1fr))]")
    expect(grid.children).toHaveLength(15)
    Array.from(grid.children).forEach((card) => {
      expect(card).toHaveClass("min-w-[180px]")
    })
  })
})