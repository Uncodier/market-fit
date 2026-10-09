import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { CreditsWidget } from "@/app/components/navigation/CreditsWidget"
import type { Site } from "@/app/context/site-types"
import { navigateOrAssign } from "@/lib/navigation/stale-router"

let mockSite: Pick<Site, "id" | "billing">

jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: mockSite }),
}))

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    t: (key: string) => ({
      "layout.sidebar.credits": "Credits",
      "layout.sidebar.creditsAvailable": "available",
      "layout.sidebar.manageCredits": "Manage credits",
    }[key] || key),
  }),
}))

jest.mock("@/lib/navigation/stale-router", () => ({ navigateOrAssign: jest.fn() }))

function setBilling(billing: Partial<NonNullable<Site["billing"]>> = {}) {
  mockSite = {
    id: "site-1",
    billing: { plan: "engine", auto_renew: true, credits_available: 0, account_balance: 0, ...billing },
  }
}

describe("CreditsWidget", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setBilling()
  })

  it("includes withdrawable credits when regular credits are zero", () => {
    setBilling({ account_balance: 8 })
    render(<CreditsWidget />)

    expect(screen.getByText("8 / 20")).toBeInTheDocument()
    expect(screen.queryByText("8 withdrawable")).not.toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Credits" })).toHaveAttribute("aria-valuenow", "40")
    expect(screen.getByTitle("Withdrawable credits")).toHaveStyle({ width: "40%" })
    expect(screen.getByTitle("Withdrawable credits")).toHaveClass("bg-emerald-500")
  })

  it("uses one monthly credit per add-on in the displayed allowance", () => {
    setBilling({ addons_count: 2, credits_available: 3 })
    render(<CreditsWidget />)
    expect(screen.getByText("3 / 22")).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Credits" })).toHaveAttribute("aria-valuenow", String((3 / 22) * 100))
  })

  it("shows the old window's stored quota until billing refreshes the new allowance", () => {
    const period = { plan_credit_period_start: "2000-01-01T00:00:00Z", plan_credit_period_end: "2099-01-01T00:00:00Z" }
    setBilling({ ...period, addons_count: 2, plan_credit_allowance: 30 })
    const { rerender } = render(<CreditsWidget />)
    expect(screen.getByText("0 / 30")).toBeInTheDocument()
    setBilling({ ...period, addons_count: 2, plan_credit_allowance: 22 })
    rerender(<CreditsWidget />)
    expect(screen.getByText("0 / 22")).toBeInTheDocument()
  })

  it.each([
    ["expired", "2000-01-01T00:00:00Z", "2000-02-01T00:00:00Z"],
    ["future", "2099-01-01T00:00:00Z", "2099-02-01T00:00:00Z"],
    ["invalid", "2000-01-01T00:00:00Z", "invalid-date"],
    ["reversed", "2099-01-01T00:00:00Z", "2000-01-01T00:00:00Z"],
    ["missing", null, null],
  ])("ignores the stored allowance for an %s period", (_label, start, end) => {
    setBilling({ plan: "commission", addons_count: 0, plan_credit_allowance: 23,
      plan_credit_period_start: start, plan_credit_period_end: end })
    render(<CreditsWidget />)
    expect(screen.getByText("0 / 1")).toBeInTheDocument()
  })

  it("stops displaying the stored quota at expiry without a billing refresh", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-08T12:00:00Z"))
    try {
      setBilling({ addons_count: 2, plan_credit_allowance: 30,
        plan_credit_period_start: "2026-09-08T12:00:01Z", plan_credit_period_end: "2026-10-08T12:00:01Z" })
      render(<CreditsWidget />)
      expect(screen.getByText("0 / 30")).toBeInTheDocument()
      act(() => { jest.advanceTimersByTime(1000) })
      expect(screen.getByText("0 / 22")).toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })

  it("rechecks a background tab's expired quota on focus", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-08T12:00:00Z"))
    try {
      setBilling({ plan: "commission", plan_credit_allowance: 23,
        plan_credit_period_start: "2026-09-08T12:00:00Z", plan_credit_period_end: "2026-10-08T12:01:00Z" })
      const { unmount } = render(<CreditsWidget />)
      expect(screen.getByText("0 / 23")).toBeInTheDocument()
      jest.setSystemTime(new Date("2026-10-08T12:02:00Z"))
      fireEvent.focus(window)
      expect(screen.getByText("0 / 1")).toBeInTheDocument()
      unmount()
      expect(jest.getTimerCount()).toBe(0)
    } finally {
      jest.useRealTimers()
    }
  })

  it("stacks regular and withdrawable credits on the same horizontal bar", () => {
    setBilling({ credits_available: 5, account_balance: 3 })
    render(<CreditsWidget />)

    const bar = screen.getByRole("progressbar", { name: "Credits" })
    const regular = screen.getByTitle("Regular credits")
    const withdrawable = screen.getByTitle("Withdrawable credits")
    expect(screen.getAllByRole("progressbar")).toHaveLength(1)
    expect(bar).toHaveClass("flex")
    expect(regular.parentElement).toBe(withdrawable.parentElement)
    expect(regular).toHaveStyle({ width: "25%" })
    expect(withdrawable).toHaveStyle({ width: "15%" })
    expect(regular).toHaveClass("bg-primary")
    expect(withdrawable).toHaveClass("bg-emerald-500")
    expect(bar).toHaveAttribute("aria-valuetext", "8 credits available: 5 regular, 3 withdrawable")
    expect(screen.queryByText("5 regular")).not.toBeInTheDocument()
    expect(screen.queryByText("3 withdrawable")).not.toBeInTheDocument()
  })

  it.each([false, true])("only shows the breakdown in the hover tooltip with isCollapsed=%s", async (isCollapsed) => {
    setBilling({ credits_available: 0.001, account_balance: 17.42, plan: "foundry" })
    render(<CreditsWidget isCollapsed={isCollapsed} />)

    const trigger = screen.getByRole("button", { name: "Manage credits" })
    expect(screen.queryByText("0.001 regular")).not.toBeInTheDocument()
    expect(screen.queryByText("17.42 withdrawable")).not.toBeInTheDocument()
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    fireEvent.pointerEnter(trigger)
    fireEvent.pointerMove(trigger)

    const tooltip = await screen.findByRole("tooltip")
    expect(tooltip).toHaveTextContent("0.001 regular")
    expect(tooltip).toHaveTextContent("17.42 withdrawable")
    expect(trigger).not.toHaveTextContent("regular")
    expect(trigger).not.toHaveTextContent("withdrawable")
  })

  it("keeps the compact header and bar stacked despite global Safari button styles", () => {
    setBilling({ credits_available: 0.001, account_balance: 17.42, plan: "foundry" })
    render(<CreditsWidget />)

    const trigger = screen.getByRole("button", { name: "Manage credits" })
    expect(trigger).toHaveClass("!block", "p-3")
    expect(trigger.children).toHaveLength(2)
    expect(screen.getByText("17.421 / 100")).toHaveClass("whitespace-nowrap")
    expect(trigger.lastElementChild).toBe(screen.getByRole("progressbar"))
  })

  it("keeps withdrawable funds visible and scales both segments above the plan limit", () => {
    setBilling({ credits_available: 8, account_balance: 32 })
    render(<CreditsWidget />)

    expect(screen.getByText("40 / 20")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100")
    expect(screen.getByTitle("Regular credits")).toHaveStyle({ width: "20%" })
    expect(screen.getByTitle("Withdrawable credits")).toHaveStyle({ width: "80%" })
  })

  it("shows a full green bar for a withdrawable-only balance above the plan limit", () => {
    setBilling({ account_balance: 45 })
    render(<CreditsWidget />)

    expect(screen.getByText("45 / 20")).toBeInTheDocument()
    expect(screen.getByTitle("Regular credits")).toHaveStyle({ width: "0%" })
    expect(screen.getByTitle("Withdrawable credits")).toHaveStyle({ width: "100%" })
  })

  it.each([
    ["commission", 0, 1],
    ["engine", 2, 22],
    ["foundry", 0, 100],
    ["enterprise", 1, 501],
  ] as const)("preserves the %s plan limit with %s add-ons", (plan, addons_count, limit) => {
    setBilling({ plan, addons_count, account_balance: 0.25 })
    render(<CreditsWidget />)
    expect(screen.getByText(`0.25 / ${limit}`)).toBeInTheDocument()
  })

  it("preserves the low-credit warning and visibility threshold without withdrawable funds", () => {
    setBilling({ credits_available: 2 })
    const { rerender } = render(<CreditsWidget />)

    expect(screen.getByTitle("Regular credits")).toHaveClass("bg-amber-500")
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10")

    setBilling({ credits_available: 10 })
    rerender(<CreditsWidget />)
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
  })

  it("shows an empty bar for missing balances without NaN values", () => {
    setBilling({ credits_available: undefined, account_balance: undefined })
    render(<CreditsWidget />)

    expect(screen.getByText("0 / 20")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
    expect(screen.getByTitle("Regular credits")).toHaveStyle({ width: "0%" })
    expect(screen.getByTitle("Withdrawable credits")).toHaveStyle({ width: "0%" })
  })

  it("preserves a negative total without producing negative segment widths", () => {
    setBilling({ credits_available: -2 })
    render(<CreditsWidget />)

    expect(screen.getByText("-2 / 20")).toHaveClass("text-destructive")
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0")
    expect(screen.getByTitle("Regular credits")).toHaveStyle({ width: "0%" })
    expect(screen.getByTitle("Withdrawable credits")).toHaveStyle({ width: "0%" })
  })

  it("uses net available credits when a withdrawable balance covers an overage", () => {
    setBilling({ credits_available: -2, account_balance: 5 })
    render(<CreditsWidget />)

    expect(screen.getByText("3 / 20")).not.toHaveClass("text-destructive")
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "15")
    expect(screen.getByTitle("Regular credits")).toHaveStyle({ width: "0%" })
    expect(screen.getByTitle("Withdrawable credits")).toHaveStyle({ width: "15%" })
  })

  it("updates both amounts when the current site's balances change", () => {
    const { rerender } = render(<CreditsWidget />)
    setBilling({ credits_available: 1.125, account_balance: 2.25 })
    rerender(<CreditsWidget />)

    expect(screen.getByText("3.375 / 20")).toBeInTheDocument()
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext", "3.375 credits available: 1.125 regular, 2.25 withdrawable"
    )
  })

  it("uses the same proportions in the collapsed ring without overlapping or overflowing", () => {
    setBilling({ credits_available: 8, account_balance: 32 })
    render(<CreditsWidget isCollapsed />)

    const chart = screen.getByRole("img", { name: "40 credits available: 8 regular, 32 withdrawable" })
    const regular = chart.querySelector("circle.text-primary")!
    const withdrawable = chart.querySelector("circle.text-emerald-500")!
    const circumference = 2 * Math.PI * 10
    expect(Number(regular.getAttribute("stroke-dasharray")?.split(" ")[0])).toBeCloseTo(circumference * 0.2)
    expect(Number(withdrawable.getAttribute("stroke-dasharray")?.split(" ")[0])).toBeCloseTo(circumference * 0.8)
    expect(Number(withdrawable.getAttribute("stroke-dashoffset"))).toBeCloseTo(-circumference * 0.2)
  })

  it("fits the entire collapsed ring inside an explicit SVG viewport", () => {
    render(<CreditsWidget isCollapsed />)

    const trigger = screen.getByRole("button", { name: "Manage credits" })
    const chart = screen.getByRole("img")
    expect(trigger).toHaveClass("w-[32px]", "h-[32px]", "shrink-0")
    expect(chart).toHaveAttribute("viewBox", "0 0 24 24")
    expect(chart).toHaveAttribute("width", "24")
    expect(chart).toHaveAttribute("height", "24")
    for (const circle of chart.querySelectorAll("circle")) {
      const outerRadius = Number(circle.getAttribute("r")) + Number(circle.getAttribute("stroke-width")) / 2
      expect(Number(circle.getAttribute("cx")) - outerRadius).toBeGreaterThanOrEqual(0)
      expect(Number(circle.getAttribute("cy")) - outerRadius).toBeGreaterThanOrEqual(0)
      expect(Number(circle.getAttribute("cx")) + outerRadius).toBeLessThanOrEqual(24)
      expect(Number(circle.getAttribute("cy")) + outerRadius).toBeLessThanOrEqual(24)
    }
  })

  it.each([false, true])("still opens billing with isCollapsed=%s", (isCollapsed) => {
    render(<CreditsWidget isCollapsed={isCollapsed} />)
    fireEvent.click(screen.getByRole("button", { name: "Manage credits" }))
    expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), "/billing")
  })

  it("does not show the widget for demo sites", () => {
    setBilling({ account_balance: 50 })
    mockSite.id = "demo-site"
    const { container } = render(<CreditsWidget />)
    expect(container).toBeEmptyDOMElement()
  })
})