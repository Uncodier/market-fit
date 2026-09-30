import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { SalesReports } from "@/app/components/dashboard/sales-reports"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { useWidgetContext } from "@/app/context/WidgetContext"
import { fetchSalesReport, salesReportUrl } from "@/app/components/dashboard/sales/use-sales-report"
import type { SalesReportData } from "@/lib/sales/report-types"
import type { BaseKpiWidgetProps } from "@/app/components/dashboard/base-kpi-widget"
import type { MonthlySalesEvolutionChart } from "@/app/components/dashboard/monthly-sales-evolution-chart"

jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: jest.fn() }))
jest.mock("@/app/context/WidgetContext", () => ({ useWidgetContext: jest.fn() }))
jest.mock("@/app/components/dashboard/base-kpi-widget", () => ({
  BaseKpiWidget: ({ title, value, changeText, customStatus }: BaseKpiWidgetProps) => <div>{title}: {value} {customStatus || <span>{changeText}</span>}</div>,
}))
jest.mock("@/app/components/dashboard/monthly-sales-evolution-chart", () => ({
  MonthlySalesEvolutionChart: (props: React.ComponentProps<typeof MonthlySalesEvolutionChart>) => {
    mockTrendProps(props)
    return <div data-testid="trend">{props.byChannel ? "Channel trend" : "Total trend"}</div>
  },
}))
jest.mock("@/app/components/dashboard/sales-distribution-chart", () => ({
  SalesDistributionChart: () => <div data-testid="distribution">Channel distribution</div>,
}))

const site = useSite as jest.Mock
const auth = useAuth as jest.Mock
const widgets = useWidgetContext as jest.Mock
const fetchMock = fetch as jest.Mock
const mockTrendProps = jest.fn()
const startDate = new Date(2025, 1, 1)
const endDate = new Date(2025, 1, 2)
const metric = (actual: number, previous = 0) => ({ actual, previous, percentChange: previous ? (actual - previous) / previous * 100 : actual ? null : 0 })
function report(actual = 20): SalesReportData {
  return {
    totalSales: { ...metric(actual), formattedActual: String(actual), formattedPrevious: "0" },
    transactions: metric(actual === 0 ? 0 : 1), averageOrderValue: metric(actual), currency: "EUR", availableCurrencies: ["EUR"],
    channelSales: { online: { amount: actual, prevAmount: 0, percentChange: null }, retail: { amount: 0, prevAmount: 0, percentChange: 0 }, other: { amount: 0, prevAmount: 0, percentChange: 0 } },
    salesCategories: [{ name: "Services", amount: actual, prevAmount: 0, percentChange: null }],
    salesDistribution: [{ category: "Online", amount: actual, percentage: 100 }],
    monthlyData: [{ month: "2025-02", onlineSales: actual, retailSales: 0, otherSales: 0, totalSales: actual }],
    noData: false, periodType: "custom",
    metadata: { startDate: "2025-02-01", endDate: "2025-02-02", prevStartDate: "2025-01-30", prevEndDate: "2025-01-31", segmentId: "all", basis: "Active sale amounts, not cash collected.", dateBasis: "Inclusive sale dates; cash uses UTC movement dates.", categoriesIncluded: true },
  }
}
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body })
const wrapper = ({ children }: { children: React.ReactNode }) => <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 30_000 }}>{children}</SWRConfig>
const props = { startDate, endDate }

describe("sales report sections and scoped loading", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    site.mockReturnValue({ currentSite: { id: "site-a" } })
    auth.mockReturnValue({ user: { id: "user-a" } })
    widgets.mockReturnValue({ shouldExecuteWidgets: true })
    fetchMock.mockResolvedValue(ok(report()))
  })

  it.each(["summary", "channels", "categories", undefined] as const)("renders only the requested %s section, with legacy all-section support", async (section) => {
    render(<SalesReports {...props} section={section} />, { wrapper })
    await screen.findByText(/equal-length period/)
    expect(Boolean(screen.queryByTestId("distribution"))).toBe(section === undefined || section === "channels")
    expect(Boolean(screen.queryByTestId("trend"))).toBe(section !== "categories")
    expect(Boolean(screen.queryByText("Sales breakdown"))).toBe(section === undefined || section === "categories")
    expect(Boolean(screen.queryByText(/Allocated active sale amounts by category/))).toBe(section === undefined || section === "categories")
    expect(screen.queryByText(/Allocated confirmed/)).not.toBeInTheDocument()
    expect(screen.queryByText(/\+100\.0%/)).not.toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toContain(`includeCategories=${section === undefined || section === "categories"}`)
    expect(fetchMock.mock.calls[0][0]).not.toContain("useDemoData")
  })

  it("separates failure, retry and successful empty data states", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "secret detail" }) })
    render(<SalesReports {...props} section="summary" />, { wrapper })
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load")
    expect(screen.queryByText("No active sales in this period")).not.toBeInTheDocument()
    expect(screen.queryByText(/secret detail/)).not.toBeInTheDocument()
    const empty = report(0)
    empty.noData = true
    fetchMock.mockResolvedValueOnce(ok(empty))
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByText("No active sales in this period")).toBeInTheDocument()
    expect(screen.getByText(/Net collected: Unavailable/)).toBeInTheDocument()
    expect(screen.getByText(/Outstanding balance: Unavailable/)).toBeInTheDocument()
    expect(screen.getByText(/This does not imply zero cash movement/)).toBeVisible()
  })

  it("provides currency selection for mixed data and scopes the next fetch", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ availableCurrencies: ["EUR", "USD"] }) })
    render(<SalesReports {...props} section="summary" />, { wrapper })
    fireEvent.change(await screen.findByLabelText("Sales currency"), { target: { value: "EUR" } })
    await screen.findByText(/Active sales: EUR/)
    expect(fetchMock.mock.calls[1][0]).toContain("currency=EUR")
    expect(screen.queryByText(/Active sales: \$/)).not.toBeInTheDocument()
  })

  it("does not show an old site's delayed response after the scope changes", async () => {
    let resolveOld!: (value: unknown) => void
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve }))
    const view = render(<SalesReports {...props} section="summary" />, { wrapper })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    site.mockReturnValue({ currentSite: { id: "site-b" } })
    fetchMock.mockResolvedValueOnce(ok(report(99)))
    view.rerender(<SalesReports {...props} section="summary" />)
    await screen.findByText(/Active sales: EUR.*99/)
    await act(async () => { resolveOld(ok(report(777))) })
    expect(screen.queryByText(/777/)).not.toBeInTheDocument()
  })

  it("shares summary and channel queries but refetches categories, segment, dates and user scopes", async () => {
    const view = render(<SalesReports {...props} section="summary" />, { wrapper })
    await screen.findByText(/equal-length period/)
    view.rerender(<SalesReports {...props} section="channels" />)
    await screen.findByTestId("distribution")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    view.rerender(<SalesReports {...props} section="categories" />)
    await screen.findByText("Sales breakdown")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    view.rerender(<SalesReports {...props} segmentId="segment-b" section="categories" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    view.rerender(<SalesReports {...props} endDate={new Date(2025, 1, 3)} segmentId="segment-b" section="categories" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4))
    auth.mockReturnValue({ user: { id: "user-b" } })
    view.rerender(<SalesReports {...props} endDate={new Date(2025, 1, 3)} segmentId="segment-b" section="categories" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5))
  })

  it("does not fetch without an authenticated enabled site", () => {
    widgets.mockReturnValue({ shouldExecuteWidgets: false })
    render(<SalesReports {...props} />, { wrapper })
    expect(screen.getByRole("status", { name: "Loading report" })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects malformed responses instead of treating them as zero sales", async () => {
    fetchMock.mockResolvedValue(ok({ error: "unexpected" }))
    await expect(fetchSalesReport(["user-a", "/api/revenue"])).rejects.toThrow("incomplete")
    expect(salesReportUrl("site", new Date("bad"), endDate, "all", "", true)).toBeNull()
  })

  it("renders transport failures without crashing or exposing fetch internals", async () => {
    fetchMock.mockRejectedValue(new TypeError("Internal network detail"))
    render(<SalesReports {...props} section="summary" />, { wrapper })
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to connect")
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })

  it("leads with the adaptive trend, forwards source coverage and collapses detailed caveats", async () => {
    const data = report()
    data.dailyData = [{ date: "2025-02-01", onlineSales: 20, retailSales: 0, otherSales: 0, totalSales: 20 }]
    data.metadata.trendCoverage = { startDate: "2025-02-01", endDate: "2025-02-02", complete: true }
    fetchMock.mockResolvedValueOnce(ok(data))
    render(<SalesReports {...props} section="channels" />, { wrapper })
    const trend = await screen.findByTestId("trend")
    const distribution = screen.getByTestId("distribution")
    expect(trend.compareDocumentPosition(distribution) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(trend.parentElement).toHaveClass("xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")
    expect(trend.parentElement).toHaveClass("items-stretch", "xl:grid-rows-[auto_1fr]", "xl:[&>*]:grid-rows-subgrid")
    expect(mockTrendProps).toHaveBeenLastCalledWith(expect.objectContaining({
      dailyData: data.dailyData, data: data.monthlyData, startDate, endDate, coverage: data.metadata.trendCoverage,
    }))
    expect(screen.getByText(/Online includes online, shop and marketplace/).closest("details")).not.toHaveAttribute("open")
    expect(screen.getByText(/Online includes online, shop and marketplace/)).toHaveTextContent("across 1 sale.")
    expect(screen.getByText(/Online includes online, shop and marketplace/)).not.toHaveTextContent("transactions")
    expect(screen.getByText(/no currency conversion/)).not.toBeVisible()
    expect(screen.getByRole("region", { name: "Sales channels" })).toBeInTheDocument()
  })

  it("uses metadata dates and the legacy monthly fallback when daily rows are absent", async () => {
    render(<SalesReports section="summary" />, { wrapper })
    await screen.findByTestId("trend")
    expect(mockTrendProps).toHaveBeenLastCalledWith(expect.objectContaining({
      dailyData: undefined, data: report().monthlyData, startDate: "2025-02-01", endDate: "2025-02-02", coverage: undefined,
    }))
  })

  it.each(["summary", "channels", "categories"] as const)("uses the page title and date control once when %s is embedded", async section => {
    fetchMock.mockResolvedValueOnce(ok({ ...report(), availableCurrencies: ["EUR", "USD"] }))
    render(<><h1>Sales</h1><button>2025-02-01 – 2025-02-02</button>
      <SalesReports {...props} section={section} embedded /></>, { wrapper })
    await screen.findByRole("combobox", { name: "Sales currency" })
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.queryByRole("heading", { name: /^Sales (summary|channels|categories)$/i })).not.toBeInTheDocument()
    const dateLabels = screen.getAllByText(/2025-02-01.*2025-02-02/)
    expect(dateLabels.filter(element => !element.closest("details"))).toHaveLength(1)
    expect(dateLabels.find(element => element.closest("details"))).not.toBeVisible()
    expect(screen.getByText(/Active sales are pending and completed sale amounts by sale date/)).toBeVisible()
    if (section === "summary") {
      expect(screen.getByText(/Cash received and refunded follow each UTC movement date/)).toBeVisible()
      expect(screen.getByText(/not a historical end-date balance/)).toBeVisible()
    }
    if (section !== "categories") expect(mockTrendProps).toHaveBeenLastCalledWith(expect.objectContaining({ showPeriod: false }))
  })

  it("replaces a stale failure with a skeleton throughout a deferred retry", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    render(<SalesReports {...props} section="summary" />, { wrapper })
    await screen.findByRole("alert")
    let resolve!: (value: unknown) => void
    fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done }))
    fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("status", { name: "Loading report" })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByText("Sales report unavailable")).not.toBeInTheDocument()
    await act(async () => resolve(ok(report())))
    expect(await screen.findByTestId("trend")).toBeInTheDocument()
  })

  it("keeps movement-date cash visible when there are no active sales in the selected period", async () => {
    const empty = report(0)
    empty.noData = true
    empty.financialSummary = {
      receipts: metric(100), refunds: metric(150), netCollected: metric(-50),
      outstanding: { amount: 0, saleCount: 0, unknownSaleCount: 0 },
      paymentStatus: { paid: { count: 0, amount: 0 }, partial: { count: 0, amount: 0 }, unpaid: { count: 0, amount: 0 }, unknown: { count: 0, amount: 0 } },
      excluded: { count: 1, amount: 150 }, cashIssues: 0,
    }
    fetchMock.mockResolvedValueOnce(ok(empty))
    render(<SalesReports {...props} section="summary" embedded />, { wrapper })
    expect(await screen.findByText("No active sales in this period")).toBeVisible()
    expect(screen.getByText(/Net collected: -EUR.*50.00/)).toBeVisible()
    expect(screen.getByText(/Received: EUR.*100.00.*Refunded: EUR.*150.00/)).toBeVisible()
    expect(screen.getByText(/0 sales · Average sale: EUR.*0.00/)).toBeVisible()
    expect(screen.getByText(/including older and cancelled sales/)).toBeVisible()
    expect(screen.queryByText(/Confirmed sales/)).not.toBeInTheDocument()
  })
})