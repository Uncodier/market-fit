import { act, fireEvent, render, screen } from "@testing-library/react"
import type { CatalogItem } from "@/app/types"
import type { ModifierGroupWithItems } from "@/app/catalog/modifier-types"
import { PosOptionsDialog } from "@/app/pos/components/PosOptionsDialog"
import { Skeleton } from "@/app/components/ui/skeleton"
import { createClient } from "@/lib/supabase/client"
import { getPosDb } from "@/app/pos/local/db"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ locale: "en", t: () => "" }),
}))
jest.mock("@/app/context/DisplayCurrencyContext", () => ({
  useDisplayCurrency: () => ({ formatPrice: (value: number) => `$${value}` }),
}))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => false }))
jest.mock("@/app/components/commerce/PromptImage", () => ({ PromptImage: () => null }))
jest.mock("@/app/lib/image-utils", () => ({
  resolveItemImage: () => "/test.jpg", optimizeForPreset: (value: string) => value,
}))
jest.mock("@/app/components/ui/skeleton", () => ({
  Skeleton: jest.fn(() => <div data-testid="skeleton" />),
}))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/pos/local/db", () => ({ getPosDb: jest.fn() }))

const host = {
  id: "parent", site_id: "site", name: "Coffee", status: "active", currency: "USD",
  is_purchasable: true,
} as CatalogItem
const axes = [{ id: "size", kind: "custom", label: "Size", values: [
  { id: "small", label: "Small" }, { id: "large", label: "Large" },
] }] satisfies NonNullable<CatalogItem["metadata"]>["variant_axes"]
const variantHost: CatalogItem = { ...host, metadata: { variant_axes: axes } }
const child = (id: string, overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  ...host, id, name: id === "small" ? "Small" : "Large", parent_id: host.id,
  is_pos_available: false, metadata: { option_values: { size: id } }, ...overrides,
})
const groups = (min = 0): ModifierGroupWithItems[] => [{
  id: "extras", site_id: "site", name: "Extras", min_select: min, max_select: 1,
  sort_order: 0, items: [{
    id: "milk-link", catalog_item_id: "milk", sort_order: 0, name: "Milk", price: 2,
  }],
}]
const onConfirm = jest.fn()
const onOpenChange = jest.fn()
const props = {
  item: host, open: true, catalogItems: [] as CatalogItem[], modifierGroupsByHostId: {},
  onConfirm, onOpenChange, resolvePrice: (_id: string, fallback: number) => fallback,
}
const confirmButton = () => screen.getByRole("button", { name: /^Confirm/ })
const pickMilk = () => fireEvent.click(screen.getByRole("checkbox"))
const expectNoLoadingOrIo = () => {
  expect(Skeleton).not.toHaveBeenCalled()
  expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument()
  expect(getPosDb).not.toHaveBeenCalled()
  expect(createClient).not.toHaveBeenCalled()
  expect(global.fetch).not.toHaveBeenCalled()
}

type QueryResult = { data: CatalogItem[] | null; error: { message: string } | null }
function mockVariants(result: Promise<QueryResult>) {
  const abortSignal = jest.fn<Promise<QueryResult>, [AbortSignal]>(() => result)
  const eq = jest.fn()
  const query = { eq, abortSignal }
  eq.mockReturnValue(query)
  const select = jest.fn(() => query)
  const from = jest.fn(() => ({ select }))
  jest.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
  return { from, eq, abortSignal }
}
function mockMeta(result: Promise<unknown>) {
  const get = jest.fn(() => result)
  jest.mocked(getPosDb).mockReturnValue({ meta: { get } } as unknown as ReturnType<typeof getPosDb>)
  return get
}
const flush = async () => { await act(async () => { await Promise.resolve() }) }

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(createClient).mockReset()
  jest.mocked(getPosDb).mockReset()
})

describe("POS options from complete prop snapshots", () => {
  it("renders hidden active variants immediately without skeleton, Dexie, or network", () => {
    render(<PosOptionsDialog {...props} item={variantHost} catalogItems={[
      variantHost, child("small"), child("large"),
      child("archived", { status: "archived" }), child("not-purchasable", { is_purchasable: false }),
    ]} />)
    expect(screen.getByRole("button", { name: /Small/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Large/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /archived|not-purchasable/ })).not.toBeInTheDocument()
    expect(confirmButton()).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: /Small/ }))
    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith({
      item: expect.objectContaining({ id: "small", _parent: { name: "Coffee" } }), modifiers: [],
    })
    expectNoLoadingOrIo()
  })

  it("renders legacy variants without metadata immediately", () => {
    render(<PosOptionsDialog {...props} catalogItems={[child("small", { metadata: undefined })]} />)
    fireEvent.click(screen.getByRole("button", { name: /Small/ }))
    expect(confirmButton()).toBeEnabled()
    expectNoLoadingOrIo()
  })

  it("renders modifiers immediately and validates required extras before confirmation", () => {
    render(<PosOptionsDialog {...props} modifierGroupsByHostId={{ [host.id]: groups(1) }} />)
    expect(screen.getByText("Milk")).toBeInTheDocument()
    expect(screen.getByText(/Required/)).toBeInTheDocument()
    expect(confirmButton()).toBeDisabled()
    expect(screen.queryByRole("button", { name: "No extras" })).not.toBeInTheDocument()
    fireEvent.click(confirmButton())
    expect(onConfirm).not.toHaveBeenCalled()
    pickMilk()
    expect(confirmButton()).toBeEnabled()
    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith({ item: host, modifiers: [{
      groupId: "extras", catalogItemId: "milk", name: "Milk", cartQty: 1, cartPrice: 2,
    }] })
    expectNoLoadingOrIo()
  })

  it("renders variants and extras together in the initial render", () => {
    render(<PosOptionsDialog {...props} item={variantHost} catalogItems={[child("small")]}
      modifierGroupsByHostId={{ [host.id]: groups(1) }} />)
    expect(screen.getByRole("button", { name: /Small/ })).toBeInTheDocument()
    expect(screen.getByText("Milk")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Small/ }))
    expect(confirmButton()).toBeDisabled()
    pickMilk()
    expect(confirmButton()).toBeEnabled()
    expectNoLoadingOrIo()
  })

  it.each([{}, { [host.id]: [] }])("treats empty children and map %j as known empty", (map) => {
    render(<PosOptionsDialog {...props} modifierGroupsByHostId={map} />)
    expect(screen.getByText("No options for this item.")).toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
    expectNoLoadingOrIo()
  })

  it("does not sell a parent with defined variant axes but no cached children", () => {
    render(<PosOptionsDialog {...props} item={variantHost} />)
    expect(confirmButton()).toBeDisabled()
    expectNoLoadingOrIo()
  })

  it("inherits nonempty parent groups when a child's own groups are empty", () => {
    render(<PosOptionsDialog {...props} item={child("small")}
      modifierGroupsByHostId={{ small: [], [host.id]: groups(1) }} />)
    expect(screen.getByText("Milk")).toBeInTheDocument()
    expect(confirmButton()).toBeDisabled()
    expectNoLoadingOrIo()
  })

  it("prefers nonempty own groups over parent groups", () => {
    render(<PosOptionsDialog {...props} item={child("small")}
      modifierGroupsByHostId={{ small: groups(), [host.id]: groups(1) }} />)
    expect(screen.getByText(/Optional/)).toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
    expectNoLoadingOrIo()
  })

  it("applies same-item snapshot changes synchronously without losing existing selections", () => {
    const first = { ...props, item: variantHost, catalogItems: [child("small")],
      modifierGroupsByHostId: { [host.id]: groups(1) } }
    const view = render(<PosOptionsDialog {...first} />)
    fireEvent.click(screen.getByRole("button", { name: /Small/ }))
    pickMilk()
    const updatedGroups = groups(1)
    updatedGroups[0].items.push({ id: "sugar-link", catalog_item_id: "sugar", name: "Sugar", price: 1, sort_order: 1 })
    const updatedChild = child("small", { target_sale_price: 9 })
    view.rerender(<PosOptionsDialog {...first} item={{ ...variantHost, name: "Updated Coffee" }}
      catalogItems={[updatedChild, child("large")]}
      modifierGroupsByHostId={{ [host.id]: updatedGroups }} />)
    expect(screen.getByText("Sugar")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Large/ })).toBeInTheDocument()
    expect(screen.getAllByRole("checkbox")[0]).toBeChecked()
    expect(confirmButton()).toBeEnabled()
    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      item: expect.objectContaining({ id: "small", target_sale_price: 9, _parent: { name: "Updated Coffee" } }),
      modifiers: [expect.objectContaining({ catalogItemId: "milk" })],
    }))
    expectNoLoadingOrIo()
  })

  it("reflects newly required groups and known-empty updates while open", () => {
    const view = render(<PosOptionsDialog {...props} />)
    expect(confirmButton()).toBeEnabled()
    view.rerender(<PosOptionsDialog {...props} modifierGroupsByHostId={{ [host.id]: groups(1) }} />)
    expect(confirmButton()).toBeDisabled()
    expect(screen.getByText("Milk")).toBeInTheDocument()
    view.rerender(<PosOptionsDialog {...props} />)
    expect(screen.getByText("No options for this item.")).toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
    expectNoLoadingOrIo()
  })

  it("does not confirm a removed selected variant", () => {
    const view = render(<PosOptionsDialog {...props} item={variantHost} catalogItems={[child("small"), child("large")]} />)
    fireEvent.click(screen.getByRole("button", { name: /Small/ }))
    expect(confirmButton()).toBeEnabled()
    view.rerender(<PosOptionsDialog {...props} item={variantHost} catalogItems={[child("large")]} />)
    expect(confirmButton()).toBeDisabled()
    expectNoLoadingOrIo()
  })

  it("keeps selected extras but uses updated snapshot prices and names", () => {
    const view = render(<PosOptionsDialog {...props} modifierGroupsByHostId={{ [host.id]: groups(1) }} />)
    pickMilk()
    const updated = groups(1)
    updated[0].items[0] = { ...updated[0].items[0], price: 3, name: "Oat milk" }
    view.rerender(<PosOptionsDialog {...props} modifierGroupsByHostId={{ [host.id]: updated }}
      resolvePrice={(_id, fallback) => fallback + 1} />)
    expect(screen.getByRole("checkbox")).toBeChecked()
    expect(confirmButton()).toHaveTextContent("+$4")
    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ modifiers: [
      expect.objectContaining({ catalogItemId: "milk", name: "Oat milk", cartPrice: 4, cartQty: 1 }),
    ] }))
    expectNoLoadingOrIo()
  })

  it("drops removed extras from confirmation and the total on known-empty updates", () => {
    const view = render(<PosOptionsDialog {...props} modifierGroupsByHostId={{ [host.id]: groups() }} />)
    pickMilk()
    view.rerender(<PosOptionsDialog {...props} />)
    expect(screen.getByText("No options for this item.")).toBeInTheDocument()
    expect(confirmButton()).toHaveTextContent(/^Confirm$/)
    expect(confirmButton()).toBeEnabled()
    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith({ item: host, modifiers: [] })
    expectNoLoadingOrIo()
  })

  it.each(["switch", "reopen"])("resets variants and extras on %s", (action) => {
    const initial = { ...props, item: variantHost, catalogItems: [child("small")],
      modifierGroupsByHostId: { [host.id]: groups(1) } }
    const view = render(<PosOptionsDialog {...initial} />)
    fireEvent.click(screen.getByRole("button", { name: /Small/ }))
    pickMilk()
    expect(confirmButton()).toBeEnabled()
    if (action === "reopen") view.rerender(<PosOptionsDialog {...initial} open={false} />)
    else view.rerender(<PosOptionsDialog {...props} item={{ ...host, id: "other" }} />)
    view.rerender(<PosOptionsDialog {...initial} />)
    expect(screen.getByRole("checkbox")).not.toBeChecked()
    expect(confirmButton()).toBeDisabled()
    expectNoLoadingOrIo()
  })
})

describe("scoped async fallback when snapshot props are unavailable", () => {
  it("loads only missing variants with an item/site-scoped cancellable query", async () => {
    const query = mockVariants(Promise.resolve({ data: [child("small")], error: null }))
    render(<PosOptionsDialog {...props} item={variantHost} catalogItems={undefined} />)
    expect(confirmButton()).toBeDisabled()
    await flush()
    expect(screen.getByRole("button", { name: /Small/ })).toBeInTheDocument()
    expect(query.from).toHaveBeenCalledWith("catalog_items")
    expect(query.eq).toHaveBeenCalledWith("site_id", "site")
    expect(query.eq).toHaveBeenCalledWith("parent_id", "parent")
    expect(query.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
    expect(getPosDb).not.toHaveBeenCalled()
  })

  it("loads only missing modifiers from scoped Dexie metadata, honoring its empty map", async () => {
    const get = mockMeta(Promise.resolve({ modifierGroupsByHostId: {} }))
    render(<PosOptionsDialog {...props} modifierGroupsByHostId={undefined} siteId="cache-site" />)
    await flush()
    expect(get).toHaveBeenCalledWith("cache-site")
    expect(screen.getByText("No options for this item.")).toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it("waits for both unavailable sources and validates fallback required extras", async () => {
    mockVariants(Promise.resolve({ data: [child("small")], error: null }))
    let resolve!: (value: unknown) => void
    mockMeta(new Promise((done) => { resolve = done }))
    render(<PosOptionsDialog {...props} item={variantHost}
      catalogItems={undefined} modifierGroupsByHostId={undefined} />)
    await flush()
    expect(confirmButton()).toBeDisabled()
    expect(screen.queryByText("Milk")).not.toBeInTheDocument()
    await act(async () => { resolve({ modifierGroupsByHostId: { [host.id]: groups(1) } }) })
    fireEvent.click(screen.getByRole("button", { name: /Small/ }))
    expect(confirmButton()).toBeDisabled()
    pickMilk()
    expect(confirmButton()).toBeEnabled()
  })

  it("catches synchronous failures before an async fallback is created", async () => {
    jest.mocked(getPosDb).mockImplementation(() => { throw new Error("unavailable IndexedDB") })
    render(<PosOptionsDialog {...props} modifierGroupsByHostId={undefined} />)
    await flush()
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load item options")
    expect(confirmButton()).toBeDisabled()
    expect(createClient).not.toHaveBeenCalled()
  })

  it.each(["rejected request", "query error", "Dexie rejection", "missing metadata", "missing map"])
  ("fails closed on %s without an unhandled rejection", async (failure) => {
    const variantsMissing = failure === "rejected request" || failure === "query error"
    if (variantsMissing) {
      mockVariants(failure === "query error"
        ? Promise.resolve({ data: null, error: { message: "private provider error" } })
        : Promise.reject(new Error("private provider error")))
    } else {
      mockMeta(failure === "Dexie rejection" ? Promise.reject(new Error("private database error"))
        : Promise.resolve(failure === "missing metadata" ? null : {}))
    }
    render(<PosOptionsDialog {...props}
      catalogItems={variantsMissing ? undefined : []}
      modifierGroupsByHostId={variantsMissing ? { [host.id]: groups() } : undefined} />)
    await flush()
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load item options")
    expect(screen.getByRole("alert")).not.toHaveTextContent("private")
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "No extras" })).not.toBeInTheDocument()
    expect(confirmButton()).toBeDisabled()
    fireEvent.click(confirmButton())
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it("ignores and aborts an older fallback after a complete snapshot arrives", async () => {
    let resolve!: (value: QueryResult) => void
    const query = mockVariants(new Promise((done) => { resolve = done }))
    const view = render(<PosOptionsDialog {...props} item={variantHost} catalogItems={undefined} />)
    const signal = query.abortSignal.mock.calls[0][0]
    view.rerender(<PosOptionsDialog {...props} item={variantHost} catalogItems={[child("large")]} />)
    expect(signal.aborted).toBe(true)
    expect(screen.getByRole("button", { name: /Large/ })).toBeInTheDocument()
    await act(async () => { resolve({ data: [child("small")], error: null }) })
    fireEvent.click(screen.getByRole("button", { name: /Large/ }))
    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ item: expect.objectContaining({ id: "large" }) }))
    expect(getPosDb).not.toHaveBeenCalled()
  })

  it("ignores rejected work after item switch or unmount", async () => {
    let reject!: (error: Error) => void
    const query = mockVariants(new Promise((_resolve, fail) => { reject = fail }))
    const view = render(<PosOptionsDialog {...props} catalogItems={undefined} />)
    const signal = query.abortSignal.mock.calls[0][0]
    view.rerender(<PosOptionsDialog {...props} item={{ ...host, id: "next" }} />)
    expect(signal.aborted).toBe(true)
    await act(async () => { reject(new Error("late failure")) })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
    view.unmount()
  })

  it("does not apply a late Dexie failure after closing and reopening with cached props", async () => {
    let reject!: (error: Error) => void
    mockMeta(new Promise((_resolve, fail) => { reject = fail }))
    const view = render(<PosOptionsDialog {...props} modifierGroupsByHostId={undefined} />)
    view.rerender(<PosOptionsDialog {...props} open={false} />)
    view.rerender(<PosOptionsDialog {...props} />)
    await act(async () => { reject(new Error("late database failure")) })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByText("No options for this item.")).toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
  })
})