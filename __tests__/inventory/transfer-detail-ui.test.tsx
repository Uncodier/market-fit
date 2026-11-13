import React from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { TopBarPrimaryActionsSlot } from "@/app/components/navigation/topbar-primary-actions"
import { SWRConfig } from "swr"
import { TransferDetailPage } from "@/app/inventory/movements/components/TransferDetailPage"
import { TransferOrdersPage } from "@/app/inventory/movements/components/TransferOrdersPage"
import { InventoryMovementsPage } from "@/app/inventory/movements/components/InventoryMovementsPage"
import { NAVIGATION_AREAS, getNavItemTitle } from "@/app/config/navigation-areas"
import { getKnownNavKeys, getNavKeyForPath } from "@/lib/auth/screen-access"
import { getTransferOrder, listTransferOrders, transitionTransferOrder } from "@/app/inventory/movements/order-actions"
import { demoTransferOrders } from "@/app/inventory/movements/transfer-demo-data"
import { pendingTransitionKey } from "@/app/inventory/movements/pending-transfer-transition"
import type { TransferOrderDetail } from "@/app/inventory/movements/order-types"

const site = "11111111-1111-4111-8111-111111111111"
const orderId = "22222222-2222-4222-8222-222222222222"
let mockActor = "actor-one"
let mockSite = site
let mockManager = true
jest.mock("@/app/components/auth/auth-context", () => ({ useAuthContext: () => ({ user: { id: mockActor } }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSite } }) }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => ({ capabilities: { role: mockManager ? "admin" : "collaborator", delete: false }, can: () => true }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header> }))
jest.mock("@/app/inventory/movements/order-actions", () => ({ getTransferOrder: jest.fn(), listTransferOrders: jest.fn(), transitionTransferOrder: jest.fn(), createTransferOrder: jest.fn() }))
jest.mock("@/app/inventory/movements/actions", () => ({ listInventoryMovements: jest.fn(), createInventoryMovement: jest.fn() }))
jest.mock("@/app/inventory/actions", () => ({ listLocations: jest.fn().mockResolvedValue({ data: [] }) }))
jest.mock("@/app/catalog/actions", () => ({ listCatalogItems: jest.fn() }))
jest.mock("@/app/services/site-members-service", () => ({ siteMembersService: { getAssigneeOptions: jest.fn() } }))

function fixture(status: TransferOrderDetail["status"] = "in_transit"): TransferOrderDetail {
  return { ...demoTransferOrders[3], id: orderId, site_id: site, status,
    lines: demoTransferOrders[3].lines.map((line, index) => ({ ...line, id: `33333333-3333-4333-8333-${String(index + 1).padStart(12, "0")}`, order_id: orderId, site_id: site })) }
}
function mount(demo = false, id = orderId) {
  return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}><TopBarPrimaryActionsSlot /><TransferDetailPage orderId={id} demo={demo} /></SWRConfig>)
}
async function openSecondary(name: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: "Transfer options" }), { key: "Enter" })
  fireEvent.click(await screen.findByRole("menuitem", { name }))
}
beforeEach(() => {
  jest.clearAllMocks(); sessionStorage.clear(); mockActor = "actor-one"; mockSite = site; mockManager = true
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => "44444444-4444-4444-8444-444444444444" })
  jest.mocked(getTransferOrder).mockResolvedValue({ data: fixture() })
  jest.mocked(transitionTransferOrder).mockResolvedValue({ success: true, orderId, requestId: "44444444-4444-4444-8444-444444444444", alreadyApplied: false })
})

test("demo has document rows linking varied read-only details with no real calls", async () => {
  const view = render(<TransferOrdersPage demo initialSort="newest" />)
  expect(screen.getByText("Showing 1 – 6 of 6 transfers")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /Transfer 5/ })).toHaveAttribute("href", "/inventory/movements/demo-transfer-5?demo=1")
  expect(listTransferOrders).not.toHaveBeenCalled()
  view.unmount(); mount(true, "demo-transfer-5")
  expect(screen.getByRole("heading", { name: "Transfer 5" })).toBeInTheDocument()
  expect(await screen.findByRole("button", { name: "Receive Transfer" })).toBeDisabled()
  expect(screen.getByText(/units in transit/)).toBeInTheDocument()
  expect(screen.getByText("2 mugs broken in transit")).toBeInTheDocument()
  for (const label of ["Requested", "Dispatched", "Received", "Outstanding", "Line status"]) expect(screen.getByRole("columnheader", { name: label })).toBeInTheDocument()
  expect(screen.getAllByText(/^Returned:/)).not.toHaveLength(0)
  expect(getTransferOrder).not.toHaveBeenCalled(); expect(transitionTransferOrder).not.toHaveBeenCalled()
})

test("transfer documents and stock ledger are separate Operations screens", async () => {
  const nav = NAVIGATION_AREAS.operations.items.find(item => item.key === "inventoryTransfers")!
  expect(nav.href).toBe("/inventory/transfers")
  expect(getNavItemTitle(nav, key => key)).toBe("Inventory Transfers")
  expect(getKnownNavKeys().has(nav.key)).toBe(true)
  expect(getNavKeyForPath(nav.href, new URLSearchParams())).toBe(nav.key)
  const view = render(<TransferOrdersPage demo initialSort="newest" />)
  expect(screen.getByRole("link", { name: "View Inventory Ledger" })).toHaveAttribute("href", "/inventory/movements?demo=1")
  expect(screen.queryByRole("tab", { name: "Inventory Ledger" })).not.toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText("Search transfers..."), { target: { value: "demo-transfer-5" } })
  expect(screen.getByText("Showing 1 – 1 of 1 transfers")).toBeInTheDocument()
  act(() => window.dispatchEvent(new CustomEvent("inventory-transfers:create")))
  expect(screen.getByRole("button", { name: "Request Transfer" })).toBeDisabled()
  view.unmount(); render(<InventoryMovementsPage demo initialSort="newest" />)
  expect(screen.getByText("Showing 1 – 8 of 8 movements")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "View transfer documents" })).toHaveAttribute("href", "/inventory/transfers?demo=1")
  expect(screen.queryByRole("columnheader", { name: "Document" })).not.toBeInTheDocument()
})

test("manager approval only and cancel disappears after dispatch", async () => {
  mockManager = false
  jest.mocked(getTransferOrder).mockResolvedValue({ data: fixture("requested") })
  const view = mount(); await screen.findByRole("heading", { name: /Transfer/ })
  expect(screen.queryByRole("button", { name: "Approve Transfer" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Transfer options" })).toBeEnabled()
  view.unmount(); mockManager = true; mount()
  expect(await screen.findByRole("button", { name: "Approve Transfer" })).toBeEnabled()
})

test("primary action renders only in the shell topbar and secondary actions use the identity menu", async () => {
  jest.mocked(getTransferOrder).mockResolvedValue({ data: fixture("draft") })
  mount()
  const primary = await screen.findByRole("button", { name: "Request Transfer" })
  expect(primary.closest("[data-page-primary-actions]")).not.toBeNull()
  expect(within(screen.getByRole("main")).queryByRole("button", { name: "Request Transfer" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Cancel transfer" })).not.toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole("button", { name: "Transfer options" }), { key: "Enter" })
  expect(await screen.findByRole("menuitem", { name: "Cancel transfer" })).toBeInTheDocument()
})

test("incremental receipt caps remaining and never forces closure", async () => {
  const order = fixture("partially_received"); order.lines[0].received_quantity = 15
  jest.mocked(getTransferOrder).mockResolvedValue({ data: order })
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Receive Transfer" }))
  expect(screen.queryByRole("button", { name: "Cancel transfer" })).not.toBeInTheDocument()
  fireEvent.change(screen.getByLabelText("Coffee Beans Receive now"), { target: { value: "6" } })
  fireEvent.submit(screen.getByRole("button", { name: "Confirm receive" }).closest("form")!)
  await screen.findByText("Coffee Beans: quantity cannot exceed 5.")
  expect(transitionTransferOrder).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText("Coffee Beans Receive now"), { target: { value: "2" } })
  fireEvent.click(screen.getByRole("button", { name: "Confirm receive" }))
  await waitFor(() => expect(transitionTransferOrder).toHaveBeenCalledWith(expect.objectContaining({ action: "receive", revision: order.revision, lines: [{ lineId: order.lines[0].id, quantity: 2 }] })))
  expect(screen.getByText(/units in transit/)).toBeInTheDocument()
})

test("dispatch actual totals cannot exceed requested", async () => {
  jest.mocked(getTransferOrder).mockResolvedValue({ data: fixture("approved") })
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Dispatch Transfer" }))
  fireEvent.change(screen.getByLabelText("Coffee Beans Dispatch total"), { target: { value: "21" } })
  fireEvent.submit(screen.getByRole("button", { name: "Confirm dispatch" }).closest("form")!)
  await screen.findByText("Coffee Beans: quantity cannot exceed 20.")
  expect(transitionTransferOrder).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText("Coffee Beans Dispatch total"), { target: { value: "10" } })
  fireEvent.click(screen.getByRole("button", { name: "Confirm dispatch" }))
  await waitFor(() => expect(transitionTransferOrder).toHaveBeenCalledWith(expect.objectContaining({ action: "dispatch", lines: fixture().lines.map((line, index) => ({ lineId: line.id, quantity: index === 0 ? 10 : 0 })) })))
})

test("reconciliation requires reason and shared remaining bound", async () => {
  mount(); await screen.findByRole("heading", { name: /Transfer/ }); await openSecondary("Resolve differences")
  fireEvent.change(screen.getByLabelText("Coffee Beans Return"), { target: { value: "12" } })
  fireEvent.change(screen.getByLabelText("Coffee Beans Write off"), { target: { value: "10" } })
  const form = screen.getByRole("button", { name: "Confirm reconcile" }).closest("form")!
  fireEvent.submit(form); await screen.findByText("Coffee Beans: quantity cannot exceed 20.")
  fireEvent.change(screen.getByLabelText("Coffee Beans Write off"), { target: { value: "2" } })
  fireEvent.submit(form); await screen.findByText("A reason is required for returned or written-off quantities.")
  fireEvent.change(screen.getByLabelText("Reason (required)"), { target: { value: "Damaged packaging" } })
  fireEvent.submit(form)
  await waitFor(() => expect(transitionTransferOrder).toHaveBeenCalledWith(expect.objectContaining({ action: "reconcile", notes: "Damaged packaging", lines: [{ lineId: fixture().lines[0].id, returnedQuantity: 12, writtenOffQuantity: 2 }] })))
})

test("uncertain transition persists before send and exact explicit retry survives reload", async () => {
  jest.mocked(transitionTransferOrder).mockImplementation(async input => {
    const stored = JSON.parse(sessionStorage.getItem(pendingTransitionKey(mockActor, site, orderId))!)
    expect(stored).toEqual({ actorId: mockActor, payload: input })
    return { error: "Unconfirmed", status: 503 }
  })
  let view = mount(); fireEvent.click(await screen.findByRole("button", { name: "Receive Transfer" }))
  fireEvent.change(screen.getByLabelText("Coffee Beans Receive now"), { target: { value: "3" } })
  fireEvent.click(screen.getByRole("button", { name: "Confirm receive" }))
  await screen.findByText("Unconfirmed [503]")
  const sent = jest.mocked(transitionTransferOrder).mock.calls[0][0]
  expect(screen.queryByRole("button", { name: "Receive Transfer" })).not.toBeInTheDocument()
  view.unmount(); view = mount()
  await screen.findByRole("button", { name: "Retry original operation" })
  expect(transitionTransferOrder).toHaveBeenCalledTimes(1)
  jest.mocked(transitionTransferOrder).mockResolvedValue({ success: true, orderId, requestId: sent.requestId, alreadyApplied: true })
  fireEvent.click(screen.getByRole("button", { name: "Retry original operation" }))
  await waitFor(() => expect(transitionTransferOrder).toHaveBeenCalledTimes(2))
  expect(jest.mocked(transitionTransferOrder).mock.calls[1][0]).toEqual(sent)
  await waitFor(() => expect(sessionStorage.length).toBe(0)); view.unmount()
})

test("storage failure blocks submission and activity remains accessible", async () => {
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Receive Transfer" }))
  fireEvent.change(screen.getByLabelText("Coffee Beans Receive now"), { target: { value: "3" } })
  const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage denied") })
  fireEvent.click(screen.getByRole("button", { name: "Confirm receive" }))
  await screen.findByText("Storage denied"); expect(transitionTransferOrder).not.toHaveBeenCalled(); write.mockRestore()
  fireEvent.click(screen.getByRole("button", { name: "Back" }))
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Activity" }), { button: 0, ctrlKey: false })
  await act(async () => {})
  expect(screen.getByText("Operation details")).toBeInTheDocument()
})

test.each(["actor", "site"])("pending detail operations cannot cross %s boundaries", async scope => {
  jest.mocked(transitionTransferOrder).mockResolvedValue({ error: "Unconfirmed", status: 503 })
  const view = mount(); fireEvent.click(await screen.findByRole("button", { name: "Receive Transfer" }))
  fireEvent.change(screen.getByLabelText("Coffee Beans Receive now"), { target: { value: "3" } })
  fireEvent.click(screen.getByRole("button", { name: "Confirm receive" }))
  await screen.findByText("Unconfirmed [503]"); view.unmount()
  if (scope === "actor") mockActor = "actor-two"
  else mockSite = "55555555-5555-4555-8555-555555555555"
  mount(); expect(await screen.findByRole("button", { name: "Receive Transfer" })).toBeEnabled()
  expect(screen.queryByRole("button", { name: "Retry original operation" })).not.toBeInTheDocument()
  expect(transitionTransferOrder).toHaveBeenCalledTimes(1)
})

test("a later permission rejection cannot clear an earlier uncertain operation", async () => {
  jest.mocked(transitionTransferOrder).mockResolvedValue({ error: "Unconfirmed", status: 503 })
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Receive Transfer" }))
  fireEvent.change(screen.getByLabelText("Coffee Beans Receive now"), { target: { value: "3" } })
  fireEvent.click(screen.getByRole("button", { name: "Confirm receive" }))
  await screen.findByText("Unconfirmed [503]")
  jest.mocked(transitionTransferOrder).mockResolvedValue({ error: "Denied", status: 403 })
  fireEvent.click(screen.getByRole("button", { name: "Retry original operation" }))
  await screen.findByText("Denied [403]")
  expect(sessionStorage.length).toBe(1)
  expect(screen.queryByRole("button", { name: "Receive Transfer" })).not.toBeInTheDocument()
})

test("fresh atomic rejection clears attempt and reloads the current revision", async () => {
  jest.mocked(transitionTransferOrder).mockResolvedValue({ error: "Revision changed", status: 409, code: "operation_rejected" })
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Receive Transfer" }))
  fireEvent.change(screen.getByLabelText("Coffee Beans Receive now"), { target: { value: "3" } })
  fireEvent.click(screen.getByRole("button", { name: "Confirm receive" }))
  await screen.findByText("Revision changed (operation_rejected) [409]")
  expect(sessionStorage.length).toBe(0)
  expect(screen.getByRole("button", { name: "Receive Transfer" })).toBeEnabled()
  expect(getTransferOrder).toHaveBeenCalledTimes(2)
})

test("only assigned receiver or manager receives; only managers reconcile", async () => {
  mockManager = false
  const view = mount(); await screen.findByRole("heading", { name: /Transfer/ })
  expect(screen.queryByRole("button", { name: "Receive Transfer" })).not.toBeInTheDocument()
  expect(screen.queryByRole("menuitem", { name: "Resolve differences" })).not.toBeInTheDocument()
  view.unmount()
  const order = fixture(); order.receiving_user_id = mockActor
  jest.mocked(getTransferOrder).mockResolvedValue({ data: order })
  mount(); expect(await screen.findByRole("button", { name: "Receive Transfer" })).toBeEnabled()
  expect(screen.queryByRole("menuitem", { name: "Resolve differences" })).not.toBeInTheDocument()
})