import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { DashboardOverviewTab } from "@/app/dashboard/DashboardOverviewTab"
import { OverviewActivityLayout } from "@/app/dashboard/OverviewActivityLayout"
import { ReportLoading, ReportLoadingScope } from "@/app/dashboard/ReportLoading"
import { RecentActivityLoading } from "@/app/components/dashboard/recent-activity-loading"
import { useDashboardOverview, useDashboardPerformance } from "@/app/hooks/use-dashboard-batches"
import { fetchWithRetry } from "@/app/utils/fetch-with-retry"

jest.mock("next/dynamic", () => () => function Chart({ showConversations }: { showConversations?: boolean }) {
  return <div data-testid="activity-chart" data-conversations={String(showConversations)} />
})
jest.mock("@/app/dashboard/OverviewCurrencyScope", () => ({ OverviewCurrencyScope: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "fixture-site" } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/hooks/use-dashboard-batches", () => ({ useDashboardOverview: jest.fn(), useDashboardPerformance: jest.fn() }))
jest.mock("@/app/utils/fetch-with-retry", () => ({ fetchWithRetry: jest.fn() }))

const filters = { t: () => "", startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 29), segmentId: "all" }
const retry = jest.fn()
const settled = { status: "ready", data: {}, isLoading: false, isValidating: false, error: undefined, mutate: retry }
const activities = Array.from({ length: 6 }, (_, index) => ({
  id: `activity-${index}`, kind: "task", user: { name: `Customer ${index}` }, action: "payment task",
  description: "Completed a purchase.", date: "2026-09-29T12:00:00Z", href: "/sales",
}))
function overview() {
  return <ReportLoadingScope report="overview" section="activity"><DashboardOverviewTab {...filters} section="activity" /></ReportLoadingScope>
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useDashboardOverview).mockReturnValue(settled as ReturnType<typeof useDashboardOverview>)
  jest.mocked(useDashboardPerformance).mockReturnValue(settled as ReturnType<typeof useDashboardPerformance>)
  jest.mocked(fetchWithRetry).mockResolvedValue({ json: async () => ({ activities }) } as Response)
})

it("shares intrinsic desktop tracks but leaves stacked mobile panel heights independent", () => {
  const { container } = render(<OverviewActivityLayout chart={<div>Chart</div>} activity={<div>Activity</div>} />)
  const panels = container.querySelectorAll("[data-report-panel]")
  expect(panels).toHaveLength(2)
  expect(panels[0].parentElement).toHaveClass("grid-cols-1", "items-stretch", "xl:grid-rows-[auto_1fr]", "xl:[&>*]:grid-rows-subgrid")
  expect(panels[0].parentElement).not.toHaveClass("items-start", "auto-rows-fr")
  for (const panel of panels) expect(panel.children[0]).toHaveClass("pb-3")
  expect(container.querySelector("[data-activity-chart-frame]")).toHaveClass("h-[300px]", "sm:h-[360px]", "xl:h-full", "xl:min-h-[360px]")
})

it("uses identical panel shells and chart frames for module loading and ready content", () => {
  const { container, rerender } = render(<ReportLoading report="overview" section="activity" />)
  const structure = () => [...container.querySelectorAll("[data-report-panel]")].map(panel => [
    panel.className, panel.parentElement!.className, ...[...panel.children].map(child => child.className),
  ])
  const loading = structure()
  const frame = container.querySelector("[data-activity-chart-frame]")!.className
  expect(screen.getAllByRole("status")).toHaveLength(1)
  rerender(<OverviewActivityLayout chart={<div>Chart</div>} activity={<div>Activity</div>} />)
  expect(structure()).toEqual(loading)
  expect(container.querySelector("[data-activity-chart-frame]")).toHaveAttribute("class", frame)
})

it("keeps titles, the feed and panel shells mounted across pending, failure and retry", async () => {
  jest.mocked(useDashboardPerformance).mockReturnValue({ ...settled, isLoading: true } as ReturnType<typeof useDashboardPerformance>)
  const { container, rerender } = render(overview())
  const panels = [...container.querySelectorAll("[data-report-panel]")]
  expect(screen.getByRole("status", { name: "Loading chart" })).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "Activity over time" })).toBeInTheDocument()
  await screen.findByText("Customer 5 | payment task")
  jest.mocked(useDashboardPerformance).mockReturnValue({ ...settled, error: new Error("Failure") } as ReturnType<typeof useDashboardPerformance>)
  rerender(overview())
  expect(screen.getByRole("alert")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(retry).toHaveBeenCalledTimes(1)
  jest.mocked(useDashboardPerformance).mockReturnValue({ ...settled, isValidating: true, error: new Error("Failure") } as ReturnType<typeof useDashboardPerformance>)
  rerender(overview())
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.getByRole("status", { name: "Loading chart" })).toBeInTheDocument()
  jest.mocked(useDashboardPerformance).mockReturnValue(settled as ReturnType<typeof useDashboardPerformance>)
  rerender(overview())
  expect([...container.querySelectorAll("[data-report-panel]")]).toEqual(panels)
  expect(screen.getByText("Customer 5 | payment task")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("switch", { name: "Show Conversations" }))
  expect(screen.getByTestId("activity-chart")).toHaveAttribute("data-conversations", "true")
  expect(fetchWithRetry).toHaveBeenCalledTimes(1)
})

it("matches recent-record skeleton row sizing, avatar dimensions and shrink-safe text", async () => {
  const { container, rerender } = render(<RecentActivityLoading />)
  const loadingRows = [...screen.getByRole("status").querySelectorAll(':scope > div')]
  expect(loadingRows).toHaveLength(6)
  for (const row of loadingRows) {
    expect(row).toHaveClass("min-w-0", "gap-4", "p-2")
    expect(row.children[0]).toHaveClass("h-10", "w-10", "shrink-0")
    expect(row.children[1]).toHaveClass("min-w-0", "flex-1")
    expect(row.children[1].children[1]).toHaveClass("text-xs", "leading-relaxed")
  }
  rerender(overview())
  await waitFor(() => expect(screen.getByText("Customer 5 | payment task")).toBeInTheDocument())
  const rows = container.querySelector('[data-report-panel="recent-activity"]')!.children[1].firstElementChild!.children
  expect(rows).toHaveLength(6)
  for (const row of rows) {
    expect(row).toHaveClass("min-w-0", "gap-4", "p-2")
    expect(row).not.toHaveClass("-m-2")
    expect(row.children[1]).toHaveClass("min-w-0", "flex-1")
    expect(row.children[2]).toHaveClass("shrink-0", "whitespace-nowrap")
  }
})