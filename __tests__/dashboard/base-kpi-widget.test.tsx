import React from "react"
import { render, screen } from "@testing-library/react"
import { BaseKpiWidget } from "@/app/components/dashboard/base-kpi-widget"
import { ReportKpiGrid } from "@/app/components/dashboard/report-layout"

describe("report metric cards", () => {
  it("renders exact values immediately without animation timers or invented zero values", () => {
    const { rerender } = render(<BaseKpiWidget title="Revenue" value="EUR 1,234.56" changeText="No previous baseline" isLoading={false} />)
    expect(screen.getByText("EUR 1,234.56")).toBeInTheDocument()
    rerender(<BaseKpiWidget title="Revenue" value={null} changeText="Unavailable" isLoading={false} />)
    expect(screen.getByText("—")).toBeInTheDocument()
    expect(screen.queryByText("0")).not.toBeInTheDocument()
  })

  it("separates the direction of change from whether the change is favorable", () => {
    render(<BaseKpiWidget title="Costs" value="USD 80" changeText="-20% from previous period" isPositiveChange isLoading={false} />)
    expect(screen.getByText("↓")).toBeInTheDocument()
    expect(screen.getByText(/-20%/)).toHaveClass("text-green-600")
  })

  it("offers a keyboard-accessible metric definition and a loading state", () => {
    render(<BaseKpiWidget title="Customers" tooltipText="Customers with a paid invoice" value={10} changeText="" isLoading />)
    expect(screen.getByRole("button", { name: "About Customers" })).toBeInTheDocument()
    expect(screen.getByRole("status", { name: "Loading Customers" })).toBeInTheDocument()
    expect(screen.queryByText("10")).not.toBeInTheDocument()
  })

  it("keeps two-up mobile metrics compact while allowing long amounts to wrap", () => {
    const { container } = render(<BaseKpiWidget title="Confirmed sales" value="EUR 1,234,567.89" changeText="Previous period" isLoading={false} />)
    expect(container.firstElementChild).toHaveClass("min-w-0", "min-h-[104px]")
    expect(screen.getByText("EUR 1,234,567.89")).toHaveClass("break-words", "text-xl", "sm:text-2xl")
  })

  it("keeps the same three layout slots during loading and after data arrives", () => {
    const props = { title: "Revenue", value: "USD 1,234", changeText: "Previous period" }
    const { container, rerender } = render(<BaseKpiWidget {...props} isLoading />)
    const slots = () => Array.from(container.querySelectorAll("[data-kpi-slot]")).map(slot => [slot.getAttribute("data-kpi-slot"), slot.className])
    const loadingSlots = slots()
    expect(loadingSlots.map(([slot]) => slot)).toEqual(["title", "value", "status"])
    expect(container.querySelector('[data-kpi-slot="value"] > div')).toHaveClass("h-8", "motion-reduce:animate-none")
    rerender(<BaseKpiWidget {...props} isLoading={false} />)
    expect(slots()).toEqual(loadingSlots)
    expect(container.querySelector('[data-kpi-slot="value"]')).toHaveClass("min-w-0", "leading-8", "sm:leading-8")
    expect(container.querySelector('[data-kpi-slot="status"]')).toHaveClass("min-h-[48px]", "sm:min-h-8")
  })

  it("prevents an inline help button from enlarging the title row", () => {
    render(<BaseKpiWidget title="Efficiency" tooltipText="Sales divided by costs" value="2:1" changeText="" isLoading={false} />)
    expect(screen.getByRole("button", { name: "About Efficiency" })).toHaveClass("inline-flex", "h-4", "w-4")
    expect(screen.getByRole("heading", { name: "Efficiency" })).toHaveClass("leading-5")
  })

  it("aligns arbitrary wrapped labels with shared tracks and retains all the content", () => {
    const title = "Return on recorded costs across multiple categories"
    const { container } = render(<ReportKpiGrid columns={3}>
      <BaseKpiWidget title={title} value="USD 1,234,567.89" changeText="No baseline is available for this selected period" isLoading={false} />
      <BaseKpiWidget title="Sales" value={8} changeText="" isLoading={false} />
    </ReportKpiGrid>)
    expect(container.firstChild).toHaveClass("sm:grid-cols-3", "supports-[grid-template-rows:subgrid]:[&>[data-report-kpi]]:grid-rows-subgrid")
    expect(container.firstChild).toHaveClass("max-[359px]:grid-cols-1", "max-[359px]:[&>*:first-child]:col-span-1")
    expect(screen.getByRole("heading", { name: title })).not.toHaveClass("truncate", "line-clamp-2")
    expect(container.querySelectorAll("[data-report-kpi]")).toHaveLength(2)
  })
})