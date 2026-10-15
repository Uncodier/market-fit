import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MarketplaceOrderControls } from "@/app/orders/components/MarketplaceOrderControls"
import type { OrderWithRelations } from "@/app/orders/types"

let mockCanUpdate = true
let mockLoaded = true
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => ({
  capabilities: mockLoaded ? { update: mockCanUpdate } : null, can: () => mockCanUpdate,
}) }))
jest.mock("swr", () => ({ mutate: jest.fn(async () => undefined) }))

const marketplace = { provider: "uber_eats", state: "pending", sync_status: "confirmed", external_order_id: "provider-order",
  capabilities: { accept: true, reject: true, ready: false, cancel: false }, totals_provisional: false }
const order = { id: "order-1", metadata: { marketplace } } as unknown as OrderWithRelations

describe("native marketplace order controls", () => {
  beforeEach(() => { mockLoaded = true; mockCanUpdate = true; jest.mocked(fetch).mockReset() })
  it("validates cooking time and sends acceptance without optimistic preparation", async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, status: 202, json: async () => ({ success: false, operation: { status: "unknown" } }) } as Response)
    const { rerender } = render(<MarketplaceOrderControls order={order} />)
    fireEvent.click(screen.getByRole("button", { name: "Accept order" }))
    fireEvent.change(screen.getByLabelText("Cooking time (minutes)"), { target: { value: "121" } })
    fireEvent.click(screen.getAllByRole("button", { name: "Accept order" }).at(-1)!)
    expect(screen.getByRole("alert")).toHaveTextContent("between 1 and 120")
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText("Cooking time (minutes)"), { target: { value: "25" } })
    fireEvent.click(screen.getAllByRole("button", { name: "Accept order" }).at(-1)!)
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("outcome is unknown"))
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: JSON.stringify({ action: "accept", cooking_time_minutes: 25 }) }))
    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0])
    rerender(<MarketplaceOrderControls order={{ ...order, metadata: { marketplace: { ...marketplace } } }} />)
    expect(screen.queryByRole("button", { name: "Accept order" })).not.toBeInTheDocument()
    expect(order.metadata?.marketplace).toEqual(marketplace)
  })
  it("requires a rejection reason", async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, operation: { status: "confirmed" } }) } as Response)
    render(<MarketplaceOrderControls order={order} />)
    fireEvent.click(screen.getByRole("button", { name: "Reject order" }))
    fireEvent.click(screen.getAllByRole("button", { name: "Reject order" }).at(-1)!)
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a reason")
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Unavailable item" } })
    fireEvent.click(screen.getAllByRole("button", { name: "Reject order" }).at(-1)!)
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body: JSON.stringify({ action: "reject", reason: "Unavailable item" }) })))
  })
  it("hides all mutations for view-only and loading permissions", () => {
    mockCanUpdate = false
    const { rerender } = render(<MarketplaceOrderControls order={order} />)
    expect(screen.queryByRole("button", { name: "Accept order" })).not.toBeInTheDocument()
    mockCanUpdate = true; mockLoaded = false
    rerender(<MarketplaceOrderControls order={order} />)
    expect(screen.queryByRole("button", { name: "Accept order" })).not.toBeInTheDocument()
    expect(screen.getByText("Uber Eats")).toBeInTheDocument()
  })
})