import { render, screen } from "@testing-library/react"
import { Bell } from "@/app/components/ui/icons"
import { MenuItem } from "@/app/components/navigation/MenuItem"
import { ConfigurationSection } from "@/app/components/navigation/ConfigurationSection"
import { ShortcutDropSections } from "@/app/components/navigation/ShortcutDropSections"
import { SIDEBAR_ICON_SIZE, SIDEBAR_ROW_HEIGHT, SIDEBAR_ROW_PITCH } from "@/app/components/navigation/sidebar-metrics"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))
jest.mock("@/app/context/ScreenAccessContext", () => ({
  useOptionalScreenAccess: () => null,
}))
jest.mock("@/app/components/settings/BusinessOpenToggle", () => ({
  BusinessOpenToggle: () => null,
}))
jest.mock("@/app/components/navigation/NavigationLink", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react")
  return {
    NavigationLink: forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
      function NavigationLink(props, ref) { return <a ref={ref} {...props} /> },
    ),
  }
})

describe.each([true, false])("Dock sizing (collapsed: %s)", (isCollapsed) => {
  it("keeps module icons and row padding the same in both modes", () => {
    const { container } = render(
      <MenuItem href="/catalog" title="Catalog" isCollapsed={isCollapsed}
        moduleImage={{ area: "sales", itemKey: "catalog" }} />,
    )
    const link = screen.getByRole("link")
    expect(link).toHaveClass("h-10", "shrink-0")
    expect(link).toHaveStyle({ height: "40px", paddingTop: "4px", paddingBottom: "4px" })
    expect(screen.getByRole("img", { name: "Catalog app icon" }).parentElement)
      .toHaveClass("h-8", "w-8")
    expect(container.querySelector(".sidebar-menu-item-link > div"))
      .not.toHaveClass("safari-icon-fix")
    expect(link).toHaveStyle({ gap: isCollapsed ? "0" : "12px" })
  })

  it("uses larger vector icons and matching emoji tiles", () => {
    const { container, rerender } = render(
      <MenuItem href="/notifications" title="Notifications" icon={Bell} isCollapsed={isCollapsed} />,
    )
    expect(container.querySelector("svg")?.parentElement)
      .toHaveStyle({ width: "22px", height: "22px" })
    rerender(<MenuItem href="/custom" title="Custom" emoji="⭐" isCollapsed={isCollapsed} />)
    expect(screen.getByText("⭐").parentElement).toHaveClass("h-8", "w-8")
  })

  it("matches the Settings toggle to the other Dock rows", () => {
    render(<ConfigurationSection isCollapsed={isCollapsed} />)
    const button = screen.getByRole("button", { name: "layout.sidebar.settings" })
    expect(button).toHaveClass("h-10")
    expect(screen.getByRole("img", { name: "layout.sidebar.settings app icon" }).parentElement)
      .toHaveClass("h-8", "w-8")
  })
})

it("preserves the reference's icon-to-spacing ratio", () => {
  expect(SIDEBAR_ICON_SIZE).toBe(32)
  expect(SIDEBAR_ROW_HEIGHT).toBe(40)
  expect(SIDEBAR_ROW_PITCH - SIDEBAR_ICON_SIZE).toBe(12)
})

it("spaces the overview and other pinned icons inside their separator group", () => {
  render(<ShortcutDropSections pinnedOverview={{ id: "reportOverview", pinned: true }}
    pinnedShortcuts={[{ id: "catalog", pinned: true }]} recentShortcuts={[]}
    isOverPinned={false} isOverRecent={false} setPinnedDropRef={jest.fn()}
    setRecentDropRef={jest.fn()} renderShortcut={(entry) => <div key={entry.id}>{entry.id}</div>} />)
  expect(screen.getByText("reportOverview").parentElement)
    .toHaveClass("flex", "flex-col", "space-y-1")
})