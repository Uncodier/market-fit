import React from "react"
import { render, screen } from "@testing-library/react"
import { OverviewEconomics } from "@/app/dashboard/OverviewEconomics"
import { useDashboardOverview } from "@/app/hooks/use-dashboard-batches"

jest.mock("@/app/hooks/use-dashboard-batches", () => ({ useDashboardOverview: jest.fn() }))
jest.mock("recharts", () => {
  const actual = jest.requireActual("recharts")
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
    <div className="recharts-responsive-container" style={{ width: "100%", height: "100%" }}>
      {React.isValidElement(children) && React.cloneElement(children as React.ReactElement<{ width?: number; height?: number }>, { width: 480, height: 240 })}
    </div> }
})

const filters = { startDate: new Date("2026-09-01"), endDate: new Date("2026-09-29"), segmentId: "all" }
const data = {
  ltv: { actual: 240, currency: "USD" },
  cac: { actual: 60, currency: "USD", details: { costSource: "transactions" } },
  cpl: { actual: 12, metadata: { leadsCount: 50 } },
  roi: { actual: 200, details: { totalRevenue: 9000, totalTransactions: 3000 } },
}

beforeEach(() => {
  jest.mocked(useDashboardOverview).mockReturnValue({ data, isLoading: false } as unknown as ReturnType<typeof useDashboardOverview>)
})

it("adds two actual visual comparisons beneath the compact summary, not KPI-only cards", () => {
  const { container } = render(<OverviewEconomics {...filters} />)
  expect(screen.getByRole("img", { name: "Reported customer value and acquisition cost comparison" })).toBeInTheDocument()
  expect(screen.getByRole("img", { name: "Recorded revenue and return cost baseline comparison" })).toBeInTheDocument()
  expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(4)
  expect(screen.getByTestId("economics-analysis")).toHaveClass("min-w-0")
  expect(container.querySelector("details")).not.toHaveAttribute("open")
  expect(screen.getByText("Currency is unspecified by this source; amounts are not converted.", { exact: false })).toBeInTheDocument()
})

it("shows a skeleton before data exists and no default error, zero metrics or chart", () => {
  jest.mocked(useDashboardOverview).mockReturnValue({ data: undefined, isLoading: true } as ReturnType<typeof useDashboardOverview>)
  render(<OverviewEconomics {...filters} />)
  expect(screen.getByRole("status", { name: "Loading report" })).toBeInTheDocument()
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(screen.queryByRole("img")).not.toBeInTheDocument()
})

it("shows actionable empty comparisons without manufacturing chart bars", () => {
  jest.mocked(useDashboardOverview).mockReturnValue({ data: {
    ltv: { actual: 0, noData: true, currency: "USD" }, cac: { actual: -1, noData: true, currency: "USD" },
    cpl: { actual: 0, metadata: { leadsCount: 0 } }, roi: { actual: 100, details: { totalRevenue: 100 } },
  }, isLoading: false } as unknown as ReturnType<typeof useDashboardOverview>)
  render(<OverviewEconomics {...filters} />)
  expect(screen.queryByRole("img")).not.toBeInTheDocument()
  expect(screen.getAllByText("—")).toHaveLength(4)
  expect(screen.getByText(/A return cannot be measured/)).toBeInTheDocument()
})