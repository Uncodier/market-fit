import type { ReactNode } from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { CatalogSalesTab } from "@/app/catalog/components/CatalogSalesTab"
import type { CatalogSaleRow, CatalogSalesHistory } from "@/app/catalog/sales-history-types"

let mockLocale = "en"
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ locale: mockLocale }),
}))
jest.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AreaChart: ({ data }: { data: unknown }) => <div data-testid="trend-data">{JSON.stringify(data)}</div>,
  Area: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}))

const row: CatalogSaleRow = {
  id: "line-1", orderId: "order-1", orderNumber: "SO-001", saleId: "sale-1",
  date: "2026-10-10T23:30:00Z", itemName: "Blue variant", quantity: 2,
  revenue: 80, currency: "USD", source: "pos", status: "paid",
}
const history: CatalogSalesHistory = {
  availableCurrencies: ["USD", "EUR"],
  rows: [row, { ...row, id: "line-2", itemName: "Red variant", quantity: 1, revenue: 20 },
    { ...row, id: "line-eur", orderId: "order-eur", orderNumber: "SO-EUR", itemName: "Euro variant", currency: "EUR", revenue: 900 }],
}
const fetchMock = jest.mocked(fetch)
function response(body: CatalogSalesHistory | { error: string }, ok = true) {
  return { ok, json: async () => body } as Response
}
function setup(siteId = "site-a", catalogItemId = "item-a") {
  return render(<CatalogSalesTab siteId={siteId} catalogItemId={catalogItemId} />)
}
async function choose(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: label }), { key: "ArrowDown" })
  fireEvent.click(await screen.findByRole("option", { name: option }))
}

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(response(history))
  mockLocale = "en"
  jest.useFakeTimers({ doNotFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] })
  jest.setSystemTime(new Date("2026-10-12T00:30:00Z"))
  HTMLElement.prototype.scrollIntoView = jest.fn()
})
afterEach(() => jest.useRealTimers())

it("renders variants, currency-scoped metrics and trend, and links to orders", async () => {
  setup()
  expect(screen.getByRole("status", { name: "Loading sales history" })).toBeInTheDocument()
  expect(await screen.findByText("Euro variant")).toBeInTheDocument()
  expect(screen.queryByText("Blue variant")).not.toBeInTheDocument()
  await choose("Currency", "USD")
  expect(screen.getByText("Blue variant")).toBeInTheDocument()
  expect(screen.getByText("Red variant")).toBeInTheDocument()
  expect(screen.queryByText("Euro variant")).not.toBeInTheDocument()
  const metrics = screen.getByText("Item revenue", { selector: "dt" }).parentElement
  expect(metrics).toHaveTextContent("Item revenueUSD 100.00")
  expect(screen.getByText("Units sold").parentElement).toHaveTextContent("3")
  expect(screen.getByText("Orders").parentElement).toHaveTextContent("1")
  expect(screen.getByText("Average item price").parentElement).toHaveTextContent("USD 33.33")
  expect(screen.getAllByRole("link", { name: "SO-001" })[0]).toHaveAttribute("href", "/orders/order-1")
  expect(screen.getByText(/Item revenue is the stored item subtotal/)).toHaveTextContent("not order-wide discounts, tax, shipping or refund allocations")
  const trend = JSON.parse(screen.getByTestId("trend-data").textContent || "[]")
  expect(trend).toHaveLength(30)
  expect(trend.find((day: { date: string }) => day.date === "2026-10-10")).toEqual({ date: "2026-10-10", revenue: 100, units: 3 })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each([[30, "2026-09-13"], [90, "2026-07-15"], [365, "2025-10-13"]])(
  "requests an inclusive %i-day UTC period", async (days, startDate) => {
    setup()
    await screen.findByText("Euro variant")
    fireEvent.click(screen.getByRole("button", { name: `${days} days` }))
    await waitFor(() => {
      const url = String(fetchMock.mock.calls.at(-1)?.[0])
      expect(url).toContain(`/api/catalog/item-a/sales?siteId=site-a&startDate=${startDate}&endDate=2026-10-12`)
    })
  },
)

it("shows an API error rather than empty data and retries", async () => {
  fetchMock.mockResolvedValueOnce(response({ error: "Forbidden" }, false))
  setup()
  expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden")
  expect(screen.queryByText("No sales found")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(await screen.findByText("Euro variant")).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("shows an empty state without inventing revenue or rendering a chart", async () => {
  fetchMock.mockResolvedValue(response({ rows: [], availableCurrencies: [] }))
  setup()
  expect(await screen.findByText("No sales found")).toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
  expect(screen.queryByTestId("trend-data")).not.toBeInTheDocument()
})

it("keeps unspecified currency separate and does not format it as an ISO currency", async () => {
  fetchMock.mockResolvedValue(response({ availableCurrencies: ["UNSPECIFIED", "USD"], rows: [
    row, { ...row, id: "unknown-line", currency: "UNSPECIFIED", itemName: "Unknown currency item", revenue: 50 },
  ] }))
  setup()
  await screen.findByText("Unknown currency item")
  expect(screen.getByText("Item revenue", { selector: "dt" }).parentElement).toHaveTextContent("50 (currency unspecified)")
  expect(screen.queryByText("Blue variant")).not.toBeInTheDocument()
  await choose("Currency", "USD")
  expect(screen.getByText("Blue variant")).toBeInTheDocument()
  expect(screen.queryByText("Unknown currency item")).not.toBeInTheDocument()
})

it("paginates locally and resets pagination when source changes", async () => {
  fetchMock.mockResolvedValue(response({ availableCurrencies: ["USD"], rows: Array.from({ length: 12 }, (_, index) => ({
    ...row, id: `line-${index}`, itemName: `Variant ${index}`, source: index === 11 ? "shop" : "pos",
  })) }))
  setup()
  await screen.findByText("Variant 0")
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(11)
  expect(screen.queryByText("Variant 11")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  expect(screen.getByText("Variant 11")).toBeInTheDocument()
  expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument()
  await choose("Source", "shop")
  expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each(["site", "item"])("hides previously loaded data immediately on a %s switch", async boundary => {
  const view = setup()
  await screen.findByText("Euro variant")
  fetchMock.mockImplementationOnce(() => new Promise(() => {}))
  view.rerender(<CatalogSalesTab siteId={boundary === "site" ? "site-b" : "site-a"}
    catalogItemId={boundary === "item" ? "item-b" : "item-a"} />)
  expect(screen.queryByText("Euro variant")).not.toBeInTheDocument()
  expect(screen.getByRole("status", { name: "Loading sales history" })).toBeInTheDocument()
})

it("aborts and ignores a late response from the previous site even if fetch ignores abort", async () => {
  let finish!: (value: Response) => void
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const view = setup()
  const oldSignal = fetchMock.mock.calls[0][1]?.signal
  view.rerender(<CatalogSalesTab siteId="site-b" catalogItemId="item-a" />)
  expect(oldSignal?.aborted).toBe(true)
  await screen.findByText("Euro variant")
  await act(async () => finish(response({ availableCurrencies: ["USD"], rows: [{ ...row, itemName: "Stale tenant item" }] })))
  expect(screen.queryByText("Stale tenant item")).not.toBeInTheDocument()
  expect(screen.getByText("Euro variant")).toBeInTheDocument()
})

it("ignores a late response after switching the period", async () => {
  let finish!: (value: Response) => void
  fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  setup()
  fireEvent.click(screen.getByRole("button", { name: "90 days" }))
  await screen.findByText("Euro variant")
  await act(async () => finish(response({ rows: [], availableCurrencies: [] })))
  expect(screen.getByText("Euro variant")).toBeInTheDocument()
  expect(screen.queryByText("No sales found")).not.toBeInTheDocument()
})

it("formats money and UTC dates using the localization locale while keeping English copy", async () => {
  mockLocale = "de"
  fetchMock.mockResolvedValue(response({ availableCurrencies: ["USD"], rows: [row] }))
  setup()
  await screen.findByText("Blue variant")
  expect(screen.getByText("Item revenue", { selector: "dt" }).parentElement).toHaveTextContent("80,00 USD")
  expect(screen.getByRole("table")).toHaveTextContent(new Intl.DateTimeFormat("de", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(row.date)))
})