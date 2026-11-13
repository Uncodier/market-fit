import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import useSWR, { SWRConfig } from "swr"
import { InventoryMovementsPage } from "@/app/inventory/movements/components/InventoryMovementsPage"
import { listInventoryMovements, createInventoryMovement } from "@/app/inventory/movements/actions"
import { listTransferOrders, createTransferOrder } from "@/app/inventory/movements/order-actions"
import { listLocations } from "@/app/inventory/actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { demoMovements, demoLocations, demoItems, demoMembers } from "@/app/inventory/movements/demo-data"
import { siteMembersService } from "@/app/services/site-members-service"
import { NAVIGATION_AREAS, getNavItemTitle } from "@/app/config/navigation-areas"
import { getNavKeyForPath, getKnownNavKeys, isScreenBlocked } from "@/lib/auth/screen-access"
import Page from "@/app/inventory/movements/page"
import { pendingMovementKey } from "@/app/inventory/movements/pending-movement"

let mockSiteId = "site-one"
let mockActorId = "actor-one"
jest.mock("@/app/components/auth/auth-context", () => ({ useAuthContext: () => ({ user: { id: mockActorId } }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
jest.mock("@/app/inventory/movements/actions", () => ({ listInventoryMovements: jest.fn(), createInventoryMovement: jest.fn() }))
jest.mock("@/app/inventory/movements/order-actions", () => ({ listTransferOrders: jest.fn(), createTransferOrder: jest.fn() }))
jest.mock("@/app/inventory/actions", () => ({ listLocations: jest.fn() }))
jest.mock("@/app/catalog/actions", () => ({ listCatalogItems: jest.fn() }))
jest.mock("@/app/services/site-members-service", () => ({ siteMembersService: { getAssigneeOptions: jest.fn() } }))
jest.mock("@/app/components/ui/relation-select", () => ({
  RelationSelect: ({ label, options, value, onValueChange, disabled }: {
    label: string; options: { id: string; label: string }[]; value: { id: string } | null;
    onValueChange: (value: { mode: string; id: string; label: string } | null) => void; disabled?: boolean
  }) => <select disabled={disabled} aria-label={label} value={value?.id || ""} onChange={event => {
    const option = options.find(option => option.id === event.target.value)
    onValueChange(option ? { mode: "existing", ...option } : null)
  }}><option value="">Select an item</option>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select>,
}))
jest.mock("@/app/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, disabled }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void; disabled?: boolean }) => {
    const trigger = React.Children.toArray(children).find(child => React.isValidElement<{ "aria-label"?: string }>(child) && child.props["aria-label"])
    const label = React.isValidElement<{ "aria-label"?: string }>(trigger) ? trigger.props["aria-label"] : undefined
    return <select disabled={disabled} aria-label={label || (value === "all" ? "Filter by location" : undefined)} value={value} onChange={event => onValueChange(event.target.value)}>{children}</select>
  },
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value, disabled }: { children: React.ReactNode; value: string; disabled?: boolean }) => <option value={value} disabled={disabled}>{children}</option>,
}))

function mount(demo = false) {
  const view = render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}><InventoryMovementsPage demo={demo} initialSort="newest" /></SWRConfig>)
  return view
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(listTransferOrders).mockResolvedValue({ data: [] })
  jest.mocked(createInventoryMovement).mockResolvedValue({ success: true, requestId: "legacy-request", movementIds: [], alreadyApplied: true })
  mockSiteId = "site-one"
  mockActorId = "actor-one"
  sessionStorage.clear()
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => "12345678-1234-4234-8234-123456789abc" })
  jest.mocked(listInventoryMovements).mockResolvedValue({ data: demoMovements })
  jest.mocked(listLocations).mockResolvedValue({ data: demoLocations as never })
  jest.mocked(listCatalogItems).mockResolvedValue({ data: demoItems as never, count: 3 })
  jest.mocked(siteMembersService.getAssigneeOptions).mockResolvedValue(demoMembers)
  jest.mocked(createTransferOrder).mockResolvedValue({ success: true, requestId: "12345678-1234-4234-8234-123456789abc", orderId: "order-one", alreadyApplied: false })
})

test("registers a separate Operations destination and blockable screen", () => {
  const item = NAVIGATION_AREAS.operations.items.find(item => item.key === "inventoryMovements")!
  expect(item.href).toBe("/inventory/movements")
  expect(getNavItemTitle(item, key => key)).toBe("Inventory Ledger")
  expect(getNavKeyForPath(item.href, new URLSearchParams())).toBe(item.key)
  expect(getKnownNavKeys().has(item.key)).toBe(true)
  expect(isScreenBlocked("collaborator", [item.key], item.key)).toBe(true)
})

test.each([["1", true], ["true", false], ["0", false], [undefined, false]])("demo is enabled only by ?demo=1, not %s", async (demo, expected) => {
  const page = await Page({ searchParams: Promise.resolve({ demo }) })
  expect(page.props.demo).toBe(expected)
})

test("explicit demo shows local rows and four locations without any backend read or write", async () => {
  mount(true)
  expect(screen.queryByText(/Demo mode — sample movements/)).not.toBeInTheDocument()
  expect(screen.getByText("Showing 1 – 8 of 8 movements")).toBeInTheDocument()
  expect(screen.getByLabelText("Filter by location").querySelectorAll("option")).toHaveLength(5)
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  expect(screen.getByRole("button", { name: "Request Transfer" })).toBeDisabled()
  fireEvent.submit(screen.getByRole("button", { name: "Request Transfer" }).closest("form")!)
  expect(listInventoryMovements).not.toHaveBeenCalled()
  expect(listLocations).not.toHaveBeenCalled()
  expect(listCatalogItems).not.toHaveBeenCalled()
  expect(siteMembersService.getAssigneeOptions).not.toHaveBeenCalled()
  expect(createTransferOrder).not.toHaveBeenCalled()
})

test("selected demo sites use local fixtures and cannot read or mutate backend", async () => {
  mockSiteId = "demo-inventory"
  mount()
  expect(screen.queryByText(/Demo mode — sample movements/)).not.toBeInTheDocument()
  expect(screen.getByText("Showing 1 – 8 of 8 movements")).toBeInTheDocument()
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  fireEvent.submit(screen.getByRole("button", { name: "Request Transfer" }).closest("form")!)
  expect(screen.getByRole("button", { name: "Request Transfer" })).toBeDisabled()
  expect(listInventoryMovements).not.toHaveBeenCalled()
  expect(listLocations).not.toHaveBeenCalled()
  expect(listCatalogItems).not.toHaveBeenCalled()
  expect(createTransferOrder).not.toHaveBeenCalled()
})

test("live page provides an explicit read-only demo entry", async () => {
  mount()
  expect(screen.getByRole("link", { name: "View read-only demo preview" })).toHaveAttribute("href", "/inventory/movements?demo=1")
  await screen.findByText("Showing 1 – 8 of 8 movements")
})

test("switching sites resets filters and closes the previous site's dialog", () => {
  mockSiteId = "demo-first"
  const { rerender } = mount()
  fireEvent.change(screen.getAllByPlaceholderText("Search movements...")[0], { target: { value: "no-match" } })
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  expect(screen.getByRole("dialog")).toBeInTheDocument()
  mockSiteId = "demo-second"
  rerender(<InventoryMovementsPage demo={false} initialSort="newest" />)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(screen.getByText("Showing 1 – 8 of 8 movements")).toBeInTheDocument()
  expect(screen.getAllByPlaceholderText("Search movements...")[0]).toHaveValue("")
})

test("explains the latest 1,000 movement backend limit", async () => {
  jest.mocked(listInventoryMovements).mockResolvedValue({ data: Array.from({ length: 1000 }, (_, index) => ({ ...demoMovements[0], id: `movement-${index}` })) })
  mount()
  await screen.findByText("Showing the latest 1,000 movements. Search and filters apply to these loaded movements only.")
  expect(screen.getByText("Showing 1 – 50 of 1000 movements")).toBeInTheDocument()
})

test("live list uses actions, filters item and locations, and shows real errors", async () => {
  mount()
  await screen.findByText("Showing 1 – 8 of 8 movements")
  expect(listInventoryMovements).toHaveBeenCalledWith("site-one")
  fireEvent.change(screen.getAllByPlaceholderText("Search movements...")[0], { target: { value: "weekly" } })
  expect(screen.getByText("Showing 1 – 1 of 1 movements")).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText("Filter by location"), { target: { value: "demo-outlet" } })
  expect(screen.getByText("No matching movements")).toBeInTheDocument()
})

test("backend failure stays an error rather than becoming demo or empty data", async () => {
  jest.mocked(listInventoryMovements).mockResolvedValue({ data: [], error: "Access denied" })
  mount()
  await screen.findByText("Access denied")
  expect(screen.queryByText("No movements yet")).not.toBeInTheDocument()
  expect(screen.queryByText(/Demo mode/)).not.toBeInTheDocument()
})

test("new movement validates and submits existing item, distinct locations and positive quantity", async () => {
  mount()
  await screen.findByText("Showing 1 – 8 of 8 movements")
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  const submit = await screen.findByRole("button", { name: "Request Transfer" })
  await waitFor(() => expect(listCatalogItems).toHaveBeenCalled())
  fireEvent.click(submit)
  await screen.findByText("Please select an existing catalog item.")
  fireEvent.change(screen.getByLabelText("Catalog Item"), { target: { value: "demo-coffee" } })
  const dialog = screen.getByRole("dialog")
  const selects = dialog.querySelectorAll("select")
  fireEvent.change(selects[1], { target: { value: "demo-warehouse" } })
  fireEvent.change(selects[2], { target: { value: "demo-store" } })
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "0" } })
  fireEvent.submit(submit.closest("form")!)
  await screen.findByText("Quantity must be greater than zero.")
  expect(createTransferOrder).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2.5" } })
  fireEvent.click(submit)
  await waitFor(() => expect(createTransferOrder).toHaveBeenCalledWith(expect.objectContaining({
    siteId: "site-one", requestId: expect.any(String), items: [{ catalogItemId: "demo-coffee", quantity: 2.5 }], fromLocationId: "demo-warehouse", toLocationId: "demo-store",
  })))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
})

test("failed mutations keep the dialog open and reuse the request ID on an unchanged retry", async () => {
  jest.mocked(createTransferOrder).mockResolvedValue({ error: "Insufficient stock", status: 503 })
  mount()
  await screen.findByText("Showing 1 – 8 of 8 movements")
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  await waitFor(() => expect(listCatalogItems).toHaveBeenCalled())
  fireEvent.change(screen.getByLabelText("Catalog Item"), { target: { value: "demo-coffee" } })
  const selects = screen.getByRole("dialog").querySelectorAll("select")
  fireEvent.change(selects[1], { target: { value: "demo-warehouse" } })
  fireEvent.change(selects[2], { target: { value: "demo-store" } })
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await screen.findByText("Insufficient stock")
  expect(screen.getByRole("dialog")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry Movement" }))
  await waitFor(() => expect(createTransferOrder).toHaveBeenCalledTimes(2))
  expect(jest.mocked(createTransferOrder).mock.calls[0][0].requestId).toBe(jest.mocked(createTransferOrder).mock.calls[1][0].requestId)
})

function LocationsConsumer() {
  // The inventory/bills shared-cache contract: consumers read the envelope.
  const { data } = useSWR(["locations", mockSiteId], () => listLocations(mockSiteId))
  return <div data-testid="shared-locations">{data?.error || data?.data?.map(row => row.name).join(",") || "Loading"}</div>
}

test.each(["consumer-first", "movements-first"])("locations cache survives shared-cache navigation: %s", async order => {
  const cache = new Map()
  const wrap = (consumer: boolean) => <SWRConfig value={{ provider: () => cache, dedupingInterval: 60_000, revalidateOnMount: false, shouldRetryOnError: false }}>
    {consumer ? <LocationsConsumer /> : <InventoryMovementsPage demo={false} initialSort="newest" />}
  </SWRConfig>
  // Fetch on first mount; subsequent navigation deliberately reuses the cache.
  const initial = <SWRConfig value={{ provider: () => cache, dedupingInterval: 60_000, shouldRetryOnError: false }}>
    {order === "consumer-first" ? <LocationsConsumer /> : <InventoryMovementsPage demo={false} initialSort="newest" />}
  </SWRConfig>
  const view = render(initial)
  await waitFor(() => expect(listLocations).toHaveBeenCalled())
  await act(async () => {})
  view.rerender(wrap(order !== "consumer-first"))
  if (order === "consumer-first") {
    expect(screen.getByRole("option", { name: demoLocations[0].name })).toBeInTheDocument()
  } else {
    expect(screen.getByTestId("shared-locations")).toHaveTextContent(demoLocations[0].name)
  }
  expect(listLocations).toHaveBeenCalledTimes(1)
})

test("location errors stay in the shared envelope, block a fresh mutation and do not render stale locations", async () => {
  jest.mocked(listLocations).mockResolvedValue({ data: demoLocations as never, error: "Location access denied" })
  mount()
  await screen.findByText("Unable to load locations: Location access denied")
  expect(screen.queryByRole("option", { name: demoLocations[0].name })).not.toBeInTheDocument()
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  expect(await screen.findByRole("button", { name: "Request Transfer" })).toBeDisabled()
})

async function prepareMovement() {
  await screen.findByText("Showing 1 – 8 of 8 movements")
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  await waitFor(() => expect(screen.getByLabelText("Catalog Item")).not.toBeDisabled())
  fireEvent.change(screen.getByLabelText("Catalog Item"), { target: { value: "demo-coffee" } })
  const selects = screen.getByRole("dialog").querySelectorAll("select")
  fireEvent.change(selects[1], { target: { value: "demo-warehouse" } })
  fireEvent.change(selects[2], { target: { value: "demo-store" } })
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "2.5" } })
  fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "Weekly restock" } })
}

test.each(["503", "transport"])("uncertain %s locks edits and survives close/reopen and reload without automatic replay", async failure => {
  if (failure === "503") jest.mocked(createTransferOrder).mockResolvedValue({ error: "Unconfirmed", status: 503 })
  else jest.mocked(createTransferOrder).mockRejectedValue(new Error("Unconfirmed"))
  let view = mount()
  await prepareMovement()
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await screen.findByText("Unconfirmed")
  const sent = jest.mocked(createTransferOrder).mock.calls[0][0]
  expect(JSON.parse(sessionStorage.getItem(pendingMovementKey(mockActorId, mockSiteId))!)).toEqual({ ...sent, workflow: "transfer_order" })
  for (const label of ["Catalog Item", "Quantity", "Notes (optional)"]) expect(screen.getByLabelText(label)).toBeDisabled()
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "5" } })
  expect(screen.getByLabelText("Quantity")).toHaveValue(2.5)
  fireEvent.click(screen.getByRole("button", { name: "Close (keep pending)" }))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  expect(await screen.findByRole("button", { name: "Retry Movement" })).toBeEnabled()
  expect(screen.getByLabelText("Quantity")).toHaveValue(2.5)
  view.unmount()
  view = mount()
  await screen.findByText("Showing 1 – 8 of 8 movements")
  expect(createTransferOrder).toHaveBeenCalledTimes(1)
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  expect(await screen.findByRole("button", { name: "Retry Movement" })).toBeEnabled()
  jest.mocked(createTransferOrder).mockResolvedValue({ success: true, requestId: sent.requestId, orderId: "order-one", alreadyApplied: true })
  fireEvent.click(screen.getByRole("button", { name: "Retry Movement" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(jest.mocked(createTransferOrder).mock.calls[1][0]).toEqual(sent)
  expect(sessionStorage.getItem(pendingMovementKey(mockActorId, mockSiteId))).toBeNull()
  view.unmount()
})

test.each([400, 403])("definite %s permits correction and clears pending storage", async status => {
  jest.mocked(createTransferOrder).mockResolvedValue({ error: "Rejected", status })
  mount()
  await prepareMovement()
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await screen.findByText("Rejected")
  expect(screen.getByLabelText("Quantity")).toBeEnabled()
  expect(sessionStorage.length).toBe(0)
})

test("request conflict does not discard the pending identity or admit a new draft", async () => {
  jest.mocked(createTransferOrder).mockResolvedValue({ error: "Request ID was already used with different operations", status: 409 })
  mount()
  await prepareMovement()
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await screen.findByText("Request ID was already used with different operations")
  expect(screen.getByLabelText("Quantity")).toBeDisabled()
  expect(sessionStorage.length).toBe(1)
})

test("definite atomic inventory rejection 409 clears pending and allows a corrected draft", async () => {
  jest.mocked(createTransferOrder).mockResolvedValue({ error: "Insufficient inventory or bill cannot be received", status: 409 })
  mount()
  await prepareMovement()
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await screen.findByText("Insufficient inventory or bill cannot be received")
  expect(screen.getByLabelText("Quantity")).toBeEnabled()
  expect(sessionStorage.length).toBe(0)
})

test.each([400, 403, 409])("a %s rejection after an uncertain attempt cannot prove the first attempt unapplied", async status => {
  jest.mocked(createTransferOrder).mockResolvedValueOnce({ error: "Unconfirmed", status: 503 })
  mount()
  await prepareMovement()
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await screen.findByText("Unconfirmed")
  jest.mocked(createTransferOrder).mockResolvedValue({ error: status === 409 ? "Insufficient inventory or bill cannot be received" : "Access or resources changed", status })
  fireEvent.click(screen.getByRole("button", { name: "Retry Movement" }))
  await screen.findByText(status === 409 ? "Insufficient inventory or bill cannot be received" : "Access or resources changed")
  expect(screen.getByLabelText("Quantity")).toBeDisabled()
  expect(sessionStorage.length).toBe(1)
  expect(screen.getByRole("button", { name: "Retry Movement" })).toBeInTheDocument()
})

test("double submit sends once while in flight; reload admits only the same pending input", async () => {
  let finish!: (result: Awaited<ReturnType<typeof createTransferOrder>>) => void
  jest.mocked(createTransferOrder).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const view = mount()
  await prepareMovement()
  const form = screen.getByRole("button", { name: "Request Transfer" }).closest("form")!
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(createTransferOrder).toHaveBeenCalledTimes(1)
  expect(sessionStorage.length).toBe(1)
  view.unmount()
  await act(async () => finish({ error: "Unconfirmed", status: 503 }))
  mount()
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  expect(await screen.findByRole("button", { name: "Retry Movement" })).toBeEnabled()
  expect(createTransferOrder).toHaveBeenCalledTimes(1)
})

test("validation and storage failures before send never send or retain a pending attempt", async () => {
  mount()
  await prepareMovement()
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "0" } })
  fireEvent.submit(screen.getByRole("button", { name: "Request Transfer" }).closest("form")!)
  await screen.findByText("Quantity must be greater than zero.")
  expect(sessionStorage.length).toBe(0)
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "1" } })
  const write = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage denied") })
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await screen.findByText("Storage denied")
  expect(createTransferOrder).not.toHaveBeenCalled()
  expect(sessionStorage.length).toBe(0)
  write.mockRestore()
})

test.each(["actor", "site"])("pending restoration is scoped to %s", async scope => {
  jest.mocked(createTransferOrder).mockResolvedValue({ error: "Unconfirmed", status: 503 })
  const view = mount()
  await prepareMovement()
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await screen.findByText("Unconfirmed")
  view.unmount()
  if (scope === "actor") mockActorId = "actor-two"
  else mockSiteId = "site-two"
  mount()
  await screen.findByText("Showing 1 – 8 of 8 movements")
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  expect(await screen.findByRole("button", { name: "Request Transfer" })).toBeInTheDocument()
  expect(screen.getByLabelText("Quantity")).toHaveValue(1)
  expect(sessionStorage.length).toBe(1)
})

async function addSecondLine(quantity = "3") {
  fireEvent.click(screen.getByRole("button", { name: "Add product line" }))
  fireEvent.change(screen.getByLabelText("Catalog Item 2"), { target: { value: "demo-mug" } })
  fireEvent.change(screen.getByLabelText("Quantity 2"), { target: { value: quantity } })
}

test("two product lines and a selected receiver are sent in one atomic request", async () => {
  mount()
  await prepareMovement()
  await addSecondLine()
  await waitFor(() => expect(screen.getByLabelText("Receiving responsible person (optional)")).toBeEnabled())
  fireEvent.change(screen.getByLabelText("Receiving responsible person (optional)"), { target: { value: demoMembers[0].id } })
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await waitFor(() => expect(createTransferOrder).toHaveBeenCalledTimes(1))
  expect(createTransferOrder).toHaveBeenCalledWith({ siteId: mockSiteId, requestId: expect.any(String), items: [{ catalogItemId: "demo-coffee", quantity: 2.5 }, { catalogItemId: "demo-mug", quantity: 3 }], fromLocationId: "demo-warehouse", toLocationId: "demo-store", status: "requested", notes: "Weekly restock", receivingUserId: demoMembers[0].id })
})

test("one invalid product line blocks the entire movement and removing it allows submission", async () => {
  mount()
  await prepareMovement()
  await addSecondLine("0")
  fireEvent.submit(screen.getByRole("button", { name: "Request Transfer" }).closest("form")!)
  expect(await screen.findByText("Quantity must be greater than zero.")).toBeInTheDocument()
  expect(createTransferOrder).not.toHaveBeenCalled()
  expect(sessionStorage.length).toBe(0)
  fireEvent.click(screen.getByRole("button", { name: "Remove product line 2" }))
  expect(screen.getByRole("button", { name: "Remove product line 1" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await waitFor(() => expect(createTransferOrder).toHaveBeenCalledTimes(1))
  expect(jest.mocked(createTransferOrder).mock.calls[0][0]).not.toHaveProperty("receivingUserId")
})

test("pending batch reopens locked and retries identical lines, receiver and request ID", async () => {
  jest.mocked(createTransferOrder).mockResolvedValue({ error: "Unconfirmed", status: 503 })
  const view = mount()
  await prepareMovement()
  await addSecondLine()
  fireEvent.change(screen.getByLabelText("Receiving responsible person (optional)"), { target: { value: demoMembers[1].id } })
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await screen.findByText("Unconfirmed")
  const sent = jest.mocked(createTransferOrder).mock.calls[0][0]
  view.unmount()
  mount()
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  expect(await screen.findByRole("button", { name: "Retry Movement" })).toBeEnabled()
  for (const label of ["Catalog Item 1", "Catalog Item 2", "Quantity 1", "Quantity 2", "Receiving responsible person (optional)"]) expect(screen.getByLabelText(label)).toBeDisabled()
  for (const name of ["Add product line", "Remove product line 1", "Remove product line 2"]) expect(screen.getByRole("button", { name })).toBeDisabled()
  expect(screen.getByLabelText("Quantity 2")).toHaveValue(3)
  expect(createTransferOrder).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("button", { name: "Retry Movement" }))
  await waitFor(() => expect(createTransferOrder).toHaveBeenCalledTimes(2))
  expect(jest.mocked(createTransferOrder).mock.calls[1][0]).toEqual(sent)
})

test("restored v1 legacy pending input retries its original legacy shape", async () => {
  const legacy = { siteId: mockSiteId, requestId: "legacy-request", catalogItemId: "demo-coffee", quantity: 2, fromLocationId: "demo-warehouse", toLocationId: "demo-store" }
  sessionStorage.setItem(pendingMovementKey(mockActorId, mockSiteId), JSON.stringify(legacy))
  mount()
  fireEvent.click(await screen.findByRole("button", { name: "Recover pending operation" }))
  fireEvent.click(await screen.findByRole("button", { name: "Retry Movement" }))
  await waitFor(() => expect(createInventoryMovement).toHaveBeenCalledWith(legacy))
  expect(jest.mocked(createInventoryMovement).mock.calls[0][0]).not.toHaveProperty("items")
})

test("receiver names display and are searchable without requiring receiver fields on older rows", async () => {
  mount(true)
  expect(screen.getByRole("columnheader", { name: "Receiver" })).toBeInTheDocument()
  fireEvent.change(screen.getAllByPlaceholderText("Search movements...")[0], { target: { value: "Jordan Lee" } })
  expect(screen.getByText("Showing 1 – 3 of 3 movements")).toBeInTheDocument()
})

test("a restored 100-line batch cannot add or remove lines", async () => {
  const batch = { siteId: mockSiteId, requestId: "batch-request", fromLocationId: "demo-warehouse", toLocationId: "demo-store", items: Array.from({ length: 100 }, () => ({ catalogItemId: "demo-coffee", quantity: 1 })) }
  sessionStorage.setItem(pendingMovementKey(mockActorId, mockSiteId), JSON.stringify(batch))
  mount()
  act(() => window.dispatchEvent(new CustomEvent("inventory-movements:create")))
  expect(await screen.findByRole("button", { name: "Retry Movement" })).toBeEnabled()
  expect(screen.getAllByRole("group", { name: /Product line/ })).toHaveLength(100)
  expect(screen.getByRole("button", { name: "Add product line" })).toBeDisabled()
})

test("an unavailable assignee service still permits an unassigned movement", async () => {
  jest.mocked(siteMembersService.getAssigneeOptions).mockRejectedValue(new Error("Unavailable"))
  mount()
  await prepareMovement()
  await screen.findByText(/Unable to load receiving responsible people/)
  expect(screen.getByLabelText("Receiving responsible person (optional)")).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await waitFor(() => expect(createTransferOrder).toHaveBeenCalledTimes(1))
  expect(jest.mocked(createTransferOrder).mock.calls[0][0]).not.toHaveProperty("receivingUserId")
})

test("save draft stores a versioned workflow but sends only the backend shape", async () => {
  jest.mocked(createTransferOrder).mockResolvedValue({ error: "Unconfirmed", status: 503 })
  mount(); await prepareMovement()
  fireEvent.click(screen.getByRole("button", { name: "Save Draft" }))
  await screen.findByText("Unconfirmed")
  expect(createTransferOrder).toHaveBeenCalledWith(expect.objectContaining({ status: "draft" }))
  expect(jest.mocked(createTransferOrder).mock.calls[0][0]).not.toHaveProperty("workflow")
  expect(JSON.parse(sessionStorage.getItem(pendingMovementKey(mockActorId, mockSiteId))!)).toEqual(expect.objectContaining({ workflow: "transfer_order", status: "draft" }))
  expect(createInventoryMovement).not.toHaveBeenCalled()
})

test("duplicate product lines must be combined before requesting", async () => {
  mount(); await prepareMovement(); await addSecondLine()
  fireEvent.change(screen.getByLabelText("Catalog Item 2"), { target: { value: "demo-coffee" } })
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await screen.findByText("Each catalog item can appear only once. Combine quantities for duplicate products.")
  expect(createTransferOrder).not.toHaveBeenCalled()
})