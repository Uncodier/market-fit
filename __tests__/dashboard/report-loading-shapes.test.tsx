import { render, screen } from "@testing-library/react"
import { ReportLoading, ReportLoadingScope } from "@/app/dashboard/ReportLoading"
import { ReportContent } from "@/app/dashboard/ReportContent"
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { ReportKpiGrid } from "@/app/components/dashboard/report-layout"
import type { ReportId } from "@/app/dashboard/report-sections"
import DashboardLoading from "@/app/dashboard/loading"

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (_loader: unknown, options: { loading: React.ComponentType }) => options.loading,
}))

describe("section-aware report loading", () => {
  it("does not show Performance metrics in the route fallback for other reports", () => {
    const { container } = render(<DashboardLoading />)
    expect(screen.getByRole("status", { name: "Loading report" })).not.toHaveAttribute("data-loading-report")
    expect(container.querySelectorAll("[data-report-kpi], [data-loading-panel]")).toHaveLength(0)
    expect(screen.queryByText("Leads Contacted")).not.toBeInTheDocument()
  })
  it.each<[ReportId, string, number, number, number]>([
    ["performance", "outcomes", 4, 1, 0], ["performance", "operations", 4, 1, 0], ["performance", "usage", 4, 1, 0],
    ["overview", "summary", 4, 1, 0], ["overview", "economics", 4, 2, 0], ["overview", "activity", 0, 2, 0],
    ["sales", "summary", 3, 1, 0], ["sales", "channels", 3, 2, 0], ["sales", "categories", 0, 1, 1],
    ["costs", "summary", 4, 2, 0], ["costs", "categories", 0, 1, 1],
    ["analytics", "distribution", 0, 4, 0], ["analytics", "customers", 0, 2, 2], ["analytics", "leads", 0, 1, 1],
    ["traffic", "summary", 4, 4, 0], ["traffic", "audience", 0, 3, 0], ["traffic", "sessions", 0, 2, 1],
    ["social", "summary", 4, 1, 0], ["social", "networks", 0, 2, 0], ["social", "posts", 0, 1, 1],
  ])("matches %s/%s with %i KPIs and %i panels", (report, section, kpis, panels, tables) => {
    const { container } = render(<ReportLoading report={report} section={section} />)
    expect(container.querySelectorAll("[data-report-kpi]")).toHaveLength(kpis)
    expect(container.querySelectorAll("[data-loading-panel]")).toHaveLength(panels)
    expect(container.querySelectorAll('[data-loading-panel="table"]')).toHaveLength(tables)
    expect(screen.getAllByRole("status")).toHaveLength(1)
    const status = screen.getByRole("status", { name: "Loading report" })
    expect(status).toHaveAttribute("aria-busy", "true")
    expect(status.querySelector(':scope > div')).toHaveAttribute("aria-hidden", "true")
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("shares the actual three-column KPI grid and title/value/status sizing", () => {
    const { container, rerender } = render(<ReportLoading report="sales" section="summary" />)
    const loadingCard = container.querySelector('[data-report-kpi]')!
    const classNames = [loadingCard.className, ...Array.from(loadingCard.querySelectorAll('[data-kpi-slot]')).map(node => node.className)]
    const loadingGrid = loadingCard.parentElement!.className
    rerender(<ReportKpiGrid columns={3}><BaseKpiWidget title="Net collected" value="$4,250" changeText="No previous baseline" isLoading={false} /></ReportKpiGrid>)
    const readyCard = container.querySelector('[data-report-kpi]')!
    expect([readyCard.className, ...Array.from(readyCard.querySelectorAll('[data-kpi-slot]')).map(node => node.className)]).toEqual(classNames)
    expect(readyCard.parentElement!.className).toBe(loadingGrid)
    expect(loadingGrid).toContain("sm:grid-cols-3")
    expect(loadingGrid).toContain("first-child]:col-span-2")
  })

  it("reserves actual responsive sales/economics/session plot dimensions", () => {
    const { container, rerender } = render(<ReportLoading report="sales" section="channels" />)
    expect(container.querySelectorAll('[data-loading-plot]')).toHaveLength(2)
    for (const plot of container.querySelectorAll('[data-loading-plot]')) expect(plot).toHaveClass("h-[300px]", "sm:h-[340px]")
    rerender(<ReportLoading report="overview" section="economics" />)
    for (const plot of container.querySelectorAll('[data-loading-plot]')) expect(plot).toHaveClass("h-56", "sm:h-64")
    rerender(<ReportLoading report="traffic" section="sessions" />)
    expect(container.querySelector('[data-loading-plot]')).toHaveClass("h-[320px]", "sm:h-[360px]")
    expect(container.querySelector('[data-loading-summary]')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-report-kpi]')).toHaveLength(0)
  })

  it("loads financial summary labels without changing channel amount labels", () => {
    const { container, rerender } = render(<ReportLoading report="sales" section="summary" />)
    const titles = () => Array.from(container.querySelectorAll('[data-kpi-slot="title"] h3')).map(node => node.textContent)
    expect(titles()).toEqual(["Net collected", "Active sales", "Outstanding balance"])
    rerender(<ReportLoading report="sales" section="channels" />)
    expect(titles()).toEqual(["Online sales", "Retail sales", "Other / unassigned"])
  })

  it("stacks Traffic technology skeletons above full-width rows without changing other report layouts", () => {
    const { container } = render(<ReportLoading report="traffic" section="audience" />)
    const distributions = container.querySelectorAll('[data-loading-panel="distribution"]')
    expect(distributions).toHaveLength(2)
    for (const panel of distributions) {
      expect(panel.querySelector('[data-loading-plot]')).toBeNull()
      const layout = panel.querySelector('[data-distribution-layout="stacked"]')!
      const plot = layout.querySelector('[data-distribution-plot]')!
      expect(plot).toHaveClass("w-full", "justify-center")
      expect(plot.nextElementSibling).toHaveAttribute("data-distribution-rows")
      expect(plot.nextElementSibling).toHaveClass("flex-1", "w-full")
    }
  })

  it("propagates section changes to bare dynamic callbacks without flashing the default layout", () => {
    const props = { siteId: "site-one", startDate: new Date(2026, 8, 1), endDate: new Date(2026, 8, 29), segmentId: "all", t: (key: string) => key }
    const { container, rerender } = render(<ReportContent report="traffic" section="audience" {...props} />)
    expect(screen.getByRole("status")).toHaveAttribute("data-loading-section", "audience")
    expect(container.querySelectorAll('[data-report-kpi]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-loading-panel]')).toHaveLength(3)
    rerender(<ReportContent report="sales" section="categories" {...props} />)
    expect(screen.getByRole("status")).toHaveAttribute("data-loading-section", "categories")
    expect(container.querySelectorAll('[data-report-kpi]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-loading-panel="table"]')).toHaveLength(1)
  })

  it("uses a neutral route fallback until the report is known and allows explicit selections", () => {
    const { container, rerender } = render(<ReportLoading />)
    expect(screen.getByRole("status")).not.toHaveAttribute("data-loading-report")
    expect(container.querySelectorAll('[data-report-kpi]')).toHaveLength(0)
    expect(container.querySelectorAll('[data-loading-panel]')).toHaveLength(0)
    rerender(<ReportLoadingScope report="sales" section="categories"><ReportLoading report="overview" section="economics" /></ReportLoadingScope>)
    expect(screen.getByRole("status")).toHaveAttribute("data-loading-section", "economics")
    expect(container.querySelectorAll('[data-loading-panel="chart"]')).toHaveLength(2)
  })

  it("does not inherit a same-named section from a different report", () => {
    render(<ReportLoadingScope report="sales" section="categories"><ReportLoading report="costs" /></ReportLoadingScope>)
    expect(screen.getByRole("status")).toHaveAttribute("data-loading-report", "costs")
    expect(screen.getByRole("status")).toHaveAttribute("data-loading-section", "summary")
  })

  it("does not duplicate the activity side panel inside its nested chart boundary", () => {
    const { container } = render(<ReportLoadingScope report="overview" section="activity"><ReportLoading chartOnly /></ReportLoadingScope>)
    expect(container.querySelectorAll('[data-loading-panel]')).toHaveLength(1)
    expect(container.querySelectorAll('[data-report-kpi]')).toHaveLength(0)
  })
})