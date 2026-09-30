import React from "react"
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MonthlySalesEvolutionChart } from "@/app/components/dashboard/monthly-sales-evolution-chart"
import { OverviewSalesTrend } from "@/app/dashboard/OverviewSalesTrend"
import { useOverviewSlice } from "@/app/hooks/use-dashboard-batches"

jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock("@/app/hooks/use-dashboard-batches", () => ({ useOverviewSlice: jest.fn() }))

// Keep real Recharts at a mobile viewport; jsdom does not measure parent layout.
jest.mock("recharts", () => ({
  ...jest.requireActual("recharts"),
  ResponsiveContainer: ({ children }: { children: React.ReactElement<{ width: number; height: number }> }) =>
    React.cloneElement(children, { width: 360, height: 300 }),
}))

const startDate = "2020-06-01"
const endDate = "2020-06-30"
const coverage = { startDate, endDate, complete: true }
const dailyData = [{ date: "2020-06-07", onlineSales: 100, retailSales: 20, otherSales: 30, totalSales: 150 }]
const props = { data: [], dailyData, startDate, endDate, coverage, isLoading: false, dataReady: true, currency: "EUR" }

describe("sales trend presentation", () => {
  it("renders a real adaptive daily chart with sparse mobile ticks and all channel amounts", () => {
    const { container } = render(<MonthlySalesEvolutionChart {...props} />)
    expect(screen.getByText("Jun 1, 2020 – Jun 30, 2020")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: /Sales trend by channel, daily totals/ })).toBeInTheDocument()
    expect(screen.getByText("daily totals")).toBeInTheDocument()
    expect(screen.getByLabelText("Chart legend")).toHaveTextContent("OnlineRetailOther / unassigned")
    expect(container.querySelectorAll(".recharts-bar-rectangle").length).toBeGreaterThan(0)
    const ticks = container.querySelectorAll(".recharts-xAxis .recharts-cartesian-axis-tick")
    expect(ticks.length).toBeGreaterThanOrEqual(2)
    expect(ticks.length).toBeLessThan(8)
    expect(ticks[0]).toHaveTextContent("Jun 1")
    expect(ticks[ticks.length - 1]).toHaveTextContent("Jun 30")
  })

  it("keeps the selected period visible while loading and never flashes an empty state", () => {
    const { rerender } = render(<MonthlySalesEvolutionChart {...props} dailyData={undefined} isLoading dataReady={false} />)
    expect(screen.getByRole("status", { name: "Loading sales trend" })).toBeInTheDocument()
    expect(screen.getByText("Jun 1, 2020 – Jun 30, 2020")).toBeInTheDocument()
    expect(screen.queryByText("Sales trend unavailable")).not.toBeInTheDocument()
    rerender(<MonthlySalesEvolutionChart {...props} dataReady={false} />)
    expect(screen.getByRole("status", { name: "Loading sales trend" })).toBeInTheDocument()
  })

  it("omits repeated selected dates when embedded but keeps the chart heading and accessible bounds", () => {
    render(<><h1>Sales</h1><button>Jun 1, 2020 – Jun 30, 2020</button>
      <MonthlySalesEvolutionChart {...props} byChannel={false} showPeriod={false} /></>)
    expect(screen.getAllByText("Jun 1, 2020 – Jun 30, 2020")).toHaveLength(1)
    expect(screen.getByRole("heading", { name: "Sales trend" })).toBeInTheDocument()
    expect(screen.getByLabelText("Chart legend")).toHaveTextContent("Active sales")
    expect(screen.queryByText(/Confirmed sales/)).not.toBeInTheDocument()
    expect(screen.getByText(/Active sale amounts by day \(sale date\), not cash collected/)).toBeVisible()
    expect(screen.getByRole("img", { name: /Jun 1, 2020 – Jun 30, 2020/ })).toBeInTheDocument()
  })

  it("reserves the same fixed responsive chart area for loading, empty and ready states", () => {
    const { rerender } = render(<MonthlySalesEvolutionChart {...props} showPeriod={false} isLoading />)
    const frame = screen.getByRole("status", { name: "Loading sales trend" })
    expect(frame).toHaveClass("h-[300px]", "sm:h-[340px]", "w-full", "min-w-0")
    expect(screen.queryByText("Jun 1, 2020 – Jun 30, 2020")).not.toBeInTheDocument()
    rerender(<MonthlySalesEvolutionChart {...props} showPeriod={false} dailyData={[]} />)
    expect(screen.getByRole("status", { name: /Sales trend by channel/ })).toBe(frame)
    const emptyTitle = screen.getByText("No active sales amount in this period")
    expect(emptyTitle.closest(".min-h-0")).toBeInTheDocument()
    rerender(<MonthlySalesEvolutionChart {...props} showPeriod={false} />)
    expect(screen.getByRole("img", { name: /Sales trend by channel/ })).toBe(frame)
  })

  it("distinguishes known zero amounts from unavailable daily coverage", () => {
    const { rerender } = render(<MonthlySalesEvolutionChart {...props} dailyData={[]} />)
    expect(screen.getByText("No active sales amount in this period")).toBeInTheDocument()
    expect(screen.getByText(/does not imply zero cash movement/)).toBeVisible()
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    rerender(<MonthlySalesEvolutionChart {...props} dailyData={[]} coverage={undefined} />)
    expect(screen.getByText("Sales trend unavailable")).toBeInTheDocument()
    expect(screen.getByText(/Missing data is not zero sales/)).toBeInTheDocument()
  })

  it("discloses legacy monthly-only detail and keeps total-only callers working without totalSales", () => {
    const { container } = render(<MonthlySalesEvolutionChart data={[{ month: "2019-12", onlineSales: 10, retailSales: 20 }]}
      startDate="2019-12-10" endDate="2019-12-20" currency="USD" isLoading={false} dataReady byChannel={false} />)
    expect(screen.getByText(/Monthly data only; daily detail is unavailable/)).toBeInTheDocument()
    expect(screen.getByText("Dec 10, 2019 – Dec 20, 2019")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: /Sales trend, monthly totals/ })).toBeInTheDocument()
    expect(container.querySelector(".recharts-bar-rectangle")).toBeInTheDocument()
  })

  it("marks missing data in the chart rather than connecting or implying zero totals", () => {
    render(<MonthlySalesEvolutionChart {...props} coverage={undefined} byChannel={false} />)
    expect(screen.getByRole("img", { name: /Incomplete data; gaps are unavailable/ })).toBeInTheDocument()
    expect(screen.getByText(/Gaps are unavailable, not zero/)).toBeInTheDocument()
  })

  it("shows the complete clipped range and currency amounts in a weekly tooltip", async () => {
    const { container } = render(<MonthlySalesEvolutionChart {...props} startDate="2020-06-01" endDate="2020-07-20"
      coverage={{ startDate: "2020-06-01", endDate: "2020-07-20", complete: true }} />)
    const chart = container.querySelector(".recharts-wrapper")!
    Object.defineProperty(chart, "offsetWidth", { value: 360 })
    Object.defineProperty(chart, "offsetHeight", { value: 300 })
    jest.spyOn(chart, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 360, bottom: 300, width: 360, height: 300, toJSON: () => ({}) })
    const event = createEvent.mouseMove(chart, { clientX: 90, clientY: 100 })
    Object.defineProperties(event, { pageX: { value: 90 }, pageY: { value: 100 } })
    fireEvent(chart, event)
    expect(screen.getByText("weekly totals")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText("Jun 1, 2020 – Jun 7, 2020")).toBeInTheDocument())
    expect(screen.getByText(/EUR.*150.00/)).toBeInTheDocument()
  })
})

describe("OverviewSalesTrend integration", () => {
  it("shares the revenue payload and passes selected bounds/daily coverage without a second fetch", () => {
    jest.mocked(useOverviewSlice).mockReturnValue({ data: { dailyData, monthlyData: [], currency: "EUR", metadata: { trendCoverage: coverage } },
      isLoading: false, error: undefined, mutate: jest.fn() } as ReturnType<typeof useOverviewSlice>)
    const start = new Date(2020, 5, 1)
    const end = new Date(2020, 5, 30)
    render(<OverviewSalesTrend startDate={start} endDate={end} segmentId="segment-a" />)
    expect(useOverviewSlice).toHaveBeenCalledWith("revenue", start, end, "segment-a")
    expect(screen.getByRole("img", { name: /Sales trend, daily totals. Jun 1, 2020 – Jun 30, 2020/ })).toBeInTheDocument()
  })
})