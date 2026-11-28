import { readFileSync } from "fs"
import path from "path"
import { fireEvent, render, screen } from "@testing-library/react"
import { usePathname, useSearchParams } from "next/navigation"
import { Sidebar } from "@/app/components/navigation/Sidebar"
import LayoutClient from "@/app/layout-client"
import { LayoutProvider } from "@/app/context/LayoutContext"
import { WORKSPACE_SIDEBAR_MODE_KEY } from "@/app/components/navigation/workspace-sidebar-mode"
import { DynamicShortcuts } from '@/app/components/navigation/DynamicShortcuts'
import { NotificationBadge } from '@/app/components/navigation/NotificationBadge'
import { OnboardingProgressWidget } from '@/app/components/navigation/OnboardingProgressWidget'
import { StartupTrialWidget } from '@/app/components/navigation/StartupTrialWidget'

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => null,
}))

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))

let mockMobile = true
jest.mock("@/app/hooks/use-mobile-view", () => ({ useMobileViewport: () => mockMobile }))
jest.mock("@/app/workspace-preview/WorkspaceStartupBoundary", () => ({
  useWorkspaceStartup: () => null,
  WorkspaceStartupBoundary: ({ children }: React.PropsWithChildren) => children,
  WorkspaceStartupContent: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock("@/app/notifications/context/NotificationsContext", () => ({
  NotificationsProvider: ({ children }: React.PropsWithChildren) => children,
}))
jest.mock("@/app/components/onboarding/GuidedTour", () => ({ GuidedTour: () => null }))
jest.mock("@/app/components/navigation/ScreenAccessRedirect", () => ({ ScreenAccessRedirect: () => null }))
jest.mock("@/app/components/navigation/MobileWorkspaceNavigation", () => ({ MobileWorkspaceNavigation: () => null }))
jest.mock("@/app/components/navigation/PosTopBarActions", () => ({ PosTopBarActions: () => null }))
jest.mock("@/app/components/navigation/PosTopBarSync", () => ({ PosTopBarSync: () => null }))
jest.mock("@/app/hooks/use-prevent-refresh", () => ({ usePageRefreshPrevention: jest.fn() }))
jest.mock("@/app/hooks/use-wake-session-refresh", () => ({ useWakeSessionRefresh: jest.fn() }))
jest.mock("@/app/hooks/use-navigation-feedback", () => ({ useNavigationFeedback: jest.fn() }))
jest.mock("@/app/hooks/use-artifact-router-patch", () => ({ useArtifactRouterPatch: jest.fn() }))
jest.mock("@/app/hooks/use-breadcrumb-history", () => ({
  useNavigationHistory: () => ({ items: [], navigateTo: jest.fn(), hasHistory: false }),
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

jest.mock("@/app/components/navigation/SiteSelector", () => ({ SiteSelector: () => <div data-testid="site-selector" /> }))
jest.mock("@/app/components/navigation/ConfigurationSection", () => ({ ConfigurationSection: () => null }))
jest.mock("@/app/components/navigation/NotificationBadge", () => ({ NotificationBadge: jest.fn(() => null) }))
jest.mock("@/app/components/navigation/RobotsBadge", () => ({ RobotsBadge: () => null }))
jest.mock("@/app/components/navigation/DynamicShortcuts", () => ({ DynamicShortcuts: jest.fn(() => null) }))
jest.mock("@/app/components/navigation/OnboardingProgressWidget", () => ({ OnboardingProgressWidget: jest.fn(() => null) }))
jest.mock("@/app/components/navigation/StartupTrialWidget", () => ({ StartupTrialWidget: jest.fn(() => null) }))
jest.mock("@/app/components/navigation/CreditsWidget", () => ({ CreditsWidget: () => null }))

const layoutSource = readFileSync(path.join(process.cwd(), "app/layout-client.tsx"), "utf8")
const layoutSidebarClassName = layoutSource.match(/<Sidebar\b[\s\S]*?className="([^"]+)"/)?.[1]

function renderMobileSidebar(isCollapsed = false) {
  const result = render(
    <Sidebar
      isCollapsed={isCollapsed}
      onCollapse={jest.fn()}
      isMobileOpen
      className={layoutSidebarClassName}
    />,
    { wrapper: LayoutProvider },
  )
  const sidebar = result.container.querySelector("[data-collapsed]") as HTMLElement
  return { ...result, sidebar }
}

function workspace() {
  return <LayoutProvider><LayoutClient><div>Workspace content</div></LayoutClient></LayoutProvider>
}

function movePointer(clientX: number, pointerType = "mouse", buttons = 0) {
  const event = new MouseEvent("pointermove", { clientX, buttons })
  Object.defineProperty(event, "pointerType", { value: pointerType })
  fireEvent(window, event)
}

describe("mobile sidebar viewport", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.removeItem(WORKSPACE_SIDEBAR_MODE_KEY)
    mockMobile = true
    jest.mocked(usePathname).mockReturnValue("/robots")
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
  })

  it("opens the existing sidebar from the top-bar menu beside the Makinari mark", () => {
    const view = render(workspace())
    const trigger = screen.getByRole("button", { name: "common.openMenu" })
    expect(trigger.querySelector(".topbar-menu-icon > svg")).toBeInTheDocument()
    const mark = screen.getByRole("img", { name: "Makinari" })
    expect(mark).toHaveAttribute("src", "/images/isotipo.svg")
    expect(mark).toHaveAttribute("width", "24")
    expect(mark).toHaveAttribute("height", "28")
    expect(mark).toHaveClass("h-7", "w-auto", "shrink-0")
    expect(trigger.parentElement).toContainElement(mark)
    const sidebar = document.getElementById(trigger.getAttribute("aria-controls")!)
    expect(sidebar).toHaveClass("!hidden", "md:!flex")
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(sidebar).not.toHaveClass("!hidden")
    expect(sidebar).toHaveClass("w-80", "max-md:max-w-[calc(100%-2.75rem)]", "max-md:z-[230]")
    expect(screen.getByRole("link", { name: /Apps/ })).toHaveAttribute("href", "/navigation")

    expect(screen.queryByRole("button", { name: "common.close" })).not.toBeInTheDocument()
    fireEvent.click(view.container.querySelector("[data-mobile-sidebar-backdrop]")!)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(trigger)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(trigger)
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("mode=workflow") as ReturnType<typeof useSearchParams>)
    view.rerender(workspace())
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(trigger)
    mockMobile = false
    view.rerender(workspace())
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(sidebar).toHaveClass("md:!flex")
  })

  it("keeps mobile shortcut tracking mounted without starting hidden badge or widget readers", () => {
    const props = { isCollapsed: false, onCollapse: jest.fn(), desktopVisible: false, isMobile: true }
    const view = render(<Sidebar {...props} />, { wrapper: LayoutProvider })
    expect(jest.mocked(DynamicShortcuts).mock.calls[0]?.[0]).toMatchObject({ isMobile: true })
    for (const reader of [NotificationBadge, OnboardingProgressWidget, StartupTrialWidget]) expect(reader).not.toHaveBeenCalled()
    view.rerender(<Sidebar {...props} isMobileOpen />)
    expect(DynamicShortcuts).toHaveBeenCalled(); expect(NotificationBadge).toHaveBeenCalled()
    expect(OnboardingProgressWidget).not.toHaveBeenCalled(); expect(StartupTrialWidget).not.toHaveBeenCalled()
    view.rerender(<Sidebar {...props} desktopVisible isMobile={false} />)
    expect(OnboardingProgressWidget).toHaveBeenCalled(); expect(StartupTrialWidget).toHaveBeenCalled()
  })

  it("keeps Content Creator and Workflows fixed only on desktop", () => {
    const { rerender } = renderMobileSidebar()
    expect(screen.getByRole("link", { name: /layout\.sidebar\.agents/ })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /layout\.sidebar\.(imprenta|workflows)/ })).not.toBeInTheDocument()

    rerender(<Sidebar isCollapsed={false} onCollapse={jest.fn()} />)
    expect(screen.getByRole("link", { name: /layout\.sidebar\.imprenta/ })).toHaveAttribute("href", "/robots?mode=imprenta")
    expect(screen.getByRole("link", { name: /layout\.sidebar\.workflows/ })).toHaveAttribute("href", "/robots?mode=workflow")
  })

  it("keeps the dynamic viewport height with the actual workspace layout classes", () => {
    expect(layoutSidebarClassName).toBeDefined()
    const { sidebar } = renderMobileSidebar()

    expect(sidebar).toHaveClass("h-[100dvh]")
    expect(sidebar).not.toHaveClass("h-screen")
  })

  it("allows the entire mobile menu to scroll without clipping its footer", () => {
    const { sidebar } = renderMobileSidebar()

    expect(sidebar).toHaveClass("overflow-y-auto", "overflow-x-hidden", "overscroll-y-contain")
    expect(sidebar).not.toHaveClass("overflow-hidden")
    for (const name of ["layout.sidebar.agents", "layout.sidebar.notifications", "layout.sidebar.account"]) {
      const link = screen.getByRole("link", { name: new RegExp(name) })
      expect(link.closest(".overflow-y-auto")).toBe(sidebar)
    }
  })

  it("keeps central scrolling on desktop but avoids a nested mobile scroll area", () => {
    const { sidebar } = renderMobileSidebar()
    const mainMenu = sidebar.querySelector(".flex-1")

    expect(sidebar).toHaveClass("md:overflow-hidden")
    expect(mainMenu).toHaveClass("shrink-0", "overflow-visible", "md:min-h-0", "md:shrink", "md:overflow-y-auto")
    expect(mainMenu).not.toHaveClass("overflow-y-auto")
  })

  it("reserves bottom safe-area space and expands the mobile menu even when desktop is collapsed", () => {
    const { sidebar } = renderMobileSidebar(true)
    const account = screen.getByRole("link", { name: /layout\.sidebar\.account/ })
    const footer = account.closest(".flex-none")

    expect(sidebar).toHaveAttribute("data-collapsed", "false")
    expect(footer).toHaveClass("pb-[env(safe-area-inset-bottom,0px)]", "md:pb-0")
    expect(screen.getByTestId("site-selector").parentElement).toHaveClass("flex-none")
  })
})

describe("desktop sidebar auto-hide", () => {
  beforeEach(() => {
    mockMobile = false
    localStorage.clear()
    jest.mocked(usePathname).mockReturnValue("/robots")
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
  })

  it("reveals the compact blur overlay at the edge without reserving space", () => {
    localStorage.setItem("sidebarCollapsed", "false")
    render(workspace())
    const sidebar = document.getElementById("workspace-sidebar")!
    const content = screen.getByText("Workspace content").closest("main")!.parentElement
    expect(sidebar).toHaveAttribute("data-sidebar-mode", "hidden")
    expect(sidebar).toHaveAttribute("inert")
    expect(sidebar).toHaveClass("-translate-x-full", "pointer-events-none")
    expect(content).toHaveStyle({ paddingLeft: "0px" })
    movePointer(12)
    movePointer(2, "touch")
    movePointer(2, "mouse", 1)
    expect(sidebar).toHaveAttribute("inert")

    movePointer(2)
    expect(sidebar).not.toHaveAttribute("inert")
    expect(sidebar).toHaveClass("md:w-16", "backdrop-blur-[5px]")
    movePointer(42)
    expect(sidebar).not.toHaveAttribute("inert")
    expect(content).toHaveStyle({ paddingLeft: "0px" })
    expect(localStorage.getItem(WORKSPACE_SIDEBAR_MODE_KEY)).toBe("hidden")

    movePointer(65)
    expect(sidebar).toHaveAttribute("inert")
    movePointer(2)
    fireEvent(window, new MouseEvent("pointerout"))
    expect(sidebar).toHaveAttribute("inert")
  })

  it("pins from the hover preview, expands, and returns to hidden", () => {
    render(workspace())
    const sidebar = document.getElementById("workspace-sidebar")!
    const topBar = screen.getByRole("button", { name: "Pin compact sidebar" }).closest("[data-topbar]")!
    movePointer(2)
    fireEvent.click(screen.getAllByRole("button", { name: "Pin compact sidebar" }).find(button => sidebar.contains(button))!)
    expect(sidebar).toHaveAttribute("data-sidebar-mode", "compact")
    expect(topBar).toHaveStyle({ paddingLeft: "64px" })
    movePointer(90)
    expect(sidebar).not.toHaveAttribute("inert")
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(sidebar).toHaveAttribute("data-sidebar-mode", "expanded")
    expect(topBar).toHaveStyle({ paddingLeft: "256px" })
    fireEvent.click(screen.getByRole("button", { name: "Auto-hide sidebar" }))
    expect(sidebar).toHaveAttribute("inert")
    expect(topBar).toHaveStyle({ paddingLeft: "0px" })
  })

  it("hides the hover preview after clicking a navigation item without pinning it", () => {
    const view = render(workspace())
    const sidebar = document.getElementById("workspace-sidebar")!
    movePointer(2)
    movePointer(32)
    fireEvent.click(screen.getByRole("link", { name: /layout\.sidebar\.workflows/ }))
    expect(sidebar).toHaveAttribute("inert")

    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("mode=workflow") as ReturnType<typeof useSearchParams>)
    view.rerender(workspace())
    expect(sidebar).toHaveAttribute("inert")
    expect(localStorage.getItem(WORKSPACE_SIDEBAR_MODE_KEY)).toBe("hidden")
    movePointer(2)
    expect(sidebar).not.toHaveAttribute("inert")
  })

  it("dismisses the preview on a route change and waits for the pointer to re-enter the edge", () => {
    const view = render(workspace())
    const sidebar = document.getElementById("workspace-sidebar")!
    movePointer(2)
    jest.mocked(usePathname).mockReturnValue("/notifications")
    view.rerender(workspace())
    expect(sidebar).toHaveAttribute("inert")
    movePointer(3)
    expect(sidebar).toHaveAttribute("inert")
    movePointer(22)
    movePointer(2)
    expect(sidebar).not.toHaveAttribute("inert")
  })

  it("restores a pinned preference and lets the top-bar control pin without hover", () => {
    const view = render(workspace())
    fireEvent.click(screen.getByRole("button", { name: "Pin compact sidebar" }))
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }))
    expect(localStorage.getItem(WORKSPACE_SIDEBAR_MODE_KEY)).toBe("expanded")
    view.unmount()
    render(workspace())
    expect(document.getElementById("workspace-sidebar")).toHaveAttribute("data-sidebar-mode", "expanded")
  })
})