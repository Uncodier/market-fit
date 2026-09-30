import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { TrafficReports, type TrafficSection } from "@/app/components/dashboard/traffic-reports"
import { useAuth } from "@/app/hooks/use-auth"

jest.mock("@/app/hooks/use-auth", () => ({ useAuth: jest.fn() }))
jest.mock("@/app/context/WidgetContext", () => ({ useWidgetContext: () => ({ shouldExecuteWidgets: true }) }))
jest.mock("@/app/components/dashboard/traffic/visits-widget", () => ({ SessionsWidget: () => <div>Sessions KPI</div> }))
jest.mock("@/app/components/dashboard/traffic/session-time-widget", () => ({ SessionTimeWidget: () => <div>Session time KPI</div> }))
jest.mock("@/app/components/dashboard/traffic/lead-conversion-widget", () => ({ LeadConversionWidget: () => <div>Lead KPI</div> }))
jest.mock("@/app/components/dashboard/traffic/client-conversion-widget", () => ({ ClientConversionWidget: () => <div>Client KPI</div> }))
jest.mock("@/app/components/dashboard/traffic/session-events-container", () => ({ SessionEventsContainer: () => <div>Session events</div> }))

const auth = useAuth as jest.Mock
const fetchMock = global.fetch as jest.Mock
const defaults = { siteId: "site-a", startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 29) }
const response = (name = "Traffic", value = 3) => ({ ok: true, json: async () => ({ data: [{ name, value }] }) })
const paths = () => fetchMock.mock.calls.map(([url]) => new URL(url, "http://localhost").pathname).sort()

function mount(section?: TrafficSection) {
  const cache = new Map()
  const view = (props = {}) => <SWRConfig value={{ provider: () => cache }}><TrafficReports {...defaults} section={section} {...props} /></SWRConfig>
  return { ...render(view()), view }
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(response())
  auth.mockReturnValue({ user: { id: "user-a" }, isLoading: false })
})

it.each([
  ["summary", ["pages", "referrals"], true, false],
  ["audience", ["browsers", "regions", "devices"], false, false],
  ["sessions", [], false, true],
  [undefined, ["pages", "referrals", "browsers", "regions", "devices"], true, true],
] as const)("loads only the visible %s queries without a waterfall", async (section, endpoints, kpis, sessions) => {
  fetchMock.mockImplementation(() => new Promise(() => {}))
  mount(section)
  await waitFor(() => expect(paths()).toEqual(endpoints.map(endpoint => `/api/traffic/${endpoint}`).sort()))
  expect(Boolean(screen.queryByText("Sessions KPI"))).toBe(kpis)
  expect(Boolean(screen.queryByText("Session events"))).toBe(sessions)
  expect(Boolean(screen.queryByText("Referral Sources"))).toBe(kpis)
})

it("reuses results across sections and separates site, segment, date and account keys", async () => {
  const { rerender, view } = mount("summary")
  await screen.findAllByRole("table")
  expect(fetchMock).toHaveBeenCalledTimes(2)
  const initial = new URL(fetchMock.mock.calls[0][0], "http://localhost")
  expect(initial.searchParams.has("userId")).toBe(false)
  expect(initial.searchParams.has("useDemoData")).toBe(false)
  expect(new Date(initial.searchParams.get("endDate")!).getHours()).toBe(23)
  rerender(view({ section: "audience" }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5))
  rerender(view({ section: "summary", startDate: new Date(2026, 8, 1, 16) }))
  await screen.findAllByRole("table")
  expect(fetchMock).toHaveBeenCalledTimes(5)
  for (const props of [{ siteId: "site-b" }, { segmentId: "segment-b" }, { endDate: new Date(2026, 8, 28) }]) {
    const previous = fetchMock.mock.calls.length
    rerender(view(props))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(previous + 2))
  }
  auth.mockReturnValue({ user: { id: "user-b" }, isLoading: false })
  rerender(view())
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(13))
})

it("shows independent errors with retry rather than empty data", async () => {
  fetchMock.mockImplementation((url: string) => Promise.resolve(url.includes("/pages?")
    ? { ok: false, status: 500, json: async () => ({ error: "private database detail" }) }
    : response("Referrer", 7)))
  mount("summary")
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this report")
  expect(await screen.findByText("Referrer")).toBeInTheDocument()
  expect(screen.queryByText(/No data/)).not.toBeInTheDocument()
  expect(screen.queryByText(/private database detail/)).not.toBeInTheDocument()
  fetchMock.mockResolvedValue(response("Recovered page"))
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(await screen.findByText("Recovered page")).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(3)
})

it("does not expose stale data while a new filter is loading or after sign-out", async () => {
  const { rerender, view } = mount("summary")
  await screen.findAllByText("Traffic")
  fetchMock.mockImplementation(() => new Promise(() => {}))
  rerender(view({ siteId: "site-b" }))
  expect(screen.queryByText("Traffic")).not.toBeInTheDocument()
  auth.mockReturnValue({ user: null, isLoading: false })
  rerender(view())
  expect(screen.getByRole("alert")).toHaveTextContent("Sign in")
  await act(async () => {})
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

it("waits for authentication before mounting any report queries", () => {
  auth.mockReturnValue({ user: { id: "user-a" }, isLoading: true })
  mount("summary")
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.queryByText("Sessions KPI")).not.toBeInTheDocument()
})

it.each(["summary", "audience", "sessions"] as const)("removes the redundant embedded %s section label without removing chart titles", async section => {
  const cache = new Map()
  render(<SWRConfig value={{ provider: () => cache }}><h1>Traffic</h1><button>Sep 1, 2026 – Sep 29, 2026</button>
    <TrafficReports {...defaults} section={section} embedded /></SWRConfig>)
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
  expect(screen.queryByRole("heading", { name: /Acquisition breakdown|Audience profile|Session activity/ })).not.toBeInTheDocument()
  expect(screen.getAllByText(/Sep 1, 2026.*Sep 29, 2026/)).toHaveLength(1)
  if (section === "summary") expect(await screen.findByRole("heading", { name: "Top Visited Pages" })).toBeVisible()
  if (section === "audience") {
    expect(await screen.findByRole("heading", { name: "Geographic Regions" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "Device Types" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "Browsers" })).toBeVisible()
  }
  await act(async () => {})
})

it("aligns audience card headers and stretches desktop cards without fixed card heights", async () => {
  const { container } = mount("audience")
  await screen.findAllByRole("table")
  const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-report-panel]"))
  expect(cards).toHaveLength(3)
  expect(cards[0].parentElement).toHaveClass("items-stretch", "xl:grid-cols-3", "xl:grid-rows-[auto_1fr]", "xl:[&>*]:grid-rows-subgrid")
  cards.forEach(card => {
    expect(card).toHaveClass("flex", "h-full", "min-w-0", "flex-col")
    expect(card.lastElementChild).toHaveClass("flex-1", "min-w-0")
    expect(card.className).not.toMatch(/h-\[|min-h-|max-h-|overflow-hidden/)
  })
})