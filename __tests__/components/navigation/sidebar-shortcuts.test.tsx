import { createEvent, fireEvent, render, screen } from "@testing-library/react"
import { Sidebar } from "@/app/components/navigation/Sidebar"

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => function NavigationOverlay() {
    return <div data-testid="navigation-overlay" />
  },
}))
jest.mock("@/app/hooks/use-auth", () => ({ useAuth: () => ({ user: null }) }))
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}))
jest.mock("@/app/components/navigation/ConfigurationSection", () => ({ ConfigurationSection: () => null }))
jest.mock("@/app/components/navigation/SiteSelector", () => ({ SiteSelector: () => null }))
jest.mock("@/app/components/navigation/NotificationBadge", () => ({ NotificationBadge: () => null }))
jest.mock("@/app/components/navigation/RobotsNavItems", () => ({ RobotsNavItems: () => null }))
jest.mock("@/app/components/navigation/DynamicShortcuts", () => ({ DynamicShortcuts: () => null }))
jest.mock("@/app/components/navigation/NavigationAreaGroups", () => ({ NavigationAreaGroups: () => null }))
jest.mock("@/app/components/navigation/OnboardingProgressWidget", () => ({ OnboardingProgressWidget: () => null }))
jest.mock("@/app/components/navigation/CreditsWidget", () => ({ CreditsWidget: () => null }))
jest.mock("@/app/components/navigation/StartupTrialWidget", () => ({ StartupTrialWidget: () => null }))
jest.mock("@/app/components/navigation/MenuItem", () => ({
  MenuItem: ({ title, onClick }: { title: string; onClick?: React.MouseEventHandler<HTMLButtonElement> }) => (
    <button onClick={onClick}>{title}</button>
  ),
}))
jest.mock("@/app/components/navigation/NavigationLink", () => ({
  NavigationLink: (props: React.ComponentProps<"a">) => <a {...props} />,
}))

describe.each(["metaKey", "ctrlKey"] as const)("Apps shortcut with %s", (modifier) => {
  function renderSidebar() {
    return render(<Sidebar isCollapsed={false} onCollapse={jest.fn()} />)
  }

  function shortcut(target: Element | Document, options: KeyboardEventInit = {}) {
    const event = createEvent.keyDown(target, { key: "a", [modifier]: true, ...options })
    fireEvent(target, event)
    return event
  }

  test.each(["input", "textarea", "select", "contenteditable", "nested-editor", "plaintext-editor"])(
    "preserves native select-all in %s without opening navigation",
    (kind) => {
      const view = renderSidebar()
      const element = document.createElement(
        ["input", "textarea", "select"].includes(kind) ? kind : "div"
      )
      let target = element
      if (kind.includes("editor") || kind === "contenteditable") {
        element.setAttribute("contenteditable", kind === "plaintext-editor" ? "plaintext-only" : "true")
        if (kind === "nested-editor") {
          target = document.createElement("span")
          element.append(target)
        }
      }
      view.container.append(element)
      element.focus()

      expect(shortcut(target).defaultPrevented).toBe(false)
      expect(screen.queryByTestId("navigation-overlay")).not.toBeInTheDocument()
    }
  )

  test("also respects an editable active element when the event targets document", () => {
    const view = renderSidebar()
    const input = document.createElement("input")
    view.container.append(input)
    input.focus()

    expect(shortcut(document).defaultPrevented).toBe(false)
    expect(screen.queryByTestId("navigation-overlay")).not.toBeInTheDocument()
  })

  test("opens navigation outside editable fields", () => {
    renderSidebar()
    expect(shortcut(document).defaultPrevented).toBe(true)
    expect(screen.getByTestId("navigation-overlay")).toBeInTheDocument()
  })

  test("does not open navigation for a repeated shortcut", () => {
    renderSidebar()
    shortcut(document, { repeat: true })
    expect(screen.queryByTestId("navigation-overlay")).not.toBeInTheDocument()
  })
})

test("still opens navigation by clicking Apps", () => {
  render(<Sidebar isCollapsed={false} onCollapse={jest.fn()} />)
  fireEvent.click(screen.getByRole("button", { name: "Apps" }))
  expect(screen.getByTestId("navigation-overlay")).toBeInTheDocument()
})