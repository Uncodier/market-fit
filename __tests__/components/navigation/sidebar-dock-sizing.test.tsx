import { render, screen } from "@testing-library/react"
import { usePathname, useSearchParams } from "next/navigation"
import { Bell } from "@/app/components/ui/icons"
import { MenuItem } from "@/app/components/navigation/MenuItem"
import { getModuleVisual } from "@/app/config/module-visuals"
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
    const items = screen.getByRole("img", { name: "layout.sidebar.integrations app icon" })
      .closest("a")?.parentElement?.parentElement
    if (!isCollapsed) {
      expect(items).toHaveClass("py-2", "space-y-1", "[&>div]:items-center")
      expect(items?.parentElement?.parentElement).not.toHaveClass("pb-2.5")
    }
  })
})

it("preserves the reference's icon-to-spacing ratio", () => {
  expect(SIDEBAR_ICON_SIZE).toBe(32)
  expect(SIDEBAR_ROW_HEIGHT).toBe(40)
  expect(SIDEBAR_ROW_PITCH - SIDEBAR_ICON_SIZE).toBe(12)
})

it("moves collapsed selection to the rail's right edge using the module color", () => {
  const visual = { ...getModuleVisual("sales", "catalog"), accent: "#ec4899", ink: "#831843" }
  const { container, rerender } = render(
    <MenuItem href="/catalog" title="Catalog" isCollapsed isActive visual={visual}
      moduleImage={{ area: "sales", itemKey: "catalog" }} />,
  )
  const indicator = container.querySelector("[data-sidebar-selection-indicator]")
  expect(indicator).toHaveClass("-right-3", "inset-y-0", "w-[3px]", "rounded-full", "border-r-[3px]")
  expect(indicator).toHaveStyle({ borderRightColor: visual.accent })
  expect(indicator).toHaveAttribute("aria-hidden", "true")
  expect(screen.getByRole("link")).toHaveStyle({ backgroundColor: "transparent" })
  expect(screen.getByRole("img", { name: "Catalog app icon" }).parentElement)
    .not.toHaveClass("ring-1")

  rerender(<MenuItem href="/catalog" title="Catalog" isCollapsed visual={visual} />)
  expect(container.querySelector("[data-sidebar-selection-indicator]")).toBeNull()

  rerender(<MenuItem href="/catalog" title="Catalog" isActive visual={visual}
    moduleImage={{ area: "sales", itemKey: "catalog" }} />)
  expect(container.querySelector("[data-sidebar-selection-indicator]")).toHaveClass("opacity-0", "scale-y-75")
  expect(screen.getByRole("img", { name: "Catalog app icon" }).parentElement)
    .toHaveClass("ring-1")
})

it("uses the primary color for collapsed selection without a module visual", () => {
  const { container } = render(
    <MenuItem href="/notifications" title="Notifications" icon={Bell} isCollapsed isActive />,
  )
  expect(container.querySelector("[data-sidebar-selection-indicator]")).toHaveClass("border-primary")
  expect(screen.getByRole("link")).not.toHaveClass("bg-primary")
})

it("keeps selection and icon nodes mounted while animating expansion", () => {
  const props = {
    href: "/catalog", title: "Catalog", isActive: true,
    visual: getModuleVisual("sales", "catalog"),
    moduleImage: { area: "sales" as const, itemKey: "catalog" },
  }
  const { container, rerender } = render(<MenuItem {...props} isCollapsed />)
  const indicator = container.querySelector("[data-sidebar-selection-indicator]")
  const icon = screen.getByRole("img", { name: "Catalog app icon" })
  expect(indicator).toHaveClass("opacity-100", "scale-y-100")
  expect(screen.getByRole("link")).toHaveClass("duration-300", "motion-reduce:transition-none")
  rerender(<MenuItem {...props} isCollapsed={false} />)
  expect(container.querySelector("[data-sidebar-selection-indicator]")).toBe(indicator)
  expect(indicator).toHaveClass("opacity-0", "scale-y-75", "motion-reduce:transition-none")
  expect(screen.getByRole("img", { name: "Catalog app icon" })).toBe(icon)
  expect(container.querySelector('[aria-hidden="false"]')).toHaveClass("opacity-100", "translate-x-0")
})

it("spaces the overview and other pinned icons inside their separator group", () => {
  render(<ShortcutDropSections pinnedOverview={{ id: "reportOverview", pinned: true }}
    pinnedShortcuts={[{ id: "catalog", pinned: true }]} recentShortcuts={[]}
    isOverPinned={false} isOverRecent={false} setPinnedDropRef={jest.fn()}
    setRecentDropRef={jest.fn()} renderShortcut={(entry) => <div key={entry.id}>{entry.id}</div>} />)
  expect(screen.getByText("reportOverview").parentElement)
    .toHaveClass("flex", "flex-col", "space-y-1")
})

describe("Settings selection indicator", () => {
  afterEach(() => {
    jest.mocked(usePathname).mockReturnValue("")
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
  })

  it("shows the rounded right indicator for Settings and fades it in expanded mode", () => {
    jest.mocked(usePathname).mockReturnValue("/settings")
    const { rerender } = render(<ConfigurationSection isCollapsed />)
    const button = screen.getByRole("button", { name: "layout.sidebar.settings" })
    expect(button.parentElement).toHaveClass("p-[7px]", "w-14")
    expect(button.parentElement).not.toHaveClass("pr-2", "pb-2.5")
    expect(button.querySelector("[data-sidebar-selection-indicator]"))
      .toHaveClass("border-primary", "border-r-[3px]", "rounded-full", "-right-3", "opacity-100")
    expect(button).not.toHaveClass("bg-primary")
    expect(screen.getByRole("img", { name: "layout.sidebar.settings app icon" }).parentElement)
      .not.toHaveClass("ring-1")
    rerender(<ConfigurationSection isCollapsed={false} />)
    expect(screen.getByRole("button", { name: "layout.sidebar.settings" }).parentElement)
      .toHaveClass("pt-2")
    expect(screen.getByRole("button", { name: "layout.sidebar.settings" })
      .querySelector("[data-sidebar-selection-indicator]"))
      .toHaveClass("opacity-0", "duration-300", "motion-reduce:transition-none")
  })

  it.each(["team", "channels", "activities"])("respects Settings tab selection for %s", (tab) => {
    jest.mocked(usePathname).mockReturnValue("/settings")
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ tab }) as ReturnType<typeof useSearchParams>)
    render(<ConfigurationSection isCollapsed />)
    const indicator = screen.getByRole("button", { name: "layout.sidebar.settings" })
      .querySelector("[data-sidebar-selection-indicator]")
    if (tab === "team") expect(indicator).toHaveClass("opacity-100")
    else expect(indicator).toBeNull()
  })

  it("does not mark Settings when a child route is selected", () => {
    jest.mocked(usePathname).mockReturnValue("/integrations")
    render(<ConfigurationSection isCollapsed />)
    expect(screen.getByRole("button", { name: "layout.sidebar.settings" })
      .querySelector("[data-sidebar-selection-indicator]")).toBeNull()
  })
})