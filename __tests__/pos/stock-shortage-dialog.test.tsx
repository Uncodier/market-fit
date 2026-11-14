import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { PosStockShortageDialog } from "@/app/pos/components/PosStockShortageDialog"
import { requestPosShortagePurchase, requestPosShortageTransfer } from "@/app/pos/shortage-replenishment"
import type { CatalogItem } from "@/app/types"

jest.mock("@/app/pos/shortage-replenishment", () => ({
  requestPosShortagePurchase: jest.fn(), requestPosShortageTransfer: jest.fn(),
}))
jest.mock("sonner", () => ({ toast: { success: jest.fn() } }))
const props = {
  siteId: "site", item: { id: "sku", name: "Product" } as CatalogItem,
  quantity: 2, locationId: "origin", currency: "USD",
  locations: [{ id: "origin", name: "Origin" }, { id: "source", name: "Warehouse" }, { id: "empty", name: "Empty" }],
  inventory: { policy: "block" as const, levels: [
    { catalog_item_id: "sku", location_id: "origin", quantity: 5 },
    { catalog_item_id: "sku", location_id: "source", quantity: 3 },
    { catalog_item_id: "other", location_id: "empty", quantity: 10 },
  ] },
  onComplete: jest.fn(), onClose: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
})

it("offers completion and only stocked alternative locations", () => {
  render(<PosStockShortageDialog {...props} />)
  expect(screen.getByRole("button", { name: "Request transfer from Warehouse" })).toBeEnabled()
  expect(screen.queryByRole("button", { name: /transfer from Origin|transfer from Empty/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Add as completed" }))
  expect(props.onComplete).toHaveBeenCalledTimes(1)
  expect(requestPosShortagePurchase).not.toHaveBeenCalled()
})

it("creates a requisition draft without adding or completing the cart", async () => {
  jest.mocked(requestPosShortagePurchase).mockResolvedValue({ id: "request" })
  render(<PosStockShortageDialog {...props} />)
  fireEvent.click(screen.getByRole("button", { name: "Create purchase requisition" }))
  await screen.findByRole("link", { name: "Open requisition" })
  expect(requestPosShortagePurchase).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2, catalogItemId: "sku", locationId: "origin" }))
  expect(props.onComplete).not.toHaveBeenCalled()
})

it("requests a transfer with the correct source and destination", async () => {
  jest.mocked(requestPosShortageTransfer).mockResolvedValue({ id: "transfer" })
  render(<PosStockShortageDialog {...props} />)
  fireEvent.click(screen.getByRole("button", { name: "Request transfer from Warehouse" }))
  await screen.findByRole("link", { name: "Open transfer" })
  expect(requestPosShortageTransfer).toHaveBeenCalledWith(expect.objectContaining({ sourceLocationId: "source", locationId: "origin" }))
  expect(props.onComplete).not.toHaveBeenCalled()
})

it("shows failures and retries the same request instead of starting another workflow", async () => {
  jest.mocked(requestPosShortagePurchase).mockResolvedValueOnce({ error: "Access denied" }).mockResolvedValueOnce({ id: "request" })
  render(<PosStockShortageDialog {...props} />)
  fireEvent.click(screen.getByRole("button", { name: "Create purchase requisition" }))
  await screen.findByRole("alert")
  expect(screen.getByRole("button", { name: "Add as completed" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Create purchase requisition" }))
  await waitFor(() => expect(requestPosShortagePurchase).toHaveBeenCalledTimes(2))
  const calls = jest.mocked(requestPosShortagePurchase).mock.calls
  expect(calls[0][0].requestId).toEqual(calls[1][0].requestId)
  await screen.findByRole("link", { name: "Open requisition" })
})

it("does not request stock offline and cancellation leaves the cart alone", () => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
  render(<PosStockShortageDialog {...props} />)
  fireEvent.click(screen.getByRole("button", { name: "Create purchase requisition" }))
  expect(screen.getByRole("alert")).toHaveTextContent("Connect")
  expect(requestPosShortagePurchase).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(props.onClose).toHaveBeenCalledTimes(1)
  expect(props.onComplete).not.toHaveBeenCalled()
})

it("blocks purchase replay after an uncertain write and offers review", async () => {
  jest.mocked(requestPosShortagePurchase).mockResolvedValue({ error: "Confirmation unavailable", reviewRequired: true })
  render(<PosStockShortageDialog {...props} />)
  fireEvent.click(screen.getByRole("button", { name: "Create purchase requisition" }))
  await screen.findByRole("link", { name: /Review purchase requisitions/ })
  expect(screen.getByRole("button", { name: "Create purchase requisition" })).toBeDisabled()
  expect(requestPosShortagePurchase).toHaveBeenCalledTimes(1)
})

it("offers a partial transfer when another location cannot cover the full shortage", async () => {
  jest.mocked(requestPosShortageTransfer).mockResolvedValue({ id: "transfer" })
  render(<PosStockShortageDialog {...props} quantity={5} />)
  fireEvent.click(screen.getByRole("button", { name: "Request transfer from Warehouse (3 units)" }))
  await screen.findByRole("link", { name: "Open transfer" })
  expect(requestPosShortageTransfer).toHaveBeenCalledWith(expect.objectContaining({ quantity: 3 }))
})

it("retries a transfer with its original quantity after a stock refresh", async () => {
  jest.mocked(requestPosShortageTransfer).mockResolvedValueOnce({ error: "Confirmation unavailable" })
    .mockResolvedValueOnce({ id: "transfer" })
  const { rerender } = render(<PosStockShortageDialog {...props} quantity={5} />)
  fireEvent.click(screen.getByRole("button", { name: "Request transfer from Warehouse (3 units)" }))
  await screen.findByRole("alert")
  rerender(<PosStockShortageDialog {...props} quantity={5} inventory={{ policy: "block", levels: [] }} />)
  fireEvent.click(screen.getByRole("button", { name: "Request transfer from Warehouse (3 units)" }))
  await screen.findByRole("link", { name: "Open transfer" })
  const calls = jest.mocked(requestPosShortageTransfer).mock.calls
  expect(calls[1][0]).toEqual(calls[0][0])
})