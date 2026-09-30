import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { DashboardPerformanceTab } from "@/app/dashboard/DashboardPerformanceTab"
import { DashboardAnalyticsTab } from "@/app/dashboard/DashboardAnalyticsTab"
import { useDashboardPerformance } from "@/app/hooks/use-dashboard-batches"

jest.mock("next/dynamic", () => () => function Chart() { return <div data-testid="chart" /> })
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/hooks/use-dashboard-batches", () => ({
  useDashboardPerformance: jest.fn(() => ({ error: undefined, mutate: jest.fn() })),
  useDashboardOverview: jest.fn(() => ({ error: undefined, mutate: jest.fn() })),
  usePerformanceSlice: () => ({ data: null, isLoading: false }),
}))
jest.mock("@/app/components/dashboard/base-kpi-widget", () => ({ BaseKpiWidget: ({ title }: { title: string }) => <div data-testid="kpi">{title}</div> }))
jest.mock("@/app/components/dashboard/segment-donut", () => ({ SegmentDonut: ({ endpoint }: { endpoint: string }) => <div data-testid="distribution">{endpoint}</div> }))

const filters = { t: () => "", startDate: new Date("2026-09-01"), endDate: new Date("2026-09-29"), segmentId: "all" }

describe("report panels", () => {
  it("mounts only outcomes widgets and chart", () => {
    render(<DashboardPerformanceTab {...filters} section="outcomes" />)
    expect(screen.getAllByTestId("kpi")).toHaveLength(4)
    expect(screen.getByText("Leads Contacted")).toBeInTheDocument()
    expect(screen.queryByText("Token Usage")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("chart")).toHaveLength(1)
  })

  it("unmounts outcomes when switching to operations or usage", () => {
    const { rerender } = render(<DashboardPerformanceTab {...filters} section="operations" />)
    expect(screen.getAllByTestId("kpi")).toHaveLength(4)
    expect(screen.getByText("Customer Success Metrics")).toBeInTheDocument()
    expect(screen.queryByText("Leads Contacted")).not.toBeInTheDocument()
    rerender(<DashboardPerformanceTab {...filters} section="usage" />)
    expect(screen.getAllByTestId("kpi")).toHaveLength(4)
    expect(screen.getByText("Token Usage")).toBeInTheDocument()
    expect(screen.queryByText("Customer Success Metrics")).not.toBeInTheDocument()
  })

  it("does not render missing batch metrics as zero activity and provides retry", () => {
    const retry = jest.fn()
    jest.mocked(useDashboardPerformance).mockReturnValueOnce({ error: new Error("unavailable"), mutate: retry } as unknown as ReturnType<typeof useDashboardPerformance>)
    render(<DashboardPerformanceTab {...filters} section="outcomes" />)
    expect(screen.getByRole("alert")).toHaveTextContent("Missing metrics are not zero activity")
    expect(screen.queryByTestId("kpi")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("loads distribution and cohorts independently", () => {
    const { rerender } = render(<DashboardAnalyticsTab {...filters} section="distribution" />)
    expect(screen.getAllByTestId("distribution")).toHaveLength(4)
    expect(screen.queryByTestId("chart")).not.toBeInTheDocument()
    rerender(<DashboardAnalyticsTab {...filters} section="customers" />)
    expect(screen.queryByTestId("distribution")).not.toBeInTheDocument()
    expect(screen.getByText("Client Cohort Analysis")).toBeInTheDocument()
    expect(screen.queryByText("Lead Cohort Analysis")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("chart")).toHaveLength(1)
    rerender(<DashboardAnalyticsTab {...filters} section="leads" />)
    expect(screen.getByText("Lead Cohort Analysis")).toBeInTheDocument()
    expect(screen.queryByText("Client Cohort Analysis")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("chart")).toHaveLength(1)
  })

  it.each(["customers", "leads"] as const)("omits the duplicate %s cohort section header when embedded", section => {
    render(<><h1>Analytics</h1><DashboardAnalyticsTab {...filters} section={section} embedded /></>)
    expect(screen.getAllByRole("heading")).toHaveLength(1)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Analytics")
    expect(screen.getByTestId("chart")).toBeInTheDocument()
  })

  it("preserves meaningful distribution chart headings in embedded analytics", () => {
    render(<><h1>Analytics</h1><DashboardAnalyticsTab {...filters} embedded /></>)
    expect(screen.getByRole("heading", { name: "Leads by Segment" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "Recorded Sales by Campaign" })).toBeVisible()
    expect(screen.getAllByTestId("distribution")).toHaveLength(4)
  })
})