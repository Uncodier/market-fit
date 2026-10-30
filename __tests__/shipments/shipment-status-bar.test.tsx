import { fireEvent, render, screen } from "@testing-library/react"
import { ShipmentStatusBar } from "@/app/shipments/components/ShipmentStatusBar"

describe("shipment detail status widget", () => {
  it("allows the next stage but prevents skipping or reversing stages", () => {
    const onStatusChange = jest.fn()
    render(<ShipmentStatusBar currentStatus="pending" onStatusChange={onStatusChange} />)
    fireEvent.click(screen.getByText("Shipped"))
    fireEvent.click(screen.getByText("Delivered"))
    expect(onStatusChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("Preparing"))
    expect(onStatusChange).toHaveBeenCalledWith("preparing")
  })

  it("confirms cancellation before changing fulfillment state", () => {
    const onStatusChange = jest.fn()
    render(<ShipmentStatusBar currentStatus="preparing" onStatusChange={onStatusChange} />)
    fireEvent.click(screen.getByText("Cancelled"))
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(onStatusChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    expect(onStatusChange).toHaveBeenCalledWith("cancelled")
  })

  it("does not change state when the confirmation is dismissed", () => {
    const onStatusChange = jest.fn()
    render(<ShipmentStatusBar currentStatus="in_transit" onStatusChange={onStatusChange} />)
    fireEvent.click(screen.getByText("Delivered"))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onStatusChange).not.toHaveBeenCalled()
  })

  it("prevents mutations for read-only marketplace shipments and during updates", () => {
    const onStatusChange = jest.fn()
    render(<ShipmentStatusBar currentStatus="pending" onStatusChange={onStatusChange} disabled />)
    fireEvent.click(screen.getByText("Preparing"))
    fireEvent.click(screen.getByText("Cancelled"))
    expect(onStatusChange).not.toHaveBeenCalled()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it.each(["delivered", "failed", "cancelled"] as const)("keeps terminal %s shipments immutable", (status) => {
    const onStatusChange = jest.fn()
    render(<ShipmentStatusBar currentStatus={status} onStatusChange={onStatusChange} />)
    fireEvent.click(screen.getByText("Preparing"))
    fireEvent.click(screen.getByText("Shipped"))
    expect(onStatusChange).not.toHaveBeenCalled()
  })
})