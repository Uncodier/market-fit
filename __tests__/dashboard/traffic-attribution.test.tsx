import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { SWRConfig } from "swr"
import { TrafficAttribution } from "@/app/components/dashboard/traffic/traffic-attribution"
import { parseTrafficAttribution } from "@/app/components/dashboard/traffic/attribution-data"
import { attributionFixture, attributionResponse } from "./traffic-attribution-fixture"

const fetchMock = global.fetch as jest.Mock
const props = {
  siteId: "site-a", userId: "user-a", segmentId: "all",
  period: { startDate: new Date("2026-09-01T00:00:00Z"), endDate: new Date("2026-09-30T23:59:59.999Z") },
}

function mount() {
  const cache = new Map()
  const view = (overrides = {}) => <SWRConfig value={{ provider: () => cache }}><TrafficAttribution {...props} {...overrides} /></SWRConfig>
  return { ...render(view()), view }
}

beforeEach(() => fetchMock.mockReset().mockResolvedValue(attributionResponse()))

it("renders both donuts with a full-session denominator and explicit missing attribution", async () => {
  const { container } = mount()
  const segmentTable = await screen.findByRole("table", { name: /Sessions by Segment: share of all sessions/ })
  const campaignTable = screen.getByRole("table", { name: /Sessions by Campaign: share of all sessions/ })
  expect(within(segmentTable).getByRole("row", { name: /Growth teams 2 50.0%/ })).toBeInTheDocument()
  expect(within(segmentTable).getByRole("row", { name: /Unassigned segment 2 50.0%/ })).toBeInTheDocument()
  expect(within(campaignTable).getByRole("row", { name: /No campaign 1 25.0%/ })).toBeInTheDocument()
  expect(within(campaignTable).getByRole("row", { name: /Total sessions 4 100.0%/ })).toBeInTheDocument()
  expect(container.querySelectorAll('[data-distribution-layout="stacked"] svg circle')).toHaveLength(4)
  expect(container.querySelectorAll('[data-distribution-layout="stacked"]')).toHaveLength(2)
  expect(screen.getByLabelText("Attribution coverage")).toHaveTextContent("Identifiable source75.0%3 of 4 sessions")
  expect(screen.getByText(/1 of 4 sessions have no identifiable external source/)).toBeInTheDocument()
  expect(screen.getByText(/not historical membership/)).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const url = new URL(fetchMock.mock.calls[0][0], "http://localhost")
  expect(url.searchParams.get("siteId")).toBe("site-a")
  expect(url.searchParams.has("userId")).toBe(false)
})

it("uses the shared responsive KPI cards for coverage values and session counts", async () => {
  mount()
  const coverage = await screen.findByLabelText("Attribution coverage")
  expect(coverage).toHaveClass("grid-cols-2", "xl:grid-cols-4", "gap-3", "max-[359px]:grid-cols-1")
  expect(coverage).not.toHaveClass("bg-muted/20", "border", "p-4")
  const cards = coverage.querySelectorAll(":scope > [data-report-kpi]")
  expect(cards).toHaveLength(4)

  const metrics = [
    ["Sessions analyzed", "4", "Selected period"],
    ["Identifiable source", "75.0%", "3 of 4 sessions"],
    ["Assigned segment", "50.0%", "2 of 4 sessions"],
    ["Tagged campaign", "75.0%", "3 of 4 sessions"],
  ]
  metrics.forEach(([title, value, description], index) => {
    const card = cards[index] as HTMLElement
    expect(card).toHaveClass("rounded-lg", "border", "bg-card", "shadow-sm", "min-w-0")
    expect(within(card).getByRole("heading", { name: title })).toHaveClass("text-sm", "font-medium")
    expect(within(card).getByRole("button", { name: `About ${title}` })).toBeInTheDocument()
    expect(card.querySelector('[data-kpi-slot="value"]')).toHaveTextContent(value)
    expect(card.querySelector('[data-kpi-slot="value"]')).toHaveClass("text-xl", "sm:text-2xl", "font-bold", "tabular-nums")
    expect(card.querySelector('[data-kpi-slot="status"]')).toHaveTextContent(description)
  })
  expect(within(coverage).queryByText(/from last|previous period|[↑↓→]/)).not.toBeInTheDocument()
})

it("keeps unassigned-only traffic visible rather than reporting an empty chart", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({
    model: "session_entry", segments: [{ name: "Unassigned segment", value: 4 }], campaigns: [{ name: "No campaign", value: 4 }],
    coverage: { totalSessions: 4, attributedSessions: 0, unattributedSessions: 4, segmentedSessions: 0, campaignSessions: 0 },
  }) })
  mount()
  expect(await screen.findByText("Unassigned segment")).toBeInTheDocument()
  expect(screen.getByText("No campaign")).toBeInTheDocument()
  expect(screen.getAllByText("100.0%")).toHaveLength(4)
  const coverage = screen.getByLabelText("Attribution coverage")
  expect(within(coverage).getAllByText("0.0%")).toHaveLength(3)
  expect(within(coverage).getAllByText("0 of 4 sessions")).toHaveLength(3)
})

it("shows a real empty state only when no sessions were recorded", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({
    model: "session_entry", segments: [], campaigns: [],
    coverage: { totalSessions: 0, attributedSessions: 0, unattributedSessions: 0, segmentedSessions: 0, campaignSessions: 0 },
  }) })
  mount()
  expect(await screen.findByText("No sessions for the selected period.")).toBeInTheDocument()
  expect(screen.queryByRole("table")).not.toBeInTheDocument()
  expect(screen.queryByLabelText("Attribution coverage")).not.toBeInTheDocument()
})

it("shows loading panels, sanitizes errors, and retries the one shared request", async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "private database detail" }) })
  mount()
  expect(screen.queryByLabelText("Attribution coverage")).not.toBeInTheDocument()
  expect(screen.getAllByRole("status")).toHaveLength(2)
  for (const panel of screen.getAllByRole("status")) {
    expect(panel.querySelector('[data-distribution-layout="stacked"]')).toBeInTheDocument()
  }
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this report")
  expect(screen.queryByLabelText("Attribution coverage")).not.toBeInTheDocument()
  expect(screen.queryByText(/private database/)).not.toBeInTheDocument()
  fetchMock.mockResolvedValue(attributionResponse())
  fireEvent.click(screen.getByRole("button", { name: "Retry" }))
  expect(await screen.findByText("Growth teams")).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("does not leak old-site or old-account attribution while loading new scope", async () => {
  const { rerender, view } = mount()
  await screen.findByText("Growth teams")
  fetchMock.mockImplementation(() => new Promise(() => {}))
  rerender(view({ siteId: "site-b" }))
  expect(screen.queryByText("Growth teams")).not.toBeInTheDocument()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  rerender(view({ userId: "user-b" }))
  expect(screen.queryByText("Growth teams")).not.toBeInTheDocument()
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
})

describe("attribution response validation", () => {
  it("validates full totals and applies shared chart colors", () => {
    expect(parseTrafficAttribution(attributionFixture).segments[0]).toEqual({ name: "Growth teams", value: 2, color: expect.any(String) })
  })

  it.each([
    null,
    { ...attributionFixture, model: "guessed" },
    { ...attributionFixture, coverage: null },
    { ...attributionFixture, segments: [{ name: "Truncated", value: 2 }] },
    { ...attributionFixture, campaigns: [{ name: "Fraction", value: 3.5 }, { name: "Other", value: 0.5 }] },
    { ...attributionFixture, coverage: { ...attributionFixture.coverage, attributedSessions: 4 } },
    { ...attributionFixture, coverage: { ...attributionFixture.coverage, segmentedSessions: 5 } },
    { ...attributionFixture, coverage: { ...attributionFixture.coverage, campaignSessions: -1 } },
  ])("rejects invalid or partial data instead of inflating percentages (%#)", payload => {
    expect(() => parseTrafficAttribution(payload)).toThrow(/invalid response/)
  })
})