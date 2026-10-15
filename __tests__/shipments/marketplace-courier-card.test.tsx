import { render, screen } from "@testing-library/react"
import { MarketplaceCourierCard } from "@/app/shipments/components/MarketplaceCourierCard"
import type { ShipmentWithRelations } from "@/app/shipments/types"

jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => ({ capabilities: { update: true }, can: () => true }) }))

describe("native external courier card", () => {
  it("shows provider metadata read-only without internal assignment or unsupported delivery actions", () => {
    const shipment = { id: "shipment-1", status: "in_transit", metadata: { marketplace: {
      provider: "rappi", state: "accepted", sync_status: "confirmed", delivery_mode: "marketplace_managed",
      courier: { name: "Test courier", phone: "Provider phone", vehicle: "Bicycle", tracking_url: "https://tracking.example.test/order" },
      capabilities: { request_delivery: true, cancel_delivery: true, cancel: true },
    } } } as unknown as ShipmentWithRelations
    render(<MarketplaceCourierCard shipment={shipment} onRefresh={jest.fn()} />)
    expect(screen.getByText("Test courier")).toBeInTheDocument()
    expect(screen.getByText("Bicycle")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open provider tracking" })).toHaveAttribute("rel", "noopener noreferrer")
    expect(screen.queryByRole("button", { name: "Request courier" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Cancel with provider" })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })
  it("does not invent courier details or expose unsafe links", () => {
    const shipment = { id: "shipment-1", status: "pending", metadata: { marketplace: {
      provider: "uber_eats", delivery_mode: "marketplace_managed", courier: { tracking_url: "javascript:alert(1)" },
    } } } as unknown as ShipmentWithRelations
    render(<MarketplaceCourierCard shipment={shipment} onRefresh={jest.fn()} />)
    expect(screen.getByText("Not assigned by provider")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})