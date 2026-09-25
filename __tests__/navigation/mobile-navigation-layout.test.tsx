import { render, screen, within } from "@testing-library/react"
import NavigationPage from "@/app/navigation/page"
import { getModuleImageUrl } from "@/app/config/module-image-visuals"

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    t: (key: string) => key,
  }),
}))

jest.mock("@/app/components/navigation/use-sidebar-nav-keys", () => ({
  useSidebarNavKeys: () => new Set<string>(),
}))

jest.mock("@/app/context/ScreenAccessContext", () => ({
  useOptionalScreenAccess: () => null,
}))

jest.mock("@/lib/navigation/stale-router", () => ({
  navigateOrAssign: jest.fn(),
}))

describe("mobile navigation layout", () => {
  it("gives search the available header width and shows three module columns", () => {
    render(<NavigationPage />)

    const search = screen.getByPlaceholderText("Search...")
    const searchContainer = search.parentElement?.parentElement?.parentElement
    expect(searchContainer).toHaveClass("w-full", "md:w-[280px]")

    const firstTile = document.querySelector('[id^="tour-app-"]')
    expect(firstTile).toHaveClass("w-full", "md:w-[112px]")
    expect(firstTile?.parentElement).toHaveClass(
      "grid",
      "grid-cols-3",
      "md:flex",
    )
  })

  it("shows Home as the first app in Automation", () => {
    render(<NavigationPage />)

    const automationHeading = screen.getByRole("heading", { name: "automation" })
    const automationSection = automationHeading.parentElement?.parentElement
    expect(automationSection).toBeTruthy()

    const automationTiles = within(automationSection as HTMLElement).getAllByRole(
      "button",
    )
    expect(automationTiles[0]).toHaveAttribute("id", "tour-app-salesHome")
    expect(within(automationTiles[0]).getByText("Home")).toBeInTheDocument()
    expect(within(automationTiles[0]).getByAltText("Home app icon")).toHaveAttribute(
      "src",
      getModuleImageUrl("automation", "aiWorkspace", "Home"),
    )
  })
})
