import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig, type Middleware } from "swr"
import { CostReports } from "@/app/components/dashboard/cost-reports"
import type { CostData } from "@/app/components/dashboard/cost-report-data"

let mockSiteId = "site-1"
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId } }) }))
jest.mock("@/app/components/dashboard/base-kpi-widget", () => ({
  BaseKpiWidget: ({ title, value, changeText, isLoading }: { title: string; value: string; changeText: string; isLoading: boolean }) => (
    <section aria-label={title}><h2>{title}</h2>{isLoading ? <span>Loading {title}</span> : <><span>{value}</span><p>{changeText}</p></>}</section>
  ),
}))
jest.mock("@/app/components/dashboard/cost-report-visuals", () => ({
  CostReportDistribution: () => <div>Cost Distribution</div>,
  CostReportTrend: ({ startDate, endDate }: { startDate: Date; endDate: Date }) => <div data-start={startDate.toISOString()} data-end={endDate.toISOString()}>Cost Trend</div>,
  CostReportCategories: ({ data }: { data: CostData["costCategories"] }) => <div>Cost Breakdown {data.map((row) => row.amount).join(",")}</div>,
}))

const start = new Date("2026-09-01T00:00:00")
const end = new Date("2026-09-20T00:00:00")
const costData = (): CostData => ({
  totalCosts: { actual: 250, previous: 200 },
  costCategories: [{ name: "Marketing", amount: 250, prevAmount: 200, percentChange: 25 }],
  monthlyData: [{ month: "Sep", fixedCosts: 250, variableCosts: 0 }],
  costDistribution: [{ category: "Marketing", amount: 250, percentage: 100 }],
})
const salesData = () => ({ totalSales: { actual: 1000, previous: 400 }, currency: "USD" })
function response(body: unknown, status = 200) {
  return { ok: status === 200, status, json: async () => body } as Response
}
const fetchMock = jest.mocked(fetch)
const maskErrors: Middleware = (next) => (key, fetcher, config) => ({ ...next(key, fetcher, config), error: undefined })
const parentConfig = { keepPreviousData: true, use: [maskErrors] }
function report(section?: "summary" | "categories", date = start, segmentId = "all", campaignId = "all") {
  return <SWRConfig value={parentConfig}><CostReports startDate={date} endDate={end} section={section} segmentId={segmentId} campaignId={campaignId} /></SWRConfig>
}
const costCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/costs?"))
const revenueCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/revenue?"))

beforeEach(() => {
  jest.resetAllMocks()
  mockSiteId = "site-1"
  fetchMock.mockImplementation(async (url) => response(String(url).startsWith("/api/costs?") ? costData() : salesData()))
})

it("fetches costs only for categories, without a forced demo flag", async () => {
  render(report("categories", start, "segment & one", "campaign & one"))
  expect(await screen.findByText("Cost Breakdown 250")).toBeInTheDocument()
  expect(screen.queryByText("Total Costs")).not.toBeInTheDocument()
  expect(screen.queryByText("Cost Distribution")).not.toBeInTheDocument()
  expect(screen.queryByText("Cost Trend")).not.toBeInTheDocument()
  expect(revenueCalls()).toHaveLength(0)
  expect(costCalls()).toHaveLength(1)
  const url = new URL(String(costCalls()[0][0]), "http://localhost")
  expect(url.searchParams.get("segmentId")).toBe("segment & one")
  expect(url.searchParams.get("campaignId")).toBe("campaign & one")
  expect(url.searchParams.has("useDemoData")).toBe(false)
})

it("shows summary without breakdown and shares costs across sections", async () => {
  const { rerender } = render(report("categories"))
  expect(await screen.findByText("Cost Breakdown 250")).toBeInTheDocument()
  rerender(report("summary", new Date(start)))
  expect(await screen.findByText("Unavailable")).toBeInTheDocument()
  expect(screen.getByText("Cost Distribution")).toBeInTheDocument()
  expect(screen.getByText("Cost Trend")).toBeInTheDocument()
  expect(screen.getByLabelText("Total Costs")).toHaveTextContent("250")
  expect(screen.queryByText(/Cost Breakdown/)).not.toBeInTheDocument()
  rerender(report("categories"))
  expect(await screen.findByText("Cost Breakdown 250")).toBeInTheDocument()
  expect(costCalls()).toHaveLength(1)
  expect(revenueCalls()).toHaveLength(1)
})

it("retains the legacy full layout when section is omitted", async () => {
  render(report())
  expect(await screen.findByText("Cost Breakdown 250")).toBeInTheDocument()
  expect(screen.getByText("Cost Distribution")).toBeInTheDocument()
  expect(screen.getByText("Cost Trend")).toBeInTheDocument()
  expect(screen.getByText("Total Costs")).toBeInTheDocument()
  expect(revenueCalls()).toHaveLength(1)
})

it.each([500, 422])("keeps costs on a %s revenue error, shows unavailable ratio, and retries only revenue", async (status) => {
  fetchMock.mockImplementation(async (url) => response(String(url).startsWith("/api/costs?") ? costData() : { error: "Private detail" }, String(url).startsWith("/api/costs?") ? 200 : status))
  render(report("summary"))
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load sales for the efficiency ratio")
  if (status === 422) expect(screen.getByRole("alert")).toHaveTextContent("Sales use multiple currencies")
  expect(screen.getByLabelText("Total Costs")).toHaveTextContent("250")
  expect(screen.getByLabelText("Efficiency Ratio")).toHaveTextContent("Unavailable")
  expect(screen.queryByText("0.0:1")).not.toBeInTheDocument()
  expect(screen.queryByText("Private detail")).not.toBeInTheDocument()
  expect(screen.queryByText("Loading Efficiency Ratio")).not.toBeInTheDocument()
  expect(screen.getByText("Cost Trend")).toBeInTheDocument()
  fetchMock.mockImplementation(async () => response(salesData()))
  fireEvent.click(screen.getByRole("button", { name: "Retry sales data" }))
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
  expect(costCalls()).toHaveLength(1)
  expect(revenueCalls()).toHaveLength(2)
})

it.each(["http", "network", "malformed"])("replaces the %s cost failure with an explicit retry state, not zeros or skeletons", async (kind) => {
  fetchMock.mockImplementationOnce(async () => {
    if (kind === "network") throw new Error("Private detail")
    return response(kind === "malformed" ? {} : { error: "Private detail" }, kind === "http" ? 500 : 200)
  })
  render(report("categories"))
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load cost report")
  expect(screen.queryByText("Private detail")).not.toBeInTheDocument()
  expect(screen.queryByText(/Cost Breakdown/)).not.toBeInTheDocument()
  expect(screen.queryByText("0")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Retry cost report" }))
  expect(await screen.findByText("Cost Breakdown 250")).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(costCalls()).toHaveLength(2)
  expect(revenueCalls()).toHaveLength(0)
})

it.each(["site", "dates", "segment"])("clears old costs immediately on a %s scope change and rejects late old responses", async (scope) => {
  const { rerender } = render(report("categories"))
  expect(await screen.findByText("Cost Breakdown 250")).toBeInTheDocument()
  let resolve!: (value: Response) => void
  fetchMock.mockImplementationOnce(() => new Promise((done) => { resolve = done }))
  if (scope === "site") mockSiteId = "site-2"
  rerender(report("categories", scope === "dates" ? new Date("2026-09-02T00:00:00") : start, scope === "segment" ? "segment-2" : "all"))
  expect(screen.queryByText("Cost Breakdown 250")).not.toBeInTheDocument()
  await act(async () => resolve(response({ error: "Failed in new scope" }, 500)))
  expect(screen.getByRole("alert")).toHaveTextContent("Unable to load cost report")
  expect(screen.queryByText("Cost Breakdown 250")).not.toBeInTheDocument()
})

it("marks unknown currencies and absent baselines unavailable instead of inventing USD and 100% growth", async () => {
  const costs = costData()
  costs.totalCosts.previous = 0
  costs.costCategories[0].prevAmount = 0
  fetchMock.mockImplementation(async (url) => response(String(url).startsWith("/api/costs?") ? costs : salesData()))
  render(report("summary"))
  expect(await screen.findByText("Unavailable")).toBeInTheDocument()
  expect(screen.getByLabelText("Efficiency Ratio")).toHaveTextContent("Matching sales and cost currencies are not established")
  expect(screen.getByLabelText("Total Costs")).toHaveTextContent("No previous baseline")
  expect(screen.getByLabelText("Total Costs")).not.toHaveTextContent("$")
  expect(screen.getByText(/Cost currency is not supplied/)).toBeInTheDocument()
})

it("does not fetch for an invalid date range or missing site", () => {
  const { rerender } = render(report("summary", new Date("invalid")))
  expect(screen.getByRole("alert")).toHaveTextContent("Select a valid date range")
  mockSiteId = "default"
  rerender(report("categories"))
  expect(screen.getByText("Select a site to view cost reports.")).toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

it("selects a cost currency without mixing amounts and resets it for a new site", async () => {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input), "http://localhost")
    if (url.pathname === "/api/revenue") return response(salesData())
    if (!url.searchParams.get("currency")) return response({ availableCurrencies: ["EUR", "USD", "UNSPECIFIED"] }, 422)
    return response({ ...costData(), currency: url.searchParams.get("currency"), availableCurrencies: ["EUR", "USD", "UNSPECIFIED"],
      metadata: { prevStartDate: "2026-08-12", prevEndDate: "2026-08-31", days: 20 } })
  })
  const { rerender } = render(report("categories"))
  expect(await screen.findByText("Choose a cost currency")).toBeInTheDocument()
  expect(screen.queryByText(/Cost Breakdown/)).not.toBeInTheDocument()
  fireEvent.change(screen.getByRole("combobox", { name: "Cost currency" }), { target: { value: "EUR" } })
  expect(await screen.findByText("Cost Breakdown 250")).toBeInTheDocument()
  expect(new URL(String(costCalls()[1][0]), "http://localhost").searchParams.get("currency")).toBe("EUR")
  expect(screen.getByText(/Compared with 2026-08-12 – 2026-08-31/)).toHaveTextContent("20 calendar days")
  expect(revenueCalls()).toHaveLength(0)
  mockSiteId = "site-2"
  rerender(report("categories"))
  expect(await screen.findByText("Choose a cost currency")).toBeInTheDocument()
  expect(new URL(String(costCalls().at(-1)?.[0]), "http://localhost").searchParams.has("currency")).toBe(false)
})

it("uses the selected cost currency for the efficiency numerator", async () => {
  fetchMock.mockImplementation(async input => {
    const url = new URL(String(input), "http://localhost")
    if (!url.searchParams.get("currency")) return response({ availableCurrencies: ["EUR", "USD"] }, 422)
    return response(url.pathname === "/api/costs"
      ? { ...costData(), currency: "EUR", availableCurrencies: ["EUR", "USD"] }
      : { ...salesData(), currency: "EUR" })
  })
  render(report("summary"))
  await screen.findByText("Choose a cost currency")
  fireEvent.change(screen.getByRole("combobox", { name: "Cost currency" }), { target: { value: "EUR" } })
  expect(await screen.findByText("4.0:1")).toBeInTheDocument()
  expect(new URL(String(revenueCalls().at(-1)?.[0]), "http://localhost").searchParams.get("currency")).toBe("EUR")
})

it("puts the date-scoped trend before distribution and breakdown with details below", async () => {
  render(report())
  const trend = await screen.findByText("Cost Trend")
  const distribution = screen.getByText("Cost Distribution")
  const breakdown = screen.getByText("Cost Breakdown 250")
  expect(trend.compareDocumentPosition(distribution) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(distribution.compareDocumentPosition(breakdown) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(trend.parentElement).toHaveClass("xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")
  expect(trend.parentElement).toHaveClass("items-stretch", "xl:grid-rows-[auto_1fr]", "xl:[&>*]:grid-rows-subgrid")
  expect(trend).toHaveAttribute("data-start", start.toISOString())
  expect(trend).toHaveAttribute("data-end", end.toISOString())
  const caveat = screen.getByText(/Cost currency is not supplied/)
  expect(caveat.closest("details")).not.toHaveAttribute("open")
  expect(caveat).not.toBeVisible()
})

it.each(["summary", "categories"] as const)("does not duplicate the page heading or selected dates in embedded cost %s", async section => {
  fetchMock.mockImplementation(async url => response(String(url).startsWith("/api/costs?")
    ? { ...costData(), currency: "USD", availableCurrencies: ["USD", "EUR"] } : salesData()))
  render(<><h1>Costs</h1><button>Sep 1, 2026 – Sep 20, 2026</button>
    <CostReports startDate={start} endDate={end} section={section} embedded /></>)
  expect(await screen.findByRole("combobox", { name: "Cost currency" })).toBeVisible()
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  expect(screen.queryByRole("heading", { name: /^Cost (summary|categories)$/i })).not.toBeInTheDocument()
  expect(screen.getAllByText(/Sep 1, 2026.*Sep 20, 2026/)).toHaveLength(1)
})

it("shows only loading, not stale errors or a currency warning, during a cost retry", async () => {
  fetchMock.mockResolvedValueOnce(response({ error: "Failed" }, 500))
  render(report("categories"))
  await screen.findByRole("alert")
  let resolve!: (response: Response) => void
  fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  fireEvent.click(screen.getByRole("button", { name: "Retry cost report" }))
  expect(await screen.findByRole("status", { name: "Loading report" })).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.queryByText("Choose a cost currency")).not.toBeInTheDocument()
  await act(async () => resolve(response(costData())))
  expect(await screen.findByText("Cost Breakdown 250")).toBeInTheDocument()
})

it("keeps cost charts while showing pending instead of a stale revenue error", async () => {
  fetchMock.mockImplementation(async url => response(String(url).startsWith("/api/costs?") ? costData() : {}, String(url).startsWith("/api/costs?") ? 200 : 500))
  render(report("summary"))
  await screen.findByRole("alert")
  let resolve!: (response: Response) => void
  fetchMock.mockImplementationOnce(() => new Promise(done => { resolve = done }))
  fireEvent.click(screen.getByRole("button", { name: "Retry sales data" }))
  expect(await screen.findByText("Loading Efficiency Ratio")).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.getByText("Cost Trend")).toBeInTheDocument()
  await act(async () => resolve(response(salesData())))
  await waitFor(() => expect(screen.queryByText("Loading Efficiency Ratio")).not.toBeInTheDocument())
})