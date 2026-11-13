import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { CreateMovementDialog } from "@/app/inventory/movements/components/CreateMovementDialog"
import { MovementCatalogSelect } from "@/app/inventory/movements/components/MovementCatalogSelect"
import { listCatalogItems } from "@/app/catalog/actions"
import { createTransferOrder } from "@/app/inventory/movements/order-actions"
import { createInventoryMovement } from "@/app/inventory/movements/actions"
import { pendingMovementKey } from "@/app/inventory/movements/pending-movement"
import type { CatalogItem } from "@/app/types"
import type { CatalogListResponse } from "@/app/catalog/types"

jest.mock("@/app/components/auth/auth-context", () => ({ useAuthContext: () => ({ user: { id: "actor" } }) }))
jest.mock("@/app/catalog/actions", () => ({ listCatalogItems: jest.fn() }))
jest.mock("@/app/inventory/movements/order-actions", () => ({ createTransferOrder: jest.fn() }))
jest.mock("@/app/inventory/movements/actions", () => ({ createInventoryMovement: jest.fn() }))
jest.mock("@/app/services/site-members-service", () => ({ siteMembersService: { getAssigneeOptions: jest.fn().mockResolvedValue([]) } }))
jest.mock("@/app/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, disabled }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void; disabled: boolean }) =>
    <select aria-label="Location or receiver" value={value} disabled={disabled} onChange={event => onValueChange(event.target.value)}><option value="" />{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
}))

const catalog = Array.from({ length: 1001 }, (_, index) => ({
  id: `product-${index}`, name: `Product ${index}`, sku: `SKU-${index}`, kind: "product",
  ...(index === 1000 ? { name: "Rare blue variant", parent_id: "product-0" } : {}),
})) as CatalogItem[]
const rare = catalog[1000]
const locations = [{ id: "source", name: "Source" }, { id: "destination", name: "Destination" }]
const response = (data: CatalogItem[], count = data.length): CatalogListResponse => ({ data, count })
const list = jest.mocked(listCatalogItems)

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => "12345678-1234-4234-8234-123456789abc" })
  list.mockImplementation(async ({ q, page = 1, pageSize = 50 }) => {
    const matches = q === "hard to find" ? [rare] : q ? [] : catalog
    return response(matches.slice((page - 1) * pageSize, page * pageSize), matches.length)
  })
  jest.mocked(createTransferOrder).mockResolvedValue({ success: true } as never)
  jest.mocked(createInventoryMovement).mockResolvedValue({ success: true } as never)
})

function mount(demo = false) {
  return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <CreateMovementDialog open onOpenChange={jest.fn()} siteId="site" demo={demo} locations={locations} onSuccess={jest.fn()} />
  </SWRConfig>)
}
function mountPicker() {
  return render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <MovementCatalogSelect open siteId="site" actorId="actor" demo={false} disabled={false} label="Catalog Item" value={null} onValueChange={jest.fn()} />
  </SWRConfig>)
}
async function ready(label = "Catalog Item") {
  await waitFor(() => expect(screen.getByLabelText(label)).toBeEnabled())
}
async function choose(id: string) {
  const option = await waitFor(() => {
    const node = document.querySelector(`[data-relation-id="${id}"]`)
    expect(node).not.toBeNull()
    return node!
  })
  fireEvent.click(option)
}
function setLocations() {
  const selects = screen.getAllByRole("combobox")
  fireEvent.change(selects[0], { target: { value: "source" } })
  fireEvent.change(selects[1], { target: { value: "destination" } })
}

test("a variant beyond the first 1000 is found by server search and retained through different searches and submission", async () => {
  mount()
  await ready()
  expect(catalog.slice(0, 1000)).not.toContain(rare)
  expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 50, kind: "all", q: "" }))
  // The phrase does not occur in the label: do not discard ranked server matches.
  fireEvent.change(screen.getByLabelText("Catalog Item"), { target: { value: "hard to find" } })
  await choose(rare.id)
  expect(screen.getByLabelText("Catalog Item")).toHaveValue("Rare blue variant (SKU-1000)")
  fireEvent.click(screen.getByRole("button", { name: "Add product line" }))
  await ready("Catalog Item 2")
  fireEvent.click(screen.getByLabelText("Catalog Item 2"))
  await choose(catalog[0].id)
  fireEvent.change(screen.getByLabelText("Catalog Item 1"), { target: { value: "no matches" } })
  await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ q: "no matches", page: 1 })))
  await screen.findByText("No items found")
  setLocations()
  fireEvent.click(screen.getByRole("button", { name: "Request Transfer" }))
  await waitFor(() => expect(createTransferOrder).toHaveBeenCalledWith(expect.objectContaining({
    items: [{ catalogItemId: rare.id, quantity: 1 }, { catalogItemId: catalog[0].id, quantity: 1 }],
  })))
  const payload = jest.mocked(createTransferOrder).mock.calls[0][0]
  expect(payload).not.toHaveProperty("actorId")
  expect(payload).not.toHaveProperty("userId")
  expect(payload.items[0]).not.toHaveProperty("label")
})


test("browse pages are bounded, search pages retain their snapshot and a new query resets it", async () => {
  list.mockImplementation(async ({ q, page = 1 }) => ({
    ...response([catalog[page - 1]], 1001),
    ...(q ? { search_id: "snapshot", has_more: page < 2 } : {}),
  }))
  mountPicker(); await ready()
  fireEvent.click(screen.getByRole("button", { name: "Next catalog page" }))
  await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ page: 2, q: "", pageSize: 50 })))
  await ready()
  fireEvent.change(screen.getByLabelText("Catalog Item"), { target: { value: "coffee" } })
  await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ q: "coffee", page: 1 })))
  fireEvent.click(await screen.findByRole("button", { name: "Next catalog page" }))
  await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ q: "coffee", page: 2, search_id: "snapshot" })))
  fireEvent.change(screen.getByLabelText("Catalog Item"), { target: { value: "tea" } })
  await waitFor(() => expect(list).toHaveBeenLastCalledWith({ siteId: "site", kind: "all", q: "tea", page: 1, pageSize: 50 }))
})

test("late search responses never replace newer results", async () => {
  let resolveOld!: (value: CatalogListResponse) => void
  list.mockImplementation(async ({ q }) => q === "old" ? new Promise(resolve => { resolveOld = resolve }) : response(q ? [rare] : [catalog[0]]))
  mountPicker(); await ready()
  fireEvent.change(screen.getByLabelText("Catalog Item"), { target: { value: "old" } })
  await waitFor(() => expect(resolveOld).toBeDefined())
  fireEvent.change(screen.getByLabelText("Catalog Item"), { target: { value: "new" } })
  await screen.findByText("Rare blue variant (SKU-1000)")
  await act(async () => resolveOld(response([catalog[0]])))
  expect(document.querySelector('[data-relation-id="product-0"]')).toBeNull()
  expect(document.querySelector('[data-relation-id="product-1000"]')).not.toBeNull()
})

test("catalog failure is visible and retryable without browse fallback", async () => {
  mountPicker(); await ready()
  list.mockResolvedValue({ data: [], count: 0, error: "Search unavailable" })
  fireEvent.change(screen.getByLabelText("Catalog Item"), { target: { value: "failed" } })
  await screen.findByText("Search unavailable")
  expect(document.querySelector('[data-relation-id="product-0"]')).toBeNull()
  list.mockResolvedValue(response([rare]))
  fireEvent.click(screen.getByRole("button", { name: "Retry catalog search" }))
  await screen.findByText("Rare blue variant (SKU-1000)")
})

test.each(["transfer_order", "legacy"])("pending %s replay does not require catalog hydration", async workflow => {
  const shared = { siteId: "site", requestId: "pending-request", fromLocationId: "source", toLocationId: "destination" }
  const pending = workflow === "transfer_order"
    ? { ...shared, workflow, status: "requested", items: [{ catalogItemId: rare.id, quantity: 2 }] }
    : { ...shared, catalogItemId: rare.id, quantity: 2 }
  sessionStorage.setItem(pendingMovementKey("actor", "site"), JSON.stringify(pending))
  list.mockResolvedValue({ data: [], count: 0, error: "Catalog unavailable" })
  mount()
  expect(list).not.toHaveBeenCalled()
  expect(createTransferOrder).not.toHaveBeenCalled()
  expect(createInventoryMovement).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Retry Movement" }))
  if (workflow === "transfer_order") {
    await waitFor(() => expect(createTransferOrder).toHaveBeenCalledWith({ ...shared, status: "requested", items: [{ catalogItemId: rare.id, quantity: 2 }] }))
  } else await waitFor(() => expect(createInventoryMovement).toHaveBeenCalledWith(pending))
})

test("demo selection never searches or writes to the backend", async () => {
  mount(true)
  fireEvent.change(screen.getByLabelText("Catalog Item"), { target: { value: "Coffee" } })
  await choose("demo-coffee")
  expect(screen.getByRole("button", { name: "Request Transfer" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Save Draft" })).toBeDisabled()
  fireEvent.submit(screen.getByRole("button", { name: "Request Transfer" }).closest("form")!)
  expect(list).not.toHaveBeenCalled()
  expect(createTransferOrder).not.toHaveBeenCalled()
  expect(createInventoryMovement).not.toHaveBeenCalled()
})


test("expired continuation restarts on page one with a fresh snapshot", async () => {
  list.mockImplementation(async ({ q, search_id }) => search_id
    ? { data: [], count: 0, error: "Search expired", error_status: 409 }
    : { ...response([rare], 100), ...(q ? { search_id: "old-snapshot", has_more: true } : {}) })
  mountPicker(); await ready()
  fireEvent.change(screen.getByLabelText("Catalog Item"), { target: { value: "coffee" } })
  await screen.findByText("Rare blue variant (SKU-1000)")
  fireEvent.click(screen.getByRole("button", { name: "Next catalog page" }))
  await screen.findByText("Search expired")
  list.mockResolvedValue({ ...response([rare]), search_id: "new-snapshot", has_more: false, result_kind: "related", candidate_window_truncated: false })
  fireEvent.click(screen.getByRole("button", { name: "Retry catalog search" }))
  await waitFor(() => expect(list).toHaveBeenLastCalledWith({ siteId: "site", kind: "all", q: "coffee", page: 1, pageSize: 50 }))
  await screen.findByText("Related results")
  expect(screen.queryByText(/ranked search window/)).not.toBeInTheDocument()
})
