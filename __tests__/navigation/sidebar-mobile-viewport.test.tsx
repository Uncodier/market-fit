import { readFileSync } from "fs"
import path from "path"
import { fireEvent, render, screen } from "@testing-library/react"
import { usePathname, useSearchParams } from "next/navigation"
import { Sidebar } from "@/app/components/navigation/Sidebar"
import LayoutClient from "@/app/layout-client"
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
jest.mock("@/app/context/LayoutContext", () => ({
  useLayout: () => ({ isLayoutCollapsed: true, setIsLayoutCollapsed: jest.fn() }),
}))
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
jest.mock("@/app/components/navigation/TopBarTitle", () => ({ TopBarTitle: () => null }))
jest.mock("@/app/components/navigation/PosTopBarActions", () => ({ PosTopBarActions: () => null }))
jest.mock("@/app/components/navigation/PosTopBarSync", () => ({ PosTopBarSync: () => null }))
jest.mock("@/app/hooks/use-prevent-refresh", () => ({ usePageRefreshPrevention: jest.fn() }))
jest.mock("@/app/hooks/use-wake-session-refresh", () => ({ useWakeSessionRefresh: jest.fn() }))
jest.mock("@/app/hooks/use-navigation-feedback", () => ({ useNavigationFeedback: jest.fn() }))
jest.mock("@/app/hooks/use-artifact-router-patch", () => ({ useArtifactRouterPatch: jest.fn() }))

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
jest.mock("@/app/components/navigation/RobotsNavItems", () => ({
  RobotsNavItems: () => <a href="/robots">AI Workspace</a>,
}))
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
  )
  const sidebar = result.container.querySelector("[data-collapsed]") as HTMLElement
  return { ...result, sidebar }
}

describe("mobile sidebar viewport", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMobile = true
    jest.mocked(usePathname).mockReturnValue("/robots")
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
  })

  it("opens the existing sidebar from the top-bar menu beside the Makinari mark", () => {
    const ui = <LayoutClient><div>Workspace content</div></LayoutClient>
    const view = render(ui)
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
    view.rerender(<LayoutClient><div>Workspace content</div></LayoutClient>)
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(trigger)
    mockMobile = false
    view.rerender(<LayoutClient><div>Workspace content</div></LayoutClient>)
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(sidebar).toHaveClass("md:!flex")
  })

  it("keeps mobile shortcut tracking mounted without starting hidden badge or widget readers", () => {
    const props = { isCollapsed: false, onCollapse: jest.fn(), desktopVisible: false, isMobile: true }
    const view = render(<Sidebar {...props} />)
    expect(jest.mocked(DynamicShortcuts).mock.calls[0]?.[0]).toMatchObject({ isMobile: true })
    for (const reader of [NotificationBadge, OnboardingProgressWidget, StartupTrialWidget]) expect(reader).not.toHaveBeenCalled()
    view.rerender(<Sidebar {...props} isMobileOpen />)
    expect(DynamicShortcuts).toHaveBeenCalled(); expect(NotificationBadge).toHaveBeenCalled()
    expect(OnboardingProgressWidget).not.toHaveBeenCalled(); expect(StartupTrialWidget).not.toHaveBeenCalled()
    view.rerender(<Sidebar {...props} desktopVisible isMobile={false} />)
    expect(OnboardingProgressWidget).toHaveBeenCalled(); expect(StartupTrialWidget).toHaveBeenCalled()
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
    for (const name of ["AI Workspace", "layout.sidebar.notifications", "layout.sidebar.account"]) {
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