import { render, screen } from "@testing-library/react"
import NavigationPage from "@/app/navigation/page"

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
})
