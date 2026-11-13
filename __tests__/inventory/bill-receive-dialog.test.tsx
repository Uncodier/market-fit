import React, { Suspense } from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import BillDetailPage from "@/app/bills/[id]/page"
import { BillRowActions } from "@/app/bills/components/BillRowActions"
import { getPurchaseById } from "@/app/purchases/actions"
import { pendingReceiptKey, writePendingReceipt } from "@/app/bills/pending-receipt"
import { ReceivePurchaseStockDialog } from "@/app/bills/components/ReceivePurchaseStockDialog"
import { listLocations } from "@/app/inventory/actions"
import { readBillInventoryReceiptLines, receiveBillInventoryLines } from "@/app/bills/receive-inventory-actions"
import { siteMembersService } from "@/app/services/site-members-service"
import type { Location, Purchase } from "@/app/types"

jest.mock("@/app/inventory/actions", () => ({ listLocations: jest.fn() }))
jest.mock("@/app/bills/receive-inventory-actions", () => ({ readBillInventoryReceiptLines: jest.fn(), receiveBillInventoryLines: jest.fn() }))
jest.mock("@/app/services/site-members-service", () => ({ siteMembersService: { getAssigneeOptions: jest.fn() } }))
let mockActorId: string | undefined = "00000000-0000-4000-8000-000000000006"
let mockCanWrite = true
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/components/auth/auth-context", () => ({ useAuthContext: () => ({ user: mockActorId ? { id: mockActorId } : null }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: siteId } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => ({ can: () => mockCanWrite }) }))
jest.mock("@/app/purchases/actions", () => ({ getPurchaseById: jest.fn() }))
jest.mock("@/app/bills/send-actions", () => ({ ensureBillPublicAccessToken: jest.fn(), sendVendorBill: jest.fn() }))
jest.mock("@/app/bills/components/CreatePurchaseDialog", () => ({ CreatePurchaseDialog: () => null }))
jest.mock("@/app/bills/components/RegisterPurchasePaymentDialog", () => ({ RegisterPurchasePaymentDialog: () => null }))
jest.mock("@/app/bills/components/PurchaseInvoice", () => ({ PurchaseInvoice: () => <article>Bill invoice</article> }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock("@/app/components/ui/select", () => {
  const React = jest.requireActual<typeof import("react")>("react")
  const Context = React.createContext<{ value?: string; onValueChange?: (value: string) => void; disabled?: boolean }>({})
  return {
    Select: ({ children, value, onValueChange, disabled }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void; disabled: boolean }) => <Context.Provider value={{ value, onValueChange, disabled }}>{children}</Context.Provider>,
    SelectTrigger: ({ id }: { id: string }) => <span id={id} />,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => { const context = React.useContext(Context); return <select aria-label="Selection" value={context.value} disabled={context.disabled} onChange={e => context.onValueChange?.(e.target.value)}><option value="" />{children}</select> },
    SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
  }
})

const siteId = "00000000-0000-4000-8000-000000000001"
const purchase = { id: "00000000-0000-4000-8000-000000000002", siteId, locationId: "00000000-0000-4000-8000-000000000003", items: [] } as unknown as Purchase
const receiverId = "00000000-0000-4000-8000-000000000004"
const lineId = "00000000-0000-4000-8000-000000000005"
const actorId = "00000000-0000-4000-8000-000000000006"
const locations = [{ id: purchase.locationId, site_id: siteId, name: "Main warehouse", is_active: true, is_default: true }] as Location[]
const receiptLines = [
  { id: lineId, catalog_item_id: "catalog-1", name: "Stock widget", quantity: 8, received_quantity: 3 },
  { id: "00000000-0000-4000-8000-000000000007", catalog_item_id: "catalog-1", name: "Second bill line", quantity: 4, received_quantity: 0 },
]
const onSuccess = jest.fn()
const onOpenChange = jest.fn()

beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); mockActorId = actorId; mockCanWrite = true
  jest.mocked(getPurchaseById).mockResolvedValue({ purchase: completedPurchase, error: null })
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: jest.fn(() => "00000000-0000-4000-8000-000000000008") })
  jest.mocked(listLocations).mockResolvedValue({ data: locations })
  jest.mocked(readBillInventoryReceiptLines).mockResolvedValue({ data: receiptLines, actorId, error: null })
  jest.mocked(siteMembersService.getAssigneeOptions).mockResolvedValue([{ id: receiverId, name: "Receiving Alex" }])
  jest.mocked(receiveBillInventoryLines).mockResolvedValue({ success: true, error: null, requestId: "00000000-0000-4000-8000-000000000008", movementIds: [], alreadyApplied: false })
})
function show() {
  return render(<ReceivePurchaseStockDialog siteId={siteId} purchase={purchase} open onOpenChange={onOpenChange} onSuccess={onSuccess} />)
}
async function fill(quantity = "2") {
  await screen.findByText("Stock widget")
  fireEvent.change(screen.getByRole("spinbutton", { name: "Qty received now for Stock widget" }), { target: { value: quantity } })
  fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: receiverId } })
}
it("loads server cumulative quantities, requires receiver and omits zero bill lines", async () => {
  show()
  await screen.findByText("Stock widget")
  expect(screen.getByText("Purchased")).toBeInTheDocument()
  fireEvent.change(screen.getByRole("spinbutton", { name: "Qty received now for Stock widget" }), { target: { value: "2" } })
  expect(screen.getByRole("button", { name: "Receive stock" })).toBeDisabled()
  await fill()
  expect(receiveBillInventoryLines).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Receive stock" }))
  await waitFor(() => expect(receiveBillInventoryLines).toHaveBeenCalledWith(expect.objectContaining({
    siteId, purchaseId: purchase.id, toLocationId: purchase.locationId, receivingUserId: receiverId,
    lines: [{ purchaseItemId: lineId, quantity: 2 }],
  })))
  expect(onOpenChange).toHaveBeenCalledWith(false)
  expect(onSuccess).toHaveBeenCalled()
  expect(sessionStorage.length).toBe(0)
})
it.each(["6", "-1"])("rejects quantity %s outside remaining", async quantity => {
  show(); await fill(quantity)
  expect(screen.getByRole("button", { name: "Receive stock" })).toBeDisabled()
})
it("shows a definitive rejection and allows editing", async () => {
  jest.mocked(receiveBillInventoryLines).mockResolvedValue({ success: false, error: "Bill cannot be received", status: 409, code: "operation_rejected" })
  show(); await fill()
  fireEvent.click(screen.getByRole("button", { name: "Receive stock" }))
  await screen.findByText("Bill cannot be received")
  expect(onSuccess).not.toHaveBeenCalled()
  expect(screen.getByRole("spinbutton", { name: "Qty received now for Stock widget" })).toBeEnabled()
  expect(sessionStorage.length).toBe(0)
})
it("retains uncertain request across remount and retries identical input after quantities changed", async () => {
  jest.mocked(receiveBillInventoryLines).mockResolvedValueOnce({ success: false, error: "Unconfirmed", status: 503 })
  const view = show(); await fill()
  fireEvent.click(screen.getByRole("button", { name: "Receive stock" }))
  await screen.findByText("Unconfirmed")
  const input = jest.mocked(receiveBillInventoryLines).mock.calls[0][0]
  expect(screen.getByRole("spinbutton", { name: "Qty received now for Stock widget" })).toBeDisabled()
  view.unmount()
  jest.mocked(readBillInventoryReceiptLines).mockResolvedValue({ data: [{ ...receiptLines[0], received_quantity: 8 }], actorId, error: null })
  show()
  const retry = await screen.findByRole("button", { name: "Retry saved receipt" })
  await waitFor(() => expect(retry).toBeEnabled())
  fireEvent.click(retry)
  await waitFor(() => expect(receiveBillInventoryLines).toHaveBeenLastCalledWith(input))
  await waitFor(() => expect(onSuccess).toHaveBeenCalled())
})
it("preserves pending after subsequent permission denial without auto retry", async () => {
  jest.mocked(receiveBillInventoryLines).mockResolvedValueOnce({ success: false, error: "Unconfirmed", status: 503 })
    .mockResolvedValueOnce({ success: false, error: "Denied", status: 403 })
  show(); await fill()
  fireEvent.click(screen.getByRole("button", { name: "Receive stock" }))
  fireEvent.click(await screen.findByRole("button", { name: "Retry saved receipt" }))
  await screen.findByText("Denied")
  expect(sessionStorage.length).toBe(1)
  expect(receiveBillInventoryLines).toHaveBeenCalledTimes(2)
})
it("offers retry for receipt loading failure and never mutates", async () => {
  jest.mocked(listLocations).mockResolvedValue({ data: [], error: "provider detail" })
  show()
  await screen.findByRole("alert")
  expect(screen.queryByText("provider detail")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Receive stock" })).toBeDisabled()
  jest.mocked(listLocations).mockResolvedValue({ data: locations })
  fireEvent.click(screen.getByRole("button", { name: "Retry loading receipt data" }))
  await screen.findByText("Stock widget")
})
it("blocks writes if pending input cannot be persisted", async () => {
  show(); await fill()
  const storage = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("unavailable") })
  fireEvent.click(screen.getByRole("button", { name: "Receive stock" }))
  await screen.findByRole("alert")
  expect(receiveBillInventoryLines).not.toHaveBeenCalled()
  storage.mockRestore()
})
it("restores pending for manual retry even when current receipt reads are denied", async () => {
  jest.mocked(receiveBillInventoryLines).mockResolvedValueOnce({ success: false, error: "Unconfirmed", status: 503 })
  const view = show(); await fill()
  fireEvent.click(screen.getByRole("button", { name: "Receive stock" }))
  await screen.findByText("Unconfirmed")
  const input = jest.mocked(receiveBillInventoryLines).mock.calls[0][0]
  view.unmount()
  jest.mocked(readBillInventoryReceiptLines).mockResolvedValue({ data: [], error: "Denied" })
  jest.mocked(receiveBillInventoryLines).mockResolvedValueOnce({ success: false, error: "Permission denied", status: 403 })
  show()
  const retry = await screen.findByRole("button", { name: "Retry saved receipt" })
  await waitFor(() => expect(retry).toBeEnabled())
  expect(receiveBillInventoryLines).toHaveBeenCalledTimes(1)
  fireEvent.click(retry)
  await screen.findByText("Permission denied")
  expect(receiveBillInventoryLines).toHaveBeenLastCalledWith(input)
  expect(sessionStorage.length).toBe(1)
})


const completedPurchase = { ...purchase, title: "Materials", status: "completed", stockReceived: true, amountDue: 0 } as Purchase
const savedInput = { siteId, purchaseId: purchase.id, requestId: "00000000-0000-4000-8000-000000000008",
  toLocationId: purchase.locationId!, receivingUserId: receiverId, lines: [{ purchaseItemId: lineId, quantity: 5 }] }

async function showEntry(surface: "detail" | "list", bill = completedPurchase) {
  if (surface === "detail") {
    jest.mocked(getPurchaseById).mockResolvedValue({ purchase: bill, error: null })
    const params = Promise.resolve({ id: bill.id })
    await act(async () => {
      render(<Suspense fallback={null}><BillDetailPage params={params} /></Suspense>)
    })
    await screen.findByText("Bill invoice")
  } else {
    render(<BillRowActions purchase={bill} onOpen={jest.fn()} onDelete={jest.fn()} />)
    fireEvent.keyDown(screen.getByRole("button", { name: "Bill actions: Materials" }), { key: "Enter" })
    await screen.findByRole("menuitem", { name: "Open" })
  }
}

it.each(["detail", "list"] as const)("recovers a committed final receipt from the %s after reload, retries identically and clears", async surface => {
  jest.mocked(receiveBillInventoryLines).mockRejectedValueOnce(new Error("Response lost"))
  const initial = show(); await fill()
  fireEvent.click(screen.getByRole("button", { name: "Receive stock" }))
  await screen.findByRole("alert")
  const input = jest.mocked(receiveBillInventoryLines).mock.calls[0][0]
  initial.unmount()
  jest.mocked(readBillInventoryReceiptLines).mockResolvedValue({
    data: receiptLines.map(line => ({ ...line, received_quantity: line.quantity })), actorId, error: null,
  })
  jest.mocked(receiveBillInventoryLines).mockResolvedValue({ success: true, error: null,
    requestId: input.requestId, movementIds: [], alreadyApplied: true })
  await showEntry(surface)
  expect(receiveBillInventoryLines).toHaveBeenCalledTimes(1)
  fireEvent.click(await screen.findByRole(surface === "detail" ? "button" : "menuitem", { name: "Retry saved receipt" }))
  const dialog = await screen.findByRole("dialog")
  const retry = await within(dialog).findByRole("button", { name: "Retry saved receipt" })
  await waitFor(() => expect(retry).toBeEnabled())
  expect(receiveBillInventoryLines).toHaveBeenCalledTimes(1)
  fireEvent.click(retry)
  await waitFor(() => expect(receiveBillInventoryLines).toHaveBeenCalledTimes(2))
  expect(receiveBillInventoryLines).toHaveBeenLastCalledWith(input)
  await waitFor(() => expect(sessionStorage.getItem(pendingReceiptKey(actorId, siteId, purchase.id))).toBeNull())
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  if (surface === "list") {
    fireEvent.keyDown(screen.getByRole("button", { name: "Bill actions: Materials" }), { key: "Enter" })
    await screen.findByRole("menuitem", { name: "Open" })
  }
  expect(screen.queryByRole(surface === "detail" ? "button" : "menuitem", { name: /Retry saved receipt|Receive stock/ })).not.toBeInTheDocument()
})

it.each(["detail", "list"] as const)("does not expose another actor's completed receipt in %s", async surface => {
  writePendingReceipt(pendingReceiptKey(actorId, siteId, purchase.id), savedInput)
  mockActorId = "another-actor"
  await showEntry(surface)
  expect(screen.queryByRole(surface === "detail" ? "button" : "menuitem", { name: /Retry saved receipt|Receive stock/ })).not.toBeInTheDocument()
  expect(sessionStorage.length).toBe(1)
  expect(receiveBillInventoryLines).not.toHaveBeenCalled()
})

it("keeps list recovery disabled for viewers", async () => {
  writePendingReceipt(pendingReceiptKey(actorId, siteId, purchase.id), savedInput)
  mockCanWrite = false
  await showEntry("list")
  expect(screen.getByRole("menuitem", { name: "Retry saved receipt" })).toHaveAttribute("aria-disabled", "true")
  expect(getPurchaseById).not.toHaveBeenCalled()
  expect(receiveBillInventoryLines).not.toHaveBeenCalled()
})

it("does not offer list recovery for a cancelled bill even with a saved receipt", async () => {
  writePendingReceipt(pendingReceiptKey(actorId, siteId, purchase.id), savedInput)
  await showEntry("list", { ...completedPurchase, status: "cancelled" })
  expect(screen.queryByRole("menuitem", { name: "Retry saved receipt" })).not.toBeInTheDocument()
})

it("rechecks cancellation before opening list recovery", async () => {
  writePendingReceipt(pendingReceiptKey(actorId, siteId, purchase.id), savedInput)
  jest.mocked(getPurchaseById).mockResolvedValue({ purchase: { ...completedPurchase, status: "cancelled" }, error: null })
  await showEntry("list")
  fireEvent.click(screen.getByRole("menuitem", { name: "Retry saved receipt" }))
  await waitFor(() => expect(getPurchaseById).toHaveBeenCalledWith(siteId, purchase.id))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(receiveBillInventoryLines).not.toHaveBeenCalled()
  expect(sessionStorage.length).toBe(1)
})
