import { readFileSync } from "fs"
import path from "path"
import { render, screen } from "@testing-library/react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/app/components/navigation/Sidebar"

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => null,
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
jest.mock("@/app/components/navigation/RobotsNavItems", () => ({
  RobotsNavItems: () => <a href="/robots">AI Workspace</a>,
}))
jest.mock("@/app/components/navigation/DynamicShortcuts", () => ({ DynamicShortcuts: () => null }))
jest.mock("@/app/components/navigation/OnboardingProgressWidget", () => ({ OnboardingProgressWidget: () => null }))
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
    jest.mocked(usePathname).mockReturnValue("/robots")
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
      const link = screen.getByRole("link", { name })
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
    const account = screen.getByRole("link", { name: "layout.sidebar.account" })
    const footer = account.closest(".flex-none")

    expect(sidebar).toHaveAttribute("data-collapsed", "false")
    expect(footer).toHaveClass("pb-[env(safe-area-inset-bottom,0px)]", "md:pb-0")
    expect(sidebar.children[1]).toHaveClass("flex-none")
  })
})