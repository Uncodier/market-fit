import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import OrderDetail from "@/app/orders/[id]/page"
import { useOrderDetailData } from "@/app/orders/hooks/use-order-detail-data"
import type { OrderWithRelations } from "@/app/orders/types"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-1" } }) }))
jest.mock("@/app/orders/hooks/use-order-detail-data", () => ({ useOrderDetailData: jest.fn() }))
jest.mock("@/app/orders/actions", () => ({}))
jest.mock("@/app/orders/send-actions", () => ({}))
jest.mock("@/app/shipments/actions", () => ({}))
jest.mock("@/app/inventory/actions", () => ({}))
jest.mock("@/app/sales/actions", () => ({}))
jest.mock("@/app/orders/[id]/components/OrderDetailView", () => ({
  OrderDetailView: ({ items, notes, onNotesChange }: {
    items: { name: string }[]; notes: string; onNotesChange: (value: string) => void
  }) => <div>
    <span data-testid="items">{items.map((item) => item.name).join(", ")}</span>
    <input aria-label="Order notes" value={notes} onChange={(event) => onNotesChange(event.target.value)} />
  </div>,
}))

describe("order detail refresh rendering", () => {
  const params = Promise.resolve({ id: "order-1" })
  const baseOrder = {
    id: "order-1", site_id: "site-1", notes: "Initial notes",
    items: [{ name: "Old serialized product" }], sale_order_items: [],
  } as unknown as OrderWithRelations

  function data(order: OrderWithRelations) {
    jest.mocked(useOrderDetailData).mockReturnValue({ order, loading: false, error: undefined, setOrder: jest.fn() })
  }

  beforeEach(() => {
    jest.spyOn(React, "use").mockReturnValue({ id: "order-1" })
    data(baseOrder)
  })
  afterEach(() => jest.restoreAllMocks())

  it("does not resurrect serialized products when the relational lines are empty", () => {
    render(<OrderDetail params={params} />)
    expect(screen.getByTestId("items")).toBeEmptyDOMElement()
  })

  it("retains legacy serialized fallback only when relational lines are absent", () => {
    data({ ...baseOrder, sale_order_items: undefined })
    render(<OrderDetail params={params} />)
    expect(screen.getByTestId("items")).toHaveTextContent("Old serialized product")
  })

  it("updates server notes without overwriting an unsaved note draft", () => {
    const { rerender } = render(<OrderDetail params={params} />)
    data({ ...baseOrder, notes: "POS notes" })
    rerender(<OrderDetail params={params} />)
    expect(screen.getByRole("textbox", { name: "Order notes" })).toHaveValue("POS notes")
    fireEvent.change(screen.getByRole("textbox", { name: "Order notes" }), { target: { value: "Unsaved note" } })
    data({ ...baseOrder, notes: "Later POS notes" })
    rerender(<OrderDetail params={params} />)
    expect(screen.getByRole("textbox", { name: "Order notes" })).toHaveValue("Unsaved note")
  })
})