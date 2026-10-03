import { fireEvent, render, screen } from "@testing-library/react"
import type { CatalogItem } from "@/app/types"
import type { PosCartItem } from "@/app/pos/cart-types"
import { PosCatalogGrid } from "@/app/pos/components/PosCatalogGrid"
import { PosOptionsDialog } from "@/app/pos/components/PosOptionsDialog"
import { PosCartLines } from "@/app/pos/components/PosCartLines"
import { getPosItemAvailability, type PosInventorySnapshot } from "@/app/pos/inventory-availability"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ locale: "en", t: () => "" }),
}))
jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ formatPrice: (amount: number) => `$${amount}` }),
}))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => false }))
jest.mock("@/app/lib/image-utils", () => ({
  resolveItemImage: () => "/test.jpg", optimizeForPreset: (image: string) => image,
}))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/pos/local/db", () => ({ getPosDb: () => ({ meta: { get: async () => null } }) }))

const item = {
  id: "sku", site_id: "site", name: "Product", status: "active", availability_mode: "inventory",
  track_inventory: true, target_sale_price: 10,
} as CatalogItem
const snapshot: PosInventorySnapshot = { levels: [], policy: "block" }

describe("POS stock UI", () => {
  it("keeps sold-out products visible and prevents mouse and keyboard additions", () => {
    const onAdd = jest.fn()
    render(<PosCatalogGrid items={[item]} loading={false} onAdd={onAdd} t={() => ""}
      getAvailability={(candidate) => getPosItemAvailability(candidate, snapshot, "store")} />)
    expect(screen.getByText("Sold Out")).toBeInTheDocument()
    const card = screen.getByRole("button", { name: "Product" })
    expect(card).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(card)
    fireEvent.keyDown(card, { key: "Enter" })
    expect(onAdd).not.toHaveBeenCalled()
  })

  it("labels backorder products and allows adding them under the existing policy", () => {
    const onAdd = jest.fn()
    render(<PosCatalogGrid items={[item]} loading={false} onAdd={onAdd} t={() => ""}
      getAvailability={(candidate) => getPosItemAvailability(candidate, { ...snapshot, policy: "allow" })} />)
    expect(screen.getByText("Backorder")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Product" }))
    expect(onAdd).toHaveBeenCalledWith(item)
  })

  it("does not mislabel missing stock data as sold out", () => {
    render(<PosCatalogGrid items={[item]} loading={false} onAdd={jest.fn()} t={() => ""}
      getAvailability={(candidate) => getPosItemAvailability(candidate, null)} />)
    expect(screen.getByText("Stock unknown")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Product" })).toHaveAttribute("aria-disabled", "true")
  })

  it("displays backorder quantity in the cart and disables unavailable quantity increases", () => {
    render(<PosCartLines cart={[{
      ...item, cartQty: 3, cartPrice: 10, backorderQty: 2, inventoryCanIncrease: false,
    } as PosCartItem]} selectedCartItemId={null} setSelectedCartItemId={jest.fn()} updateQty={jest.fn()} />)
    expect(screen.getByText("Backorder: 2")).toBeInTheDocument()
    expect(screen.getAllByRole("button")[1]).toBeDisabled()
    expect(screen.getAllByRole("button")[0]).not.toBeDisabled()
  })

  it("uses cached variants and blocks sold-out options without requiring an online query", async () => {
    const parent = { ...item, id: "parent", name: "Parent", metadata: {
      variant_axes: [{ id: "size", kind: "custom", label: "Size", values: [
        { id: "small", label: "Small" }, { id: "large", label: "Large" },
      ] }],
    } } as CatalogItem
    const children = [
      { ...item, id: "small", name: "Small", parent_id: "parent", metadata: { option_values: { size: "small" } } },
      { ...item, id: "large", name: "Large", parent_id: "parent", metadata: { option_values: { size: "large" } } },
    ] as CatalogItem[]
    const onConfirm = jest.fn()
    render(<PosOptionsDialog item={parent} open onOpenChange={jest.fn()} onConfirm={onConfirm}
      catalogItems={[parent, ...children]} resolvePrice={(_, fallback) => fallback}
      getAvailability={(candidate) => getPosItemAvailability(candidate, {
        policy: "block", levels: [{ catalog_item_id: "large", location_id: "store", quantity: 1 }],
      }, "store")} />)
    const small = await screen.findByRole("button", { name: /Small/ })
    expect(small).toBeDisabled()
    fireEvent.click(small)
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: /Large/ }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ item: expect.objectContaining({ id: "large" }) }))
  })

  it("lets the cashier switch between stocked multi-axis combinations", async () => {
    const parent = { ...item, id: "parent", name: "Parent", metadata: {
      variant_axes: [
        { id: "color", kind: "custom", label: "Color", values: [{ id: "red", label: "Red" }, { id: "blue", label: "Blue" }] },
        { id: "size", kind: "custom", label: "Size", values: [{ id: "small", label: "Small" }, { id: "large", label: "Large" }] },
      ],
    } } as CatalogItem
    const children = [
      { ...item, id: "red-small", parent_id: "parent", metadata: { option_values: { color: "red", size: "small" } } },
      { ...item, id: "blue-large", parent_id: "parent", metadata: { option_values: { color: "blue", size: "large" } } },
    ] as CatalogItem[]
    const onConfirm = jest.fn()
    render(<PosOptionsDialog item={parent} open onOpenChange={jest.fn()} onConfirm={onConfirm}
      catalogItems={[parent, ...children]} resolvePrice={(_, fallback) => fallback}
      getAvailability={() => ({ sellable: true, status: "available", backorderQty: 0 })} />)
    fireEvent.click(await screen.findByRole("button", { name: "Red" }))
    fireEvent.click(screen.getByRole("button", { name: "Small" }))
    expect(screen.getByRole("button", { name: "Confirm" })).not.toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Blue" }))
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Large" }))
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ item: expect.objectContaining({ id: "blue-large" }) }))
  })
})