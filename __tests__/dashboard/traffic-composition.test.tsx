import { render, screen, within } from "@testing-library/react"
import { SWRConfig } from "swr"
import { TrafficReports } from "@/app/components/dashboard/traffic-reports"
import { SessionEventsContainer } from "@/app/components/dashboard/traffic/session-events-container"
import { useDistributionReport } from "@/app/components/dashboard/use-distribution-report"

jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "user-a" }, isLoading: false }) }))
jest.mock("@/app/context/WidgetContext", () => ({ useWidgetContext: () => ({ shouldExecuteWidgets: true }) }))
jest.mock("@/app/components/dashboard/use-distribution-report", () => ({ useDistributionReport: jest.fn() }))
jest.mock("@/app/components/dashboard/traffic/visits-widget", () => ({ SessionsWidget: () => <div data-testid="kpi">Sessions KPI</div> }))
jest.mock("@/app/components/dashboard/traffic/session-time-widget", () => ({ SessionTimeWidget: () => <div data-testid="kpi">Session time KPI</div> }))
jest.mock("@/app/components/dashboard/traffic/lead-conversion-widget", () => ({ LeadConversionWidget: () => <div data-testid="kpi">Lead KPI</div> }))
jest.mock("@/app/components/dashboard/traffic/client-conversion-widget", () => ({ ClientConversionWidget: () => <div data-testid="kpi">Client KPI</div> }))
jest.mock("@/app/components/dashboard/traffic/session-events-chart", () => ({ SessionEventsChart: () => <div data-testid="session-chart" /> }))
jest.mock("@/app/components/dashboard/traffic/session-events-referrers", () => ({ SessionEventsReferrers: () => <div data-testid="session-referrers" /> }))

const query = useDistributionReport as jest.Mock
const filters = { siteId: "site-a", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-29") }
const splitClass = "xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"

beforeEach(() => {
  query.mockReset().mockReturnValue({ data: [{ name: "Recorded category", value: 4, color: "#2563eb" }], isLoading: false, isValidating: false })
  jest.mocked(fetch).mockImplementation(() => new Promise(() => {}))
})

it("gives acquisition a compact KPI row and dominant pages panel without an empty third column", () => {
  render(<TrafficReports {...filters} section="summary" />)
  expect(screen.getAllByTestId("kpi")).toHaveLength(4)
  expect(screen.getAllByTestId("kpi")[0].parentElement).toHaveClass("grid-cols-2", "xl:grid-cols-4", "min-w-0")
  const section = screen.getByRole("region", { name: "Acquisition breakdown" })
  const grid = section.querySelector(`.grid`)!
  expect(grid).toHaveClass("grid-cols-1", "min-w-0", splitClass)
  expect(grid.children).toHaveLength(2)
  expect(within(section).getAllByRole("table")).toHaveLength(2)
  expect(query.mock.calls.map(([args]) => args.endpoint)).toEqual(["traffic/pages", "traffic/referrals"])
  expect(screen.queryByTestId("session-chart")).not.toBeInTheDocument()
})

it("aligns geography and technology panels without a tall stacked secondary column", () => {
  render(<TrafficReports {...filters} section="audience" />)
  const section = screen.getByRole("region", { name: "Audience profile" })
  expect(section.querySelector(".grid")).toHaveClass("xl:grid-cols-3")
  const techGroup = screen.getByRole("heading", { name: "Device Types" }).closest(".grid")!
  expect(techGroup).toHaveClass("grid-cols-1", "xl:grid-cols-3", "min-w-0")
  expect(within(techGroup as HTMLElement).getByRole("heading", { name: "Browsers" })).toBeInTheDocument()
  expect(screen.getAllByRole("table")).toHaveLength(3)
  expect(screen.queryByTestId("kpi")).not.toBeInTheDocument()
  expect(query.mock.calls.map(([args]) => args.endpoint)).toEqual(["traffic/regions", "traffic/devices", "traffic/browsers"])
})

it("shows pending distribution skeletons before cached errors", () => {
  query.mockReturnValue({ data: undefined, isLoading: false, isValidating: true, error: new Error("Previous error") })
  render(<TrafficReports {...filters} section="summary" />)
  expect(screen.getAllByRole("status")).toHaveLength(2)
  screen.getAllByRole("status").forEach(status => expect(status).toHaveAttribute("aria-busy", "true"))
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it("lets the session chart and referrer table stack naturally on mobile, not inside a fixed-height grid", async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ chartData: [], referrersData: [], totals: { pageVisits: 0, uniqueVisitors: 0 } }) } as Response)
  render(<SWRConfig value={{ provider: () => new Map() }}><SessionEventsContainer {...filters} /></SWRConfig>)
  const grid = (await screen.findByTestId("session-chart")).parentElement!
  expect(grid).toHaveClass("grid-cols-1", "min-w-0", splitClass, "items-stretch")
  expect(grid).not.toHaveClass("h-[500px]")
  expect(screen.getByTestId("session-referrers").parentElement).toBe(grid)
})