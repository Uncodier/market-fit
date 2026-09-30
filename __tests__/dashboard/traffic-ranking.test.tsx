import { render, screen, within } from "@testing-library/react"
import { TrafficRanking } from "@/app/components/dashboard/traffic/traffic-ranking"

it("ranks every returned category with exact counts and share rather than a dominant donut", () => {
  const data = [
    { name: "Documentation", value: 20, color: "#2563eb" },
    { name: "Home", value: 60, color: "#7c3aed" },
    { name: "Pricing", value: 0, color: "#059669" },
  ]
  render(<TrafficRanking data={data} title="Top Visited Pages" />)
  const table = screen.getByRole("table", { name: "Top Visited Pages" })
  const rows = within(table).getAllByRole("row").slice(1)
  expect(rows).toHaveLength(3)
  expect(rows[0]).toHaveTextContent("Home6075.0%")
  expect(rows[1]).toHaveTextContent("Documentation2025.0%")
  expect(rows[2]).toHaveTextContent("Pricing00.0%")
  expect(rows[0].querySelector("[style]")).toHaveStyle({ width: "75%" })
  expect(screen.getByText("80")).toBeInTheDocument()
  expect(data[0].name).toBe("Documentation")
  expect(table).toHaveClass("table-fixed", "w-full")
  expect(screen.getByText("Home")).toHaveClass("break-words", "[overflow-wrap:anywhere]")
  expect(table.closest(".max-h-\\[520px\\]")).toHaveClass("overflow-auto", "min-w-0")
})

it("does not truncate lower-ranked categories or invent Other", () => {
  const data = Array.from({ length: 20 }, (_, index) => ({ name: `Page ${index}`, value: index, color: "#2563eb" }))
  render(<TrafficRanking data={data} title="Pages" />)
  expect(screen.getAllByRole("rowheader")).toHaveLength(20)
  expect(screen.queryByText("Other")).not.toBeInTheDocument()
})