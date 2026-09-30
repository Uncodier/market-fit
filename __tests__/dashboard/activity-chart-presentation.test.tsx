import React from "react"
import { render, screen } from "@testing-library/react"
import { PerformanceMetricsChart } from "@/app/components/dashboard/performance-metrics-chart"
import { LeadsTasksChart } from "@/app/components/dashboard/leads-tasks-chart"
import { usePerformanceSlice } from "@/app/hooks/use-dashboard-batches"
import { activityDate, compactActivityCount } from "@/app/components/dashboard/activity-chart-format"

const mockChartProps: Record<string, any[]> = {}
jest.mock("recharts", () => {
  const component = (name: string) => function ChartComponent(props: any) {
    mockChartProps[name] = [...(mockChartProps[name] || []), props]
    if (name === "ResponsiveContainer") return <div>{props.children}</div>
    if (name.endsWith("Chart")) return <svg>{props.children}</svg>
    return <g>{props.children}</g>
  }
  return Object.fromEntries(["ResponsiveContainer", "LineChart", "AreaChart", "Line", "Area", "XAxis", "YAxis", "CartesianGrid", "Tooltip", "Legend"].map(name => [name, component(name)]))
})
jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock("@/app/hooks/use-dashboard-batches", () => ({ usePerformanceSlice: jest.fn() }))

const filters = { startDate: new Date("2026-09-01"), endDate: new Date("2026-09-29"), segmentId: "all" }
const sample = { date: "2026-09-01", conversations: 2, engagement: 1, meetings: 0, sales: 1, leadsCreated: 1, tasks: 2 }

beforeEach(() => {
  for (const key of Object.keys(mockChartProps)) delete mockChartProps[key]
  jest.mocked(usePerformanceSlice).mockReturnValue({ data: { chartData: [sample] }, isLoading: false, error: undefined, mutate: jest.fn() })
})

it.each([
  [PerformanceMetricsChart, "Line", "LineChart"],
  [LeadsTasksChart, "Area", "AreaChart"],
] as const)("renders sparse activity without interpolation, animation or lost single-day points", (Chart, series, chart) => {
  render(<Chart {...filters} />)
  expect(screen.getByRole("img")).toHaveClass("min-w-0", "h-[300px]", "sm:h-[360px]")
  expect(mockChartProps[chart][0].data).toEqual([sample])
  for (const props of mockChartProps[series]) {
    expect(props.type).toBe("linear")
    expect(props.dot).toEqual({ r: 3, strokeWidth: 0 })
    expect(props.isAnimationActive).toBe(false)
    expect(props.connectNulls).toBe(false)
  }
  const xAxis = mockChartProps.XAxis[0]
  expect(xAxis.minTickGap).toBe(36)
  expect(xAxis.interval).toBe("preserveStartEnd")
  expect(xAxis.tickFormatter("2026-09-01")).toBe("Sep 1")
  const yAxis = mockChartProps.YAxis[0]
  expect(yAxis.allowDecimals).toBe(false)
  expect(yAxis.domain).toEqual([0, "auto"])
  expect(yAxis.tickFormatter(1000)).toBe("1K")
  expect(mockChartProps.Tooltip[0].labelFormatter("2026-09-01")).toBe("Sep 1, 2026 (UTC)")
})

it("can toggle conversations without altering the original dataset", () => {
  render(<PerformanceMetricsChart {...filters} showConversations />)
  expect(mockChartProps.Line.map(props => props.dataKey)).toEqual(["conversations", "engagement", "meetings", "sales"])
  expect(mockChartProps.LineChart[0].data).toEqual([sample])
})

it("reduces point clutter in long ranges without dropping observations", () => {
  const data = Array.from({ length: 29 }, (_, index) => ({ ...sample, date: `2026-09-${String(index + 1).padStart(2, "0")}` }))
  jest.mocked(usePerformanceSlice).mockReturnValue({ data: { chartData: data }, isLoading: false, error: undefined, mutate: jest.fn() })
  render(<PerformanceMetricsChart {...filters} />)
  expect(mockChartProps.LineChart[0].data).toBe(data)
  expect(mockChartProps.Line.every(props => props.dot === false)).toBe(true)
})

it.each([PerformanceMetricsChart, LeadsTasksChart])("uses structured loading and actionable empty states", Chart => {
  jest.mocked(usePerformanceSlice).mockReturnValue({ data: null, isLoading: true, error: undefined, mutate: jest.fn() })
  const { rerender } = render(<Chart {...filters} />)
  expect(screen.getByRole("status", { name: "Loading chart" })).toHaveAttribute("aria-busy", "true")
  jest.mocked(usePerformanceSlice).mockReturnValue({ data: { chartData: [] }, isLoading: false, error: undefined, mutate: jest.fn() })
  rerender(<Chart {...filters} />)
  expect(screen.getByRole("status")).toHaveTextContent("Try another date range or segment")
  expect(screen.queryByRole("img")).not.toBeInTheDocument()
})

it("formats UTC calendar dates and compact counts consistently", () => {
  expect(activityDate("2026-09-01T00:00:00Z", true)).toBe("Sep 1, 2026")
  expect(activityDate("unknown")).toBe("unknown")
  expect(compactActivityCount(0)).toBe("0")
  expect(compactActivityCount(1500000)).toBe("1.5M")
})