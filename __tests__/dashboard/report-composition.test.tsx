import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { DashboardPerformanceTab } from "@/app/dashboard/DashboardPerformanceTab"
import { DashboardAnalyticsTab } from "@/app/dashboard/DashboardAnalyticsTab"
import { ReportDetails, ReportKpiGrid, ReportSection } from "@/app/components/dashboard/report-layout"

jest.mock("next/dynamic", () => () => function Chart({ showConversations }: { showConversations?: boolean }) {
  return <div data-testid="chart" data-conversations={String(showConversations)} />
})
jest.mock("@/app/dashboard/ReportBatchBoundary", () => ({ PerformanceDataBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/hooks/use-dashboard-batches", () => ({ usePerformanceSlice: () => ({ data: null, isLoading: false }) }))
jest.mock("@/app/components/dashboard/base-kpi-widget", () => ({ BaseKpiWidget: ({ title }: { title: string }) => <div data-testid="kpi">{title}</div> }))
jest.mock("@/app/components/dashboard/segment-donut", () => ({ SegmentDonut: ({ endpoint, showTotal, formatValues, variant }: { endpoint: string; showTotal?: boolean; formatValues?: boolean; variant?: string }) => (
  <div data-testid="distribution" data-total={String(showTotal)} data-amount={String(formatValues)} data-variant={variant}>{endpoint}</div>
) }))

const filters = { t: () => "", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-29"), segmentId: "all" }

it("uses a compact, shrink-safe KPI row ahead of the main performance chart", () => {
  render(<DashboardPerformanceTab {...filters} />)
  const grid = screen.getAllByTestId("kpi")[0].parentElement!
  expect(grid).toHaveClass("min-w-0", "grid-cols-2", "xl:grid-cols-4", "gap-3")
  const main = screen.getByRole("region", { name: "Performance Metrics" })
  expect(within(main).getByRole("heading", { level: 2 })).toHaveClass("text-base")
  expect(main).toHaveClass("min-w-0")
  expect(grid.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.getAllByTestId("chart")).toHaveLength(1)
  expect(screen.getByText("Activity definitions").closest("details")).not.toHaveAttribute("open")
  expect(screen.getByText(/Sales count created records across all statuses/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole("switch", { name: "Show Conversations" }))
  expect(screen.getByTestId("chart")).toHaveAttribute("data-conversations", "true")
})

it.each([
  ["operations", "Customer Success Metrics", "Tasks", "Leads Contacted"],
  ["usage", "Token Usage", "Input Tokens", "Tasks"],
] as const)("keeps %s focused on its own four metrics and a single primary chart", (section, title, present, absent) => {
  render(<DashboardPerformanceTab {...filters} section={section} />)
  expect(screen.getByRole("region", { name: title })).toBeInTheDocument()
  expect(screen.getAllByTestId("kpi")).toHaveLength(4)
  expect(screen.getAllByTestId("chart")).toHaveLength(1)
  expect(screen.getByText(present)).toBeInTheDocument()
  expect(screen.queryByText(absent)).not.toBeInTheDocument()
})

it("groups all four attribution measures into two paired comparisons with explicit units", () => {
  render(<DashboardAnalyticsTab {...filters} />)
  for (const dimension of ["Segment", "Campaign"]) {
    const comparison = screen.getByRole("region", { name: `${dimension} comparison` })
    expect(within(comparison).getByRole("heading", { level: 3, name: `Leads by ${dimension}` })).toBeInTheDocument()
    expect(within(comparison).getByRole("heading", { level: 3, name: `Recorded Sales by ${dimension}` })).toBeInTheDocument()
    const distributions = within(comparison).getAllByTestId("distribution")
    expect(distributions).toHaveLength(2)
    expect(distributions[0]).toHaveTextContent(`clients-by-${dimension.toLowerCase()}`)
    expect(distributions[1]).toHaveTextContent(`revenue-by-${dimension.toLowerCase()}`)
    distributions.forEach(chart => expect(chart).toHaveAttribute("data-total", "true"))
    distributions.forEach(chart => expect(chart).toHaveAttribute("data-variant", "compact"))
    expect(distributions[1]).toHaveAttribute("data-amount", "true")
    expect(distributions[0].parentElement?.parentElement).toHaveClass("min-w-0", "grid-cols-1", "lg:grid-cols-2", "divide-y", "lg:divide-x")
  }
  expect(screen.queryByTestId("chart")).not.toBeInTheDocument()
  expect(screen.getByText("Attribution and source definitions").closest("details")).not.toHaveAttribute("open")
  expect(screen.getByText(/Currency is not provided by this source/)).toBeInTheDocument()
})

it("mounts only the selected cohort report without another enclosing card", () => {
  const { rerender } = render(<DashboardAnalyticsTab {...filters} section="customers" />)
  let section = screen.getByRole("region", { name: "Client Cohort Analysis" })
  expect(section).not.toHaveClass("border")
  expect(screen.getByTestId("chart").parentElement).toBe(section)
  expect(screen.queryByTestId("distribution")).not.toBeInTheDocument()
  rerender(<DashboardAnalyticsTab {...filters} section="leads" />)
  section = screen.getByRole("region", { name: "Lead Cohort Analysis" })
  expect(screen.getAllByTestId("chart")).toHaveLength(1)
  expect(screen.getByTestId("chart").parentElement).toBe(section)
  expect(screen.queryByText("Client Cohort Analysis")).not.toBeInTheDocument()
})

it("provides named unboxed sections, optional actions and keyboard-native source disclosures", () => {
  render(<ReportSection title="Comparison" action={<button>Export</button>}>
    <ReportKpiGrid><div>Metric</div></ReportKpiGrid>
    <ReportDetails><p>Source definition</p></ReportDetails>
  </ReportSection>)
  const section = screen.getByRole("region", { name: "Comparison" })
  expect(section).toHaveClass("min-w-0")
  expect(within(section).getByRole("button", { name: "Export" })).toBeInTheDocument()
  expect(screen.getByText("About this report").tagName).toBe("SUMMARY")
  expect(screen.getByText("About this report")).toHaveClass("focus-visible:ring-2")
  expect(section.querySelectorAll("h2")).toHaveLength(1)
})