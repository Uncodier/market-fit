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