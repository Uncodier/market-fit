import { fireEvent, render, screen, within } from "@testing-library/react"
import { usePathname, useSearchParams } from "next/navigation"
import { Sidebar } from "@/app/components/navigation/Sidebar"
import { useLayout } from "@/app/context/LayoutContext"
import { navigateOrAssign } from "@/lib/navigation/stale-router"

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => function AppsLauncher({ onClose }: { onClose: () => void }) {
    return (
      <div role="dialog" aria-label="Apps launcher">
        <button onClick={onClose}>Close apps</button>
      </div>
    )
  },
}))

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))

jest.mock("@/app/hooks/use-auth", () => ({
  useAuth: () => ({ user: null }),
}))

jest.mock("@/app/components/navigation/NavigationLink", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react")
  return {
    NavigationLink: forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
      function NavigationLink(props, ref) {
        return <a ref={ref} {...props} />
      },
    ),
  }
})

jest.mock("@/app/components/navigation/SiteSelector", () => ({ SiteSelector: () => null }))
jest.mock("@/app/components/navigation/ConfigurationSection", () => ({ ConfigurationSection: () => null }))
jest.mock("@/app/components/navigation/NotificationBadge", () => ({ NotificationBadge: () => null }))
jest.mock("@/app/context/LayoutContext", () => ({ useLayout: jest.fn() }))
jest.mock("@/app/context/ScreenAccessContext", () => ({ useOptionalScreenAccess: () => null }))
jest.mock("@/app/components/navigation/RobotsBadge", () => ({ RobotsBadge: () => null }))
jest.mock("@/app/components/navigation/ModuleImage", () => ({ ModuleImage: () => null }))
jest.mock("@/lib/navigation/stale-router", () => ({ navigateOrAssign: jest.fn() }))
jest.mock("@/app/components/navigation/DynamicShortcuts", () => ({ DynamicShortcuts: () => null }))
jest.mock("@/app/components/navigation/OnboardingProgressWidget", () => ({ OnboardingProgressWidget: () => null }))
jest.mock("@/app/components/navigation/CreditsWidget", () => ({ CreditsWidget: () => null }))

function renderSidebar(isCollapsed = false) {
  return render(<Sidebar isCollapsed={isCollapsed} onCollapse={jest.fn()} />)
}

function pressShortcut(options: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", {
    key: "a",
    bubbles: true,
    cancelable: true,
    ...options,
  })
  fireEvent(document, event)
  return event
}

describe("sidebar Apps shortcut", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(usePathname).mockReturnValue("/robots")
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("mode=workflow") as ReturnType<typeof useSearchParams>,
    )
    jest.mocked(useLayout).mockReturnValue({
      robotsViewMode: "workflow", setRobotsViewMode: jest.fn(),
      isLayoutCollapsed: false, setIsLayoutCollapsed: jest.fn(),
    })
  })

  it("shows the Command+A hint on the navigation item", () => {
    renderSidebar()

    const apps = screen.getByRole("link", { name: /Apps/ })
    expect(apps).toHaveAttribute("href", "/navigation")
    expect(apps).toHaveAttribute("aria-keyshortcuts", "Meta+A Control+A")
    const hint = within(apps).getByLabelText("Command+A")
    expect(hint).toHaveTextContent("A")
    expect(hint).toHaveClass("items-center", "justify-center", "self-center", "leading-none")
    expect(hint.querySelector("svg")).toBeInTheDocument()
    expect(within(hint).getByText("A")).toHaveClass("leading-none")
    expect(within(apps).getByText("Apps")).toBeInTheDocument()
  })

  it("opens the launcher when the Apps item is clicked", () => {
    renderSidebar()
    fireEvent.click(screen.getByRole("link", { name: /Apps/ }))
    expect(screen.getByRole("dialog", { name: "Apps launcher" })).toBeInTheDocument()
  })

  it.each([
    { metaKey: true },
    { ctrlKey: true },
    { metaKey: true, key: "A" },
  ])("opens the same launcher and prevents the browser shortcut for %o", (options) => {
    renderSidebar()
    expect(pressShortcut(options).defaultPrevented).toBe(true)
    expect(screen.getByRole("dialog", { name: "Apps launcher" })).toBeInTheDocument()
  })

  it("keeps the shortcut available with the sidebar collapsed", () => {
    renderSidebar(true)
    const apps = document.getElementById("tour-apps-nav") as HTMLElement
    expect(apps.querySelector("kbd")).not.toBeInTheDocument()
    expect(apps).toHaveAttribute("aria-keyshortcuts", "Meta+A Control+A")

    pressShortcut({ metaKey: true })
    expect(screen.getByRole("dialog", { name: "Apps launcher" })).toBeInTheDocument()
  })

  it("shows the shortcut in the collapsed item's tooltip", async () => {
    renderSidebar(true)
    const apps = document.getElementById("tour-apps-nav") as HTMLElement
    fireEvent.focus(apps.firstElementChild as HTMLElement)

    const tooltip = await screen.findByRole("tooltip")
    expect(tooltip).toHaveTextContent("Apps")
    expect(within(tooltip).getByLabelText("Command+A")).toHaveTextContent("A")
  })

  it.each([
    {},
    { metaKey: true, key: "k" },
    { metaKey: true, key: "n" },
    { ctrlKey: true, key: "n" },
    { metaKey: true, shiftKey: true },
    { ctrlKey: true, altKey: true },
    { metaKey: true, isComposing: true },
  ])("ignores unrelated shortcuts and composition for %o", (options) => {
    renderSidebar()
    expect(pressShortcut(options).defaultPrevented).toBe(false)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("respects keyboard events already handled by another component", () => {
    renderSidebar()
    const event = new KeyboardEvent("keydown", { key: "a", metaKey: true, cancelable: true })
    event.preventDefault()
    fireEvent(document, event)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("does not reopen the launcher from a held key after it closes", () => {
    renderSidebar()
    pressShortcut({ metaKey: true })
    fireEvent.click(screen.getByRole("button", { name: "Close apps" }))

    expect(pressShortcut({ metaKey: true, repeat: true }).defaultPrevented).toBe(true)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    pressShortcut({ metaKey: true })
    expect(screen.getByRole("dialog", { name: "Apps launcher" })).toBeInTheDocument()
  })

  it("closes the launcher when the route changes", () => {
    const { rerender } = renderSidebar()
    pressShortcut({ metaKey: true })

    jest.mocked(usePathname).mockReturnValue("/leads")
    rerender(<Sidebar isCollapsed={false} onCollapse={jest.fn()} />)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it.each(["workflow", "imprenta", "agent"] as const)("closes Apps when Command+I opens AI Workspace from %s mode on the same route", (mode) => {
    const setRobotsViewMode = jest.fn()
    jest.mocked(useLayout).mockReturnValue({
      robotsViewMode: mode, setRobotsViewMode,
      isLayoutCollapsed: false, setIsLayoutCollapsed: jest.fn(),
    })
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams(mode === "agent" ? "" : `mode=${mode}`) as ReturnType<typeof useSearchParams>,
    )
    renderSidebar()
    pressShortcut({ metaKey: true })
    expect(screen.getByRole("dialog", { name: "Apps launcher" })).toBeInTheDocument()

    expect(pressShortcut({ metaKey: true, key: "i" }).defaultPrevented).toBe(true)
    expect(setRobotsViewMode).toHaveBeenCalledWith("agent")
    expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), "/robots")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("removes its keyboard listener on unmount", () => {
    const { unmount } = renderSidebar()
    unmount()
    expect(pressShortcut({ metaKey: true }).defaultPrevented).toBe(false)
  })
})