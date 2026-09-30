import React from "react"
import { render, screen } from "@testing-library/react"
import { SalesDistributionChart } from "@/app/components/dashboard/sales-distribution-chart"

jest.mock("@/app/context/ThemeContext", () => ({ useTheme: () => ({ isDarkMode: false }) }))
jest.mock("recharts", () => ({
  ...jest.requireActual("recharts"),
  ResponsiveContainer: ({ children }: { children: React.ReactElement }) =>
    React.cloneElement(children as React.ReactElement<{ width: number; height: number }>, { width: 360, height: 340 }),
}))

const data = [
  { category: "Online", amount: 80, percentage: 80 },
  { category: "Retail", amount: 20, percentage: 20 },
]
const ready = { data, currency: "EUR", isLoading: false, dataReady: true }

it("shares the trend plot height in every state without nested empty card height or entrance animation", () => {
  const { container, rerender } = render(<SalesDistributionChart {...ready} isLoading />)
  const frame = screen.getByRole("status", { name: "Loading sales distribution" })
  expect(frame).toHaveClass("h-[300px]", "sm:h-[340px]", "w-full", "min-w-0")
  expect(frame.closest("[data-report-panel]")).toHaveClass("h-full", "flex", "flex-col")
  expect(screen.getByRole("heading", { name: "Sales Distribution" })).toHaveClass("text-base")
  rerender(<SalesDistributionChart {...ready} dataReady={false} />)
  expect(screen.getByRole("status", { name: "Loading sales distribution" })).toBe(frame)
  expect(screen.queryByText("No sales distribution data")).not.toBeInTheDocument()
  rerender(<SalesDistributionChart {...ready} data={[]} />)
  expect(screen.getByRole("status", { name: "Sales distribution by channel" })).toBe(frame)
  expect(screen.getByText("No sales distribution data").closest(".min-h-0")).toBeInTheDocument()
  rerender(<SalesDistributionChart {...ready} />)
  expect(screen.getByRole("img", { name: "Sales distribution by channel" })).toBe(frame)
  expect(container.querySelector(".recharts-pie-sector")).toBeInTheDocument()
  expect(container.querySelector("style")).not.toBeInTheDocument()
})

it("keeps a wrapping legend outside the fixed plot so long labels are not cropped", () => {
  const category = "An unusually long channel label that should remain readable on small screens"
  render(<SalesDistributionChart {...ready} data={[...data, { category, amount: 0, percentage: 0 }]} />)
  const legend = screen.getByRole("list", { name: "Sales distribution legend" })
  const frame = screen.getByRole("img", { name: "Sales distribution by channel" })
  expect(legend).toHaveClass("flex-wrap", "text-xs")
  expect(legend.previousElementSibling).toBe(frame)
  expect(screen.getByText(category)).toHaveClass("break-words", "[overflow-wrap:anywhere]")
  expect(screen.getByText(/Share of confirmed sales.*EUR/)).toBeInTheDocument()
})

it("preserves the negative-channel safeguard rather than drawing a misleading share", () => {
  render(<SalesDistributionChart {...ready} data={[...data, { category: "Returns", amount: -5, percentage: -5 }]} />)
  expect(screen.getByText("No sales distribution data")).toBeInTheDocument()
  expect(screen.queryByRole("img")).not.toBeInTheDocument()
  expect(screen.queryByRole("list", { name: "Sales distribution legend" })).not.toBeInTheDocument()
})