import React, { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { MemberBlockedScreens } from "@/app/components/settings/MemberBlockedScreens"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: () => "" }) }))
jest.mock("@/app/config/navigation-areas", () => ({ getNavItemTitle: (item: { title: string }) => item.title }))
jest.mock("@/lib/auth/screen-access", () => ({ getBlockableNavGroups: () => [
  { area: "Sales", categoryKey: "sales", items: [{ key: "leads", title: "Leads" }, { key: "deals", title: "Deals" }] },
] }))

function Harness({ initial = [], disabled = false }: { initial?: string[]; disabled?: boolean }) {
  const [blocked, setBlocked] = useState(initial)
  return <MemberBlockedScreens blockedScreens={blocked} onChange={setBlocked} disabled={disabled} />
}

describe("app access shared panel and chips", () => {
  it("starts with all apps visible and only toggles access when a chip is clicked", () => {
    render(<Harness />)
    const header = screen.getByRole("button", { name: "App access All apps visible" })
    expect(header).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("button", { name: "Leads" })).not.toBeInTheDocument()
    fireEvent.click(header)
    const leads = screen.getByRole("button", { name: "Leads" })
    expect(leads).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(leads)
    expect(leads).toHaveAttribute("aria-pressed", "true")
    expect(leads).toHaveAttribute("title", "Show this app")
    expect(header).toHaveTextContent("1 hidden")
    fireEvent.click(leads)
    expect(leads).toHaveAttribute("aria-pressed", "false")
    expect(header).toHaveTextContent("All apps visible")
  })

  it("starts hidden apps expanded and keeps the count and preview when collapsed", () => {
    render(<Harness initial={["leads"]} />)
    const header = screen.getByRole("button", { name: "App access 1 hidden" })
    expect(header).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "Leads" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(header)
    expect(header).toHaveAttribute("aria-expanded", "false")
    expect(header).toHaveTextContent("Leads")
  })

  it("preserves hide-all and show-all category behavior", () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("button", { name: /^App access/ }))
    fireEvent.click(screen.getByRole("button", { name: "Hide all" }))
    expect(screen.getByRole("button", { name: "Leads" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Deals" })).toHaveAttribute("aria-pressed", "true")
    fireEvent.click(screen.getByRole("button", { name: "Show all" }))
    expect(screen.getByRole("button", { name: "Leads" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: "Deals" })).toHaveAttribute("aria-pressed", "false")
  })

  it("allows inspecting a disabled panel without allowing access changes", () => {
    render(<Harness disabled />)
    fireEvent.click(screen.getByRole("button", { name: /^App access/ }))
    const leads = screen.getByRole("button", { name: "Leads" })
    expect(leads).toBeDisabled()
    expect(screen.getByRole("button", { name: "Hide all" })).toBeDisabled()
    fireEvent.click(leads)
    expect(leads).toHaveAttribute("aria-pressed", "false")
  })
})