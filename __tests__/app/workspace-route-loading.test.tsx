import React from "react"
import { render, screen } from "@testing-library/react"
import CatalogLoading from "@/app/catalog/loading"
import OrdersLoading from "@/app/orders/loading"
import ReservationsLoading from "@/app/reservations/loading"
import DashboardLoading from "@/app/dashboard/loading"
import PosLoading from "@/app/pos/loading"
import ChatLoading from "@/app/chat/loading"

jest.mock("@/app/components/ui/sticky-header", () => ({
  StickyHeader: ({ children }: { children: React.ReactNode }) => <header data-testid="route-toolbar">{children}</header>,
}))
jest.mock("@/app/dashboard/ReportLoading", () => ({
  ReportLoading: () => <div data-testid="report-content-loading" />,
}))
// Keep the real presentation skeletons without loading their mutation-only children.
jest.mock("@/app/reservations/components/ReservationRowActions", () => ({ ReservationRowActions: () => null }))
jest.mock("@/app/orders/components/MarketplaceOrderControls", () => ({ MarketplaceOrderControls: () => null }))

describe("workspace route loading geometry", () => {
  it("catalog uses the sticky filter toolbar and five compact rows from its data-loading state", () => {
    const { container } = render(<CatalogLoading />)
    expect(screen.getByRole("status", { name: "Loading catalog" })).toHaveAttribute("aria-busy", "true")
    expect(screen.getAllByTestId("route-toolbar")).toHaveLength(1)
    expect(container.querySelectorAll(".h-12")).toHaveLength(5)
    expect(container.querySelector(".md\\:p-6")).toBeInTheDocument()
    expect(container.querySelector(".h-14")).not.toBeInTheDocument()
  })

  it("orders uses the existing five-column kanban skeleton for its default view", () => {
    const { container } = render(<OrdersLoading />)
    expect(screen.getByRole("status", { name: "Loading orders" })).toHaveAttribute("aria-busy", "true")
    expect(screen.getAllByTestId("route-toolbar")).toHaveLength(1)
    expect(container.querySelectorAll(".w-72.md\\:w-80")).toHaveLength(5)
    expect(container.querySelector(".overflow-x-auto")).toBeInTheDocument()
    expect(container.querySelector(".md\\:py-8")).toBeInTheDocument()
  })

  it("reservations preserves the month-period bar and real table loading geometry", () => {
    const { container } = render(<ReservationsLoading />)
    expect(screen.getByRole("status", { name: "Loading reservations" })).toHaveAttribute("aria-busy", "true")
    expect(screen.getAllByTestId("route-toolbar")).toHaveLength(1)
    expect(container.querySelector(".py-2.border-b")).toBeInTheDocument()
    expect(screen.getByRole("table", { hidden: true })).toBeInTheDocument()
    expect(container.querySelectorAll("tbody tr").length).toBeGreaterThan(0)
    expect(container.querySelector(".lg\\:p-8")).toBeInTheDocument()
  })

  it("dashboard has a full-width toolbar outside the constrained report viewport, not a second title", () => {
    const { container } = render(<DashboardLoading />)
    const toolbar = screen.getByTestId("route-toolbar")
    const viewport = container.querySelector(".max-w-\\[1600px\\]")
    expect(viewport).toContainElement(screen.getByTestId("report-content-loading"))
    expect(viewport).not.toContainElement(toolbar)
    expect(container.querySelector(".h-7")).not.toBeInTheDocument()
    expect(container.querySelector(".bg-muted\\/20")).toBeInTheDocument()
  })

  it("POS retains its access-check skeleton with a desktop cart and product tiles", () => {
    const { container } = render(<PosLoading />)
    expect(screen.getByRole("status", { name: "Loading point of sale" })).toHaveAttribute("aria-busy", "true")
    expect(container.querySelector(".w-96.hidden.md\\:flex")).toBeInTheDocument()
    expect(container.querySelectorAll(".grid > .h-40")).toHaveLength(15)
  })

  it("chat keeps the header and composer inside its pane instead of subtracting a hardcoded global sidebar", () => {
    const { container } = render(<ChatLoading />)
    expect(screen.getByRole("status", { name: "Loading conversations" })).toHaveAttribute("aria-busy", "true")
    expect(container.querySelector(".absolute.top-0.right-0.w-full")).toBeInTheDocument()
    expect(container.querySelector(".chat-input-container")).toHaveClass("absolute", "w-full")
    expect(container.querySelector(".fixed")).not.toBeInTheDocument()
    expect(container.innerHTML).not.toContain("256px")
  })
})