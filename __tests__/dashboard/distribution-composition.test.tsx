import { render, screen, within } from "@testing-library/react"
import { DistributionChart } from "@/app/components/dashboard/distribution-chart"

const data = [{ name: "Group A", value: 3, color: "#2563eb" }, { name: "Group B", value: 1, color: "#059669" }]

it("offers a compact comparison layout without changing values or the default donut", () => {
  const { rerender, container } = render(<DistributionChart data={data} title="Distribution" />)
  expect(container.querySelector(".h-44")).toBeInTheDocument()
  expect(screen.getByRole("table")).not.toHaveClass("table-fixed")
  rerender(<DistributionChart data={data} title="Distribution" variant="compact" />)
  expect(container.firstElementChild).toHaveClass("min-w-0", "grid-cols-1", "sm:grid-cols-[112px_minmax(0,1fr)]")
  expect(container.querySelector(".h-28")).toBeInTheDocument()
  expect(container.querySelector(".h-44")).not.toBeInTheDocument()
  const table = screen.getByRole("table")
  expect(table).toHaveClass("table-fixed")
  expect(within(table).getByRole("row", { name: "Group A 3 75.0%" })).toBeInTheDocument()
  expect(within(table).getByRole("row", { name: "Group B 1 25.0%" })).toBeInTheDocument()
  expect(within(table).getByRole("row", { name: "Displayed total 4 100.0%" })).toBeInTheDocument()
})

it("keeps absent currency visible in compact mode without fabricating a symbol", () => {
  render(<DistributionChart data={data} title="Sale distribution" variant="compact" formatValues />)
  expect(screen.getByText("Reported amounts; currency not provided.")).toBeInTheDocument()
  expect(screen.getByRole("columnheader", { name: "Reported amount" })).toBeInTheDocument()
  expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
})

it("stacks a centered full-width plot above rows that fill the remaining card space", () => {
  const { container } = render(<DistributionChart data={data} title="Sessions" variant="stacked" countLabel="Sessions" totalLabel="Total sessions" />)
  const layout = container.querySelector('[data-distribution-layout="stacked"]')!
  expect(layout).toHaveClass("flex", "flex-col", "flex-1", "w-full", "min-w-0")
  const plot = layout.querySelector('[data-distribution-plot]')!
  const rows = layout.querySelector('[data-distribution-rows]')!
  expect(plot).toHaveClass("w-full", "justify-center", "shrink-0")
  expect(plot.nextElementSibling).toBe(rows)
  expect(plot.querySelector("svg")).toBeInTheDocument()
  expect(rows).toHaveClass("w-full", "flex-1", "min-h-0", "overflow-auto")
  expect(rows).not.toHaveClass("max-h-64")
  const table = within(rows as HTMLElement).getByRole("table")
  expect(table).toHaveClass("w-full", "h-full", "table-fixed")
  expect(table.parentElement).toHaveClass("flex-1", "min-h-0")
  expect(within(table).getByRole("row", { name: "Group A 3 75.0%" })).toBeInTheDocument()
  expect(within(table).getByRole("row", { name: "Total sessions 4 100.0%" })).toBeInTheDocument()
})