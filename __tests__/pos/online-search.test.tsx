import { act, fireEvent, render, screen } from "@testing-library/react"
import { PosOnlineSearch } from "@/app/pos/components/PosOnlineSearch"
import { searchPosCatalog } from "@/app/pos/actions/search-catalog"
import { filterLocalPosCatalog } from "@/app/pos/filter-catalog"
import { marketplaceItem } from "../marketplace/catalog-fixture"

jest.mock("@/app/pos/actions/search-catalog", () => ({ searchPosCatalog: jest.fn() }))
const item = { ...marketplaceItem("ready"), name: "Running shoe", site_id: "site", sku: "CODE-123" }
const pending = { ...item, id: "new", name: "New product" }
const stale = { ...item, id: "stale", name: "Changed product" }
const unavailable = { ...item, id: "blocked", name: "Unavailable product" }
const onAdd = jest.fn()
const availability = jest.fn(candidate => ({ sellable: candidate.id !== "blocked", status: "available" as const, backorderQty: 0 }))
const props = { siteId: "site", query: "comfortable", online: true, hydrated: true,
  catalogItems: [item, { ...stale, updated_at: "old" }, unavailable], localResultIds: [], selectedCategory: "all",
  onAdd, getAvailability: availability }

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  jest.mocked(searchPosCatalog).mockResolvedValue({ success: true, count: 4, count_kind: "candidate_window",
    has_more: false, mode: "hybrid", degraded: false, search_id: "search",
    items: [item, pending, stale, unavailable] })
})
afterEach(() => jest.useRealTimers())
async function search() { await act(async () => { jest.advanceTimersByTime(400) }) }

it("keeps local name/SKU matches immediate and independent of online search", () => {
  expect(filterLocalPosCatalog([item], [item], "code-123", "all")).toEqual([item])
  expect(searchPosCatalog).not.toHaveBeenCalled()
})

it("does not search offline, for empty input, or demo data", async () => {
  const view = render(<PosOnlineSearch {...props} online={false} />)
  await search()
  expect(screen.getByText(/Offline — local search/)).toBeInTheDocument()
  view.rerender(<PosOnlineSearch {...props} query=" " />)
  await search()
  view.rerender(<PosOnlineSearch {...props} siteId="demo-site" />)
  await search()
  expect(searchPosCatalog).not.toHaveBeenCalled()
})

it("adds only the hydrated local item and blocks unsynced, changed and unavailable suggestions", async () => {
  render(<PosOnlineSearch {...props} />)
  await search()
  expect(searchPosCatalog).toHaveBeenCalledWith("site", "comfortable")
  fireEvent.click(screen.getByRole("button", { name: "Running shoe" }))
  expect(onAdd).toHaveBeenCalledWith(item)
  for (const label of ["New product — Sync catalog to use", "Changed product — Sync catalog to use", "Unavailable product — Unavailable"]) {
    expect(screen.getByRole("button", { name: label })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: label }))
  }
  expect(onAdd).toHaveBeenCalledTimes(1)
})

it("does not duplicate immediate local results and refuses wrong-site snapshot items", async () => {
  render(<PosOnlineSearch {...props} localResultIds={[item.id]} catalogItems={[{ ...pending, site_id: "other" }]} />)
  await search()
  expect(screen.queryByRole("button", { name: "Running shoe" })).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "New product — Sync catalog to use" })).toBeDisabled()
})

it("hides stale suggestions on query/site changes and offline transition", async () => {
  const view = render(<PosOnlineSearch {...props} />)
  await search()
  view.rerender(<PosOnlineSearch {...props} siteId="another" />)
  expect(screen.queryByRole("button", { name: "Running shoe" })).not.toBeInTheDocument()
  view.rerender(<PosOnlineSearch {...props} online={false} />)
  expect(screen.queryByRole("button", { name: "Running shoe" })).not.toBeInTheDocument()
})

it("shows online failure separately without replacing the local catalog", async () => {
  jest.mocked(searchPosCatalog).mockResolvedValue({ items: [], error: "Online search is unavailable. Local search still works." })
  render(<PosOnlineSearch {...props} />)
  await search()
  expect(screen.getByRole("status")).toHaveTextContent("Local search still works")
})