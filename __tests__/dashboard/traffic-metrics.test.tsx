import type { ComponentType } from "react"
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { SWRConfig } from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useWidgetContext } from "@/app/context/WidgetContext"
import { useAuth } from "@/app/hooks/use-auth"
import { useReportExportResource } from "@/app/dashboard/export/ReportExportScope"
import { SessionsWidget } from "@/app/components/dashboard/traffic/visits-widget"
import { SessionTimeWidget } from "@/app/components/dashboard/traffic/session-time-widget"
import { LeadConversionWidget } from "@/app/components/dashboard/traffic/lead-conversion-widget"
import { ClientConversionWidget } from "@/app/components/dashboard/traffic/client-conversion-widget"
import { useTrafficMetric, type TrafficMetricFilters } from "@/app/components/dashboard/traffic/use-traffic-metric"

jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/context/WidgetContext", () => ({ useWidgetContext: jest.fn() }))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: jest.fn() }))
jest.mock("@/app/dashboard/export/ReportExportScope", () => ({ useReportExportResource: jest.fn() }))

const auth = useAuth as jest.Mock
const site = useSite as jest.Mock
const widgets = useWidgetContext as jest.Mock
const exportResource = jest.mocked(useReportExportResource)
const fetchMock = jest.mocked(fetch)
const defaults: TrafficMetricFilters = {
  segmentId: "segment-a",
  startDate: new Date(2026, 8, 1, 7, 35),
  endDate: new Date(2026, 8, 29, 21, 45),
}
const cases = [
  { Component: SessionsWidget, title: "Sessions", endpoint: "visits", actual: 1234, value: "1,234", zero: "0" },
  { Component: SessionTimeWidget, title: "Average Session Time", endpoint: "session-time", actual: 125, value: "2m 5s", zero: "0s" },
  { Component: LeadConversionWidget, title: "Visitor to Lead", endpoint: "lead-conversion", actual: 12, value: "12.0%", zero: "0.0%" },
  { Component: ClientConversionWidget, title: "Lead to Client", endpoint: "client-conversion", actual: 12.5, value: "12.5%", zero: "0%" },
]
const payload = (actual: number | null = 12, percentChange: number | null = 12.5, periodType = "weekly") => ({ actual, percentChange, periodType })
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response
const valueSlot = (container: HTMLElement) => container.querySelector('[data-kpi-slot="value"]')!
const statusSlot = (container: HTMLElement) => container.querySelector('[data-kpi-slot="status"]')!
const requestUrl = (index = 0) => new URL(String(fetchMock.mock.calls[index][0]), "http://localhost")

function mount(Component: ComponentType<TrafficMetricFilters> = SessionsWidget, initial = defaults) {
  const cache = new Map()
  const view = (filters = initial) => <SWRConfig value={{ provider: () => cache }}><Component {...filters} /></SWRConfig>
  return { ...render(view()), view }
}

function AllMetrics(filters: TrafficMetricFilters) {
  return <>{cases.map(({ Component, endpoint }) => <Component key={endpoint} {...filters} />)}</>
}

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(response(payload()))
  exportResource.mockClear()
  auth.mockReturnValue({ user: { id: "user-a" }, isLoading: false })
  site.mockReturnValue({ currentSite: { id: "site-a" }, isLoading: false })
  widgets.mockReturnValue({ shouldExecuteWidgets: true })
})

it.each(cases)("keeps $title loading without fabricated zero values", ({ Component, title }) => {
  fetchMock.mockImplementation(() => new Promise(() => {}))
  const { container } = mount(Component)
  expect(screen.getByRole("status", { name: `Loading ${title}` })).toHaveAttribute("aria-busy", "true")
  expect(valueSlot(container).textContent).toBe("")
  expect(statusSlot(container).textContent).toBe("")
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(exportResource).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), true)
})

it.each(cases)("loads $title through the resource with exact calendar-day filters", async ({ Component, title, endpoint, actual, value }) => {
  fetchMock.mockResolvedValue(response(payload(actual)))
  const { container, rerender, view } = mount(Component)
  await waitFor(() => expect(valueSlot(container)).toHaveTextContent(value))
  expect(screen.getByRole("button", { name: `About ${title}` })).toBeInTheDocument()
  expect(statusSlot(container)).toHaveTextContent("12.5% from last week")
  expect(requestUrl().pathname).toBe(`/api/traffic/${endpoint}`)
  expect(Object.fromEntries(requestUrl().searchParams)).toEqual({
    siteId: "site-a", segmentId: "segment-a", startDate: "2026-09-01", endDate: "2026-09-29",
  })
  expect(exportResource).toHaveBeenCalledWith([String(fetchMock.mock.calls[0][0]), "user-a"], payload(actual), true)
  rerender(view({ ...defaults, startDate: new Date(2026, 8, 1, 23), endDate: new Date(2026, 8, 29, 1) }))
  await act(async () => {})
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each(cases)("preserves real zero for $title", async ({ Component, zero }) => {
  fetchMock.mockResolvedValue(response(payload(0, 0, "monthly")))
  const { container } = mount(Component)
  await waitFor(() => expect(valueSlot(container).textContent).toBe(zero))
  expect(statusSlot(container)).toHaveTextContent("0% from last month")
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
})

it.each(cases)("shows a retryable error for $title instead of zero", async ({ Component, title, zero }) => {
  fetchMock.mockResolvedValue(response({ error: "private database detail" }, 500))
  const { container } = mount(Component)
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this report")
  expect(valueSlot(container)).toHaveTextContent("—")
  expect(screen.queryByText(/private database detail/)).not.toBeInTheDocument()
  let resolve!: (value: Response) => void
  fetchMock.mockReturnValueOnce(new Promise(done => { resolve = done }))
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(screen.getByRole("status", { name: `Loading ${title}` })).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(valueSlot(container).textContent).toBe("")
  await act(async () => { resolve(response(payload(0, 0))) })
  await waitFor(() => expect(valueSlot(container).textContent).toBe(zero))
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it.each([
  ["daily", "yesterday"], ["weekly", "last week"], ["monthly", "last month"],
  ["quarterly", "last quarter"], ["yearly", "last year"], ["custom", "previous period"],
])("preserves the %s period label and signed numeric comparisons", async (periodType, label) => {
  fetchMock.mockResolvedValue(response(payload(7.5, -2.5, periodType)))
  const { container } = mount(LeadConversionWidget)
  await waitFor(() => expect(valueSlot(container)).toHaveTextContent("7.5%"))
  expect(statusSlot(container)).toHaveTextContent(`-2.5% from ${label}`)
  expect(statusSlot(container)).toHaveTextContent("↓")
})

it.each([
  ["missing metric", { percentChange: 0, periodType: "monthly" }],
  ["missing comparison", { actual: 0, periodType: "monthly" }],
  ["numeric string", { ...payload(), actual: "0" }],
  ["string comparison", { ...payload(), percentChange: "0" }],
  ["negative metric", payload(-1)],
  ["non-finite metric", payload(Infinity)],
  ["non-finite comparison", payload(1, NaN)],
  ["invalid period", { ...payload(), periodType: null }],
  ["empty period", payload(1, 1, " ")],
  ["embedded error", { ...payload(), error: "private database detail" }],
  ["null payload", null],
])("rejects a %s response rather than registering a fabricated result", async (_label, body) => {
  fetchMock.mockResolvedValue(response(body))
  const { container } = mount()
  expect(await screen.findByRole("alert")).toHaveTextContent("invalid response")
  expect(valueSlot(container)).toHaveTextContent("—")
  expect(exportResource).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), true)
})

it.each(cases)("keeps a null $title metric unavailable", async ({ Component }) => {
  fetchMock.mockResolvedValue(response(payload(null, null)))
  const { container } = mount(Component)
  await waitFor(() => expect(statusSlot(container)).toHaveTextContent("Unavailable for the selected period."))
  expect(valueSlot(container)).toHaveTextContent("—")
  expect(statusSlot(container)).not.toHaveTextContent("0%")
  expect(exportResource).toHaveBeenCalledWith(expect.anything(), payload(null, null), true)
})

it.each(cases)("keeps a null $title comparison separate from actual zero", async ({ Component, zero }) => {
  fetchMock.mockResolvedValue(response(payload(0, null)))
  const { container } = mount(Component)
  await waitFor(() => expect(valueSlot(container).textContent).toBe(zero))
  expect(statusSlot(container)).toHaveTextContent("Comparison unavailable.")
  expect(statusSlot(container)).not.toHaveTextContent("0%")
})

it.each([
  [401, "Sign in to view this report."],
  [403, "You do not have access to this report."],
  [429, "Too many report requests."],
])("keeps HTTP %i visible without exposing server details", async (status, message) => {
  fetchMock.mockResolvedValue(response({ error: "private detail" }, status))
  mount()
  expect(await screen.findByRole("alert")).toHaveTextContent(message)
  expect(screen.queryByText("private detail")).not.toBeInTheDocument()
})

it("handles invalid JSON and network failures as retryable errors", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError("invalid JSON") } } as unknown as Response)
  mount()
  expect(await screen.findByRole("alert")).toHaveTextContent("invalid response")
  fetchMock.mockRejectedValueOnce(new Error("private network detail"))
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to load this report"))
  expect(screen.queryByText(/private network detail/)).not.toBeInTheDocument()
})

it.each(["authentication", "site loading", "missing site", "default site", "widget execution"])("waits for %s readiness in all four widgets", async gate => {
  if (gate === "authentication") auth.mockReturnValue({ user: { id: "user-a" }, isLoading: true })
  if (gate === "site loading") site.mockReturnValue({ currentSite: { id: "site-a" }, isLoading: true })
  if (gate === "missing site") site.mockReturnValue({ currentSite: null, isLoading: false })
  if (gate === "default site") site.mockReturnValue({ currentSite: { id: "default" }, isLoading: false })
  if (gate === "widget execution") widgets.mockReturnValue({ shouldExecuteWidgets: false })
  const { rerender, view } = mount(AllMetrics)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.getAllByRole("status")).toHaveLength(4)
  auth.mockReturnValue({ user: { id: "user-a" }, isLoading: false })
  site.mockReturnValue({ currentSite: { id: "site-a" }, isLoading: false })
  widgets.mockReturnValue({ shouldExecuteWidgets: true })
  rerender(view())
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument())
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

it("does not request any metric while signed out and hides data after sign-out", async () => {
  auth.mockReturnValue({ user: null, isLoading: false })
  const { rerender, view, container } = mount(AllMetrics)
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.getAllByRole("alert")).toHaveLength(4)
  expect(screen.getAllByText("Sign in to view this report.")).toHaveLength(4)
  auth.mockReturnValue({ user: { id: "user-a" }, isLoading: false })
  rerender(view())
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument())
  auth.mockReturnValue({ user: null, isLoading: false })
  rerender(view())
  expect(screen.getAllByRole("alert")).toHaveLength(4)
  expect(Array.from(container.querySelectorAll('[data-kpi-slot="value"]')).map(node => node.textContent)).toEqual(["—", "—", "—", "—"])
  expect(fetchMock).toHaveBeenCalledTimes(4)
})

it.each(["account", "site", "segment", "start date", "end date"])("isolates %s changes and hides the old metric while loading", async scope => {
  fetchMock.mockResolvedValue(response(payload(8765)))
  const { container, rerender, view } = mount()
  await waitFor(() => expect(valueSlot(container)).toHaveTextContent("8,765"))
  fetchMock.mockImplementation(() => new Promise(() => {}))
  const next = { ...defaults }
  if (scope === "account") auth.mockReturnValue({ user: { id: "user-b" }, isLoading: false })
  if (scope === "site") site.mockReturnValue({ currentSite: { id: "site-b" }, isLoading: false })
  if (scope === "segment") next.segmentId = "segment-b"
  if (scope === "start date") next.startDate = new Date(2026, 8, 2)
  if (scope === "end date") next.endDate = new Date(2026, 8, 30)
  rerender(view(next))
  expect(screen.getByRole("status", { name: "Loading Sessions" })).toBeInTheDocument()
  expect(valueSlot(container).textContent).toBe("")
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(requestUrl(1).searchParams.has("userId")).toBe(false)
  expect(exportResource.mock.calls.at(-1)?.[2]).toBe(false)
})

it.each([new Date("invalid"), new Date(2026, 9, 1)])("does not fetch an invalid selected range (%s)", startDate => {
  mount(SessionsWidget, { ...defaults, startDate })
  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.getByRole("alert")).toHaveTextContent("Select a valid date range.")
})

it("keeps the local date picker and default range stable without fetching effects", async () => {
  const cache = new Map()
  const { result, rerender } = renderHook(() => useTrafficMetric("visits", {}), {
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>,
  })
  await waitFor(() => expect(result.current.data).toEqual(payload()))
  const start = result.current.startDate
  const end = result.current.endDate
  rerender()
  expect(result.current.startDate).toBe(start)
  expect(result.current.endDate).toBe(end)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  act(() => { result.current.onDateChange(new Date(2026, 0, 2, 20), new Date(2026, 0, 2, 21)) })
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  expect(Object.fromEntries(requestUrl(1).searchParams)).toEqual({
    siteId: "site-a", segmentId: "all", startDate: "2026-01-02", endDate: "2026-01-02",
  })
  await waitFor(() => expect(result.current.isLoading).toBe(false))
})