import React from "react"
import { render, screen, within } from "@testing-library/react"
import { CostReportCategories, CostReportDistribution, CostReportTrend } from "@/app/components/dashboard/cost-report-visuals"

jest.mock("recharts", () => ({
  ...jest.requireActual("recharts"),
  ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
    React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, { width: 600, height: 280 }),
}))

const categories = [
  { name: "Marketing", amount: 250, prevAmount: 0, percentChange: 100 },
  { name: "Operations", amount: 150, prevAmount: 200, percentChange: -25 },
]
const monthly = [{ month: "Sep", fixedCosts: 250, variableCosts: 150 }]
const distribution = [{ category: "Marketing", amount: 250, percentage: 62.5 }]
const ready = { isLoading: false, dataReady: true }

it("uses numeric amounts without dollar labels for an unknown source currency", () => {
  const { container } = render(<>
    <CostReportCategories data={categories} {...ready} />
    <CostReportDistribution data={distribution} {...ready} />
    <CostReportTrend data={monthly} {...ready} />
  </>)
  expect(container.textContent).not.toMatch(/\$|USD/)
  expect(screen.getAllByText(/currency unspecified/)).toHaveLength(3)
  expect(screen.getByLabelText("Monthly cost chart")).toBeInTheDocument()
  expect(container.querySelector(".recharts-bar-rectangle")).toBeInTheDocument()
  expect(screen.getByText("250 · 62.5%")).toBeInTheDocument()
})

it("uses only the currency supplied by the source", () => {
  const { container } = render(<>
    <CostReportCategories data={categories} currency="EUR" {...ready} />
    <CostReportDistribution data={distribution} currency="EUR" {...ready} />
    <CostReportTrend data={monthly} currency="EUR" {...ready} />
  </>)
  expect(container.textContent).not.toContain("$")
  expect(screen.getByRole("cell", { name: "€250.00" })).toBeInTheDocument()
  expect(screen.getByText("€250.00 · 62.5%")).toBeInTheDocument()
  expect(screen.getByLabelText("Monthly cost chart").textContent).toContain("€")
})

it("shows previous-period comparisons without invented growth or a month-only label", () => {
  render(<CostReportCategories data={categories} {...ready} />)
  const first = screen.getByRole("row", { name: /Marketing/ })
  expect(within(first).getByText("No previous baseline")).toBeInTheDocument()
  expect(first).not.toHaveTextContent("100.0%")
  expect(screen.getByRole("row", { name: /Operations/ })).toHaveTextContent("-25.0%")
  expect(screen.getByRole("columnheader", { name: "Period Change" })).toBeInTheDocument()
  expect(screen.queryByText("MoM Change")).not.toBeInTheDocument()
})

it("keeps loading distinct from a successfully empty category report", () => {
  const { rerender } = render(<CostReportCategories data={[]} isLoading dataReady={false} />)
  expect(screen.getByRole("status", { name: "Loading Cost Breakdown" })).toBeInTheDocument()
  expect(screen.queryByText(/No cost categories data/)).not.toBeInTheDocument()
  rerender(<CostReportCategories data={[]} {...ready} />)
  expect(screen.queryByRole("status")).not.toBeInTheDocument()
  expect(screen.getByText("No cost categories data for the selected period.")).toBeInTheDocument()
})

it("labels the API's six-month context honestly for a short cross-year selection", () => {
  const data = [
    { month: "Dec", fixedCosts: 250, variableCosts: 150 },
    { month: "Jan", fixedCosts: 25, variableCosts: 15 },
  ]
  const { rerender } = render(<CostReportTrend data={data} {...ready}
    startDate={new Date(2026, 0, 3)} endDate={new Date(2026, 0, 12)} />)
  expect(screen.getByText(/Aug 1, 2025 – Jan 12, 2026/)).toBeVisible()
  expect(screen.getByText(/Six-month context ending on the selected end date; not the selected-period total/)).toBeVisible()
  expect(screen.getByText("Dec 25")).toBeInTheDocument()
  expect(screen.getByText("Jan 26")).toBeInTheDocument()
  expect(screen.queryByText(/last six months/)).not.toBeInTheDocument()
  expect(screen.getByText(/Changing the selected start date does not change/).closest("details")).not.toHaveAttribute("open")
  expect(screen.getByText(/KPIs, distribution and category totals use the selected range/)).toHaveTextContent("Jan 3, 2026 – Jan 12, 2026")
  rerender(<CostReportTrend data={data} {...ready}
    startDate={new Date(2025, 11, 1)} endDate={new Date(2026, 0, 12)} />)
  expect(screen.getByText(/Aug 1, 2025 – Jan 12, 2026/)).toBeVisible()
  expect(screen.getByText(/KPIs, distribution and category totals use the selected range/)).toHaveTextContent("Dec 1, 2025 – Jan 12, 2026")
})

it("keeps legacy month labels when an anchor is unavailable instead of guessing years", () => {
  render(<CostReportTrend data={monthly} {...ready} />)
  expect(screen.getByText(/Six-month context supplied by the source/)).toBeInTheDocument()
  expect(screen.getByText("Sep")).toBeInTheDocument()
})

it("keeps fixed six-month context explicit in loading, empty and ready chart frames", () => {
  const dates = { startDate: new Date(2026, 0, 3), endDate: new Date(2026, 0, 12) }
  const { rerender } = render(<CostReportTrend {...dates} data={[]} isLoading dataReady={false} />)
  expect(screen.getByRole("status", { name: "Loading Monthly Cost Evolution" })).toHaveClass("h-72", "sm:h-80")
  expect(screen.getByText(/Six-month context ending.*not the selected-period total/)).toBeVisible()
  rerender(<CostReportTrend {...dates} data={[]} {...ready} />)
  expect(screen.getByText(/No monthly cost data/).parentElement).toHaveClass("h-72", "sm:h-80")
  expect(screen.getByText(/Aug 1, 2025 – Jan 12, 2026/)).toBeVisible()
  expect(screen.getByText(/Six-month context ending.*not the selected-period total/)).toBeVisible()
  rerender(<CostReportTrend {...dates} data={monthly} {...ready} />)
  expect(screen.getByLabelText("Monthly cost chart")).toHaveClass("h-72", "sm:h-80")
})

it("aligns distribution plot height only on desktop and lets long category rows grow naturally", () => {
  const longCategory = "A long recorded operating category that must wrap without being cropped"
  render(<CostReportDistribution data={[...distribution, { category: longCategory, amount: 150, percentage: 37.5 }]} {...ready} />)
  const plot = screen.getByLabelText("Cost distribution chart")
  expect(plot).toHaveClass("h-56", "xl:h-80", "min-w-0")
  const card = plot.closest("[data-report-panel]")!
  expect(card).toHaveClass("flex", "h-full", "flex-col")
  const row = screen.getByText(longCategory)
  expect(row).toHaveClass("break-words", "min-w-0")
  expect(row.closest("ul")).not.toHaveClass("overflow-hidden", "max-h-64")
})

it("keeps distinct six-month scope in the intrinsic header before the chart body", () => {
  render(<CostReportTrend data={monthly} {...ready} />)
  const plot = screen.getByLabelText("Monthly cost chart")
  const context = screen.getByText(/Six-month context ending on the selected end date/)
  expect(context.parentElement).toBe(plot.parentElement?.previousElementSibling)
})