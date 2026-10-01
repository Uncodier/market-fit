import type { ReactNode } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { endOfDay, startOfDay } from "date-fns"
import { SWRConfig } from "swr"
import OrdersPage from "@/app/orders/page"
import { listOrders } from "@/app/orders/actions"
import { cacheOrdersDateRange, ordersDateRangeStorageKey } from "@/app/orders/date-range-cache"
import type { DateRangePickerProps } from "@/app/components/ui/date-range-picker"

let mockSiteId = "site-1"
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key, locale: "en" }) }))
jest.mock("@/app/context/PermissionContext", () => ({
  usePermissions: () => ({ can: () => false }), useOptionalPermissions: () => null,
}))
jest.mock("@/app/orders/actions", () => ({ listOrders: jest.fn(), updateOrderStatus: jest.fn() }))
jest.mock("@/app/inventory/actions", () => ({ listLocations: jest.fn(async () => ({ data: [] })) }))
jest.mock("@/app/orders/hooks/useOrdersRealtime", () => ({ useOrdersRealtime: jest.fn() }))
jest.mock("@/lib/printer/hooks/use-printer-realtime", () => ({ usePrinterRealtime: jest.fn() }))
jest.mock("@/lib/printer/hooks/use-printer", () => ({ usePrinterSettings: () => ({}) }))
jest.mock("@/lib/printer", () => ({ ticketBrandFromSite: () => ({}) }))
jest.mock("@/app/orders/hooks/use-order-printing", () => ({ useOrderPrinting: () => ({ printingKey: null, printOrder: jest.fn() }) }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useMobileView: () => ["table", jest.fn()] }))
jest.mock("use-debounce", () => ({ useDebounce: (value: unknown) => [value] }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
jest.mock("@/app/components/ui/mobile-filters-drawer", () => ({
  MobileFiltersDrawer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FilterContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  FilterSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
jest.mock("@/app/components/ui/search-input", () => ({ SearchInput: () => null }))
jest.mock("@/app/components/ui/sort-dropdown", () => ({ SortDropdown: () => null }))
jest.mock("@/app/components/view-selector", () => ({ ViewSelector: () => null }))
jest.mock("@/app/components/printer/PrinterSyncBadge", () => ({ PrinterSyncBadge: () => null }))
jest.mock("@/app/components/ui/confirm-dialog", () => ({ ConfirmDialog: () => null }))
jest.mock("@/app/orders/components/OrdersKanban", () => ({ OrdersKanban: () => null, OrdersKanbanSkeleton: () => null }))
jest.mock("@/app/orders/components/OrdersTable", () => ({
  OrdersTableSkeleton: () => null,
  OrdersTable: ({ page, onPageChange }: { page: number; onPageChange: (page: number) => void }) => (
    <button onClick={() => onPageChange(page + 1)}>Page {page}</button>
  ),
}))
jest.mock("@/app/components/ui/date-range-picker", () => ({
  CalendarDateRangePicker: ({ onRangeChange, rangePreset, disabled }: DateRangePickerProps) => (
    <div>
      <span data-testid="preset">{rangePreset ?? "none"}</span>
      <button disabled={disabled} onClick={() => onRangeChange?.(startOfDay(new Date()), endOfDay(new Date()), "today")}>Today</button>
      <button disabled={disabled} onClick={() => onRangeChange?.(startOfDay(new Date()), endOfDay(new Date()), "custom")}>Custom</button>
    </div>
  ),
}))

const mockListOrders = jest.mocked(listOrders)
const storageKey = ordersDateRangeStorageKey("site-1")

function renderPage() {
  const config = { provider: () => new Map(), dedupingInterval: 0, revalidateOnFocus: false }
  const tree = () => <SWRConfig value={config}><OrdersPage /></SWRConfig>
  const view = render(tree())
  return { ...view, rerenderPage: () => view.rerender(tree()) }
}

describe("Orders persisted date filter wiring", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 8, 30, 23, 59, 59))
    window.localStorage.clear()
    mockSiteId = "site-1"
    mockListOrders.mockReset()
    mockListOrders.mockResolvedValue({ data: [], count: 100, error: null })
  })
  afterEach(() => jest.useRealTimers())

  it("requests today's bounds on reload, updates both pickers, and resets pagination at midnight", async () => {
    cacheOrdersDateRange("site-1", {
      startDate: new Date(2026, 8, 29), endDate: endOfDay(new Date(2026, 8, 29)), preset: "today",
    })
    renderPage()
    await waitFor(() => expect(mockListOrders).toHaveBeenCalled())
    expect(mockListOrders.mock.calls[0][0]).toMatchObject({
      startDate: startOfDay(new Date()).toISOString(), endDate: endOfDay(new Date()).toISOString(), page: 1,
    })
    expect(screen.getAllByTestId("preset").map((element) => element.textContent)).toEqual(["today", "today"])
    fireEvent.click(await screen.findByRole("button", { name: "Page 1" }))
    await waitFor(() => expect(mockListOrders.mock.calls.at(-1)?.[0].page).toBe(2))
    mockListOrders.mockClear()
    await act(async () => { jest.advanceTimersByTime(1000) })
    await waitFor(() => expect(mockListOrders).toHaveBeenCalled())
    for (const [params] of mockListOrders.mock.calls) {
      expect(params).toMatchObject({
        startDate: new Date(2026, 9, 1).toISOString(), endDate: endOfDay(new Date(2026, 9, 1)).toISOString(), page: 1,
      })
    }
  })

  it("persists preset changes from both picker placements and clears the entire selection", async () => {
    renderPage()
    fireEvent.click(screen.getAllByRole("button", { name: "Today" })[0])
    expect(JSON.parse(window.localStorage.getItem(storageKey)!)).toMatchObject({ preset: "today" })
    fireEvent.click(screen.getAllByRole("button", { name: "Custom" })[1])
    const saved = JSON.parse(window.localStorage.getItem(storageKey)!)
    expect(saved.preset).toBe("custom")
    await act(async () => { jest.advanceTimersByTime(1000) })
    expect(JSON.parse(window.localStorage.getItem(storageKey)!)).toEqual(saved)
    fireEvent.click(screen.getAllByRole("button", { name: "Clear date range" })[0])
    expect(window.localStorage.getItem(storageKey)).toBe("null")
    expect(screen.getAllByTestId("preset").map((element) => element.textContent)).toEqual(["none", "none"])
    await waitFor(() => expect(mockListOrders.mock.calls.at(-1)?.[0]).toMatchObject({
      startDate: undefined, endDate: undefined,
    }))
  })

  it("resets pagination when switching away and back without changing the dates", async () => {
    const { rerenderPage } = renderPage()
    fireEvent.click(await screen.findByRole("button", { name: "Page 1" }))
    await screen.findByRole("button", { name: "Page 2" })
    mockSiteId = "site-2"
    rerenderPage()
    await screen.findByRole("button", { name: "Page 1" })
    mockSiteId = "site-1"
    rerenderPage()
    await screen.findByRole("button", { name: "Page 1" })
    expect(screen.queryByRole("button", { name: "Page 2" })).not.toBeInTheDocument()
  })
})