import { fireEvent, render, screen, within } from "@testing-library/react"
import { usePathname, useSearchParams } from "next/navigation"
import { RobotsNavItems } from "@/app/components/navigation/RobotsNavItems"
import { useLayout } from "@/app/context/LayoutContext"
import { navigateOrAssign } from "@/lib/navigation/stale-router"

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: () => "" }),
}))

jest.mock("@/app/context/LayoutContext", () => ({ useLayout: jest.fn() }))
jest.mock("@/app/context/ScreenAccessContext", () => ({
  useOptionalScreenAccess: () => null,
}))
jest.mock("@/lib/navigation/stale-router", () => ({ navigateOrAssign: jest.fn() }))
jest.mock("@/app/components/navigation/RobotsBadge", () => ({
  RobotsBadge: () => <span>3</span>,
}))
jest.mock("@/app/components/navigation/ModuleImage", () => ({ ModuleImage: () => null }))
jest.mock("@/app/components/navigation/NavigationLink", () => {
  const { forwardRef } = jest.requireActual<typeof import("react")>("react")
  return {
    NavigationLink: forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
      function NavigationLink({ onClick, ...props }, ref) {
        return <a ref={ref} {...props} onClick={(event) => {
          event.preventDefault()
          onClick?.(event)
        }} />
      },
    ),
  }
})

function pressShortcut(options: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "i", metaKey: true, bubbles: true, cancelable: true, ...options,
  })
  fireEvent(document, event)
  return event
}

describe("AI Workspace shortcut", () => {
  const setRobotsViewMode = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(usePathname).mockReturnValue("/robots")
    jest.mocked(useLayout).mockReturnValue({
      robotsViewMode: "workflow", setRobotsViewMode,
      isLayoutCollapsed: false, setIsLayoutCollapsed: jest.fn(),
    })
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("mode=workflow&artifact=true") as ReturnType<typeof useSearchParams>,
    )
  })

  it("shows the aligned Command+I hint next to the running-robots badge", () => {
    render(<RobotsNavItems isCollapsed={false} />)
    const workspace = screen.getByRole("link", { name: /AI Workspace/ })
    expect(workspace).toHaveAttribute("aria-keyshortcuts", "Meta+I Control+I")
    expect(workspace).toHaveAttribute("href", "/robots?artifact=true")
    const hint = within(workspace).getByLabelText("Command+I")
    expect(hint).toHaveTextContent("I")
    expect(hint).toHaveClass("self-center", "leading-none")
    expect(hint.parentElement).toHaveClass("ml-auto", "items-center", "gap-2")
    expect(within(hint.parentElement as HTMLElement).getByText("3")).toBeInTheDocument()
    expect(hint).toHaveClass("bg-muted", "text-muted-foreground")
  })

  it.each(["light", "dark"])("matches the selected item's foreground in %s mode", (theme) => {
    const originalClassName = document.documentElement.className
    document.documentElement.className = theme
    try {
      jest.mocked(useLayout).mockReturnValue({
        robotsViewMode: "agent", setRobotsViewMode,
        isLayoutCollapsed: false, setIsLayoutCollapsed: jest.fn(),
      })
      const { rerender } = render(<RobotsNavItems isCollapsed={false} />)
      const workspace = screen.getByRole("link", { name: /AI Workspace/ })
      const hint = within(workspace).getByLabelText("Command+I")
      expect(workspace).toHaveClass("bg-primary", "text-primary-foreground")
      expect(hint).toHaveClass("border-primary-foreground", "bg-primary-foreground", "text-primary")
      expect(hint).toHaveClass("[&_svg]:!text-primary", "[&_span]:!text-primary")
      expect(hint).not.toHaveClass("bg-muted", "text-muted-foreground")

      jest.mocked(useLayout).mockReturnValue({
        robotsViewMode: "imprenta", setRobotsViewMode,
        isLayoutCollapsed: false, setIsLayoutCollapsed: jest.fn(),
      })
      rerender(<RobotsNavItems isCollapsed={false} />)
      expect(hint).toHaveClass("bg-muted", "text-muted-foreground")
      expect(hint).not.toHaveClass("text-primary")
      expect(setRobotsViewMode).not.toHaveBeenCalled()
    } finally {
      document.documentElement.className = originalClassName
    }
  })

  it("keeps the selected item's collapsed tooltip on the normal popover colors", async () => {
    jest.mocked(useLayout).mockReturnValue({
      robotsViewMode: "agent", setRobotsViewMode,
      isLayoutCollapsed: true, setIsLayoutCollapsed: jest.fn(),
    })
    render(<RobotsNavItems isCollapsed />)
    const workspace = document.getElementById("tour-agents-nav") as HTMLElement
    fireEvent.focus(workspace.firstElementChild as HTMLElement)
    const tooltip = await screen.findByRole("tooltip")
    const hint = within(tooltip).getByLabelText("Command+I")
    expect(hint).toHaveClass("bg-muted", "text-muted-foreground")
    expect(hint).not.toHaveClass("text-primary-foreground")
  })

  it.each([
    {}, { metaKey: false, ctrlKey: true }, { key: "I" },
  ])("opens the agent view, preserves query parameters and resets breadcrumbs for %o", (options) => {
    render(<RobotsNavItems isCollapsed={false} />)
    const reset = jest.fn()
    window.addEventListener("navigation-history:reset", reset)
    try {
      expect(pressShortcut(options).defaultPrevented).toBe(true)
      expect(setRobotsViewMode).toHaveBeenCalledWith("agent")
      expect(reset).toHaveBeenCalledTimes(1)
      expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), "/robots?artifact=true")
    } finally {
      window.removeEventListener("navigation-history:reset", reset)
    }
  })

  it("uses the same agent-view activation when clicked", () => {
    render(<RobotsNavItems isCollapsed={false} />)
    fireEvent.click(screen.getByRole("link", { name: /AI Workspace/ }))
    expect(setRobotsViewMode).toHaveBeenCalledWith("agent")
  })

  it("opens the workspace while collapsed and shows the hint in its tooltip", async () => {
    render(<RobotsNavItems isCollapsed />)
    const workspace = document.getElementById("tour-agents-nav") as HTMLElement
    expect(workspace.querySelector("kbd")).not.toBeInTheDocument()
    fireEvent.focus(workspace.firstElementChild as HTMLElement)
    expect(within(await screen.findByRole("tooltip")).getByLabelText("Command+I")).toHaveTextContent("I")
    pressShortcut()
    expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), "/robots?artifact=true")
  })

  it.each([
    { metaKey: false }, { key: "a" }, { key: "n" },
    { shiftKey: true }, { altKey: true }, { isComposing: true },
  ])("ignores unrelated or modified keys for %o", (options) => {
    render(<RobotsNavItems isCollapsed={false} />)
    expect(pressShortcut(options).defaultPrevented).toBe(false)
    expect(navigateOrAssign).not.toHaveBeenCalled()
    expect(setRobotsViewMode).not.toHaveBeenCalled()
  })

  it("does not repeat navigation when holding the shortcut", () => {
    render(<RobotsNavItems isCollapsed={false} />)
    expect(pressShortcut({ repeat: true }).defaultPrevented).toBe(true)
    expect(navigateOrAssign).not.toHaveBeenCalled()
  })

  it("respects an event already handled by another component", () => {
    render(<RobotsNavItems isCollapsed={false} />)
    const event = new KeyboardEvent("keydown", { key: "i", metaKey: true, cancelable: true })
    event.preventDefault()
    fireEvent(document, event)
    expect(navigateOrAssign).not.toHaveBeenCalled()
  })

  it("updates its destination when query parameters change", () => {
    const { rerender } = render(<RobotsNavItems isCollapsed={false} />)
    jest.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("mode=imprenta&showTour=true") as ReturnType<typeof useSearchParams>,
    )
    rerender(<RobotsNavItems isCollapsed={false} />)
    pressShortcut()
    expect(navigateOrAssign).toHaveBeenCalledTimes(1)
    expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), "/robots?showTour=true")
  })

  it("removes the listener on unmount", () => {
    const { unmount } = render(<RobotsNavItems isCollapsed={false} />)
    unmount()
    expect(pressShortcut().defaultPrevented).toBe(false)
    expect(navigateOrAssign).not.toHaveBeenCalled()
  })
})