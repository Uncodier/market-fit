import { fireEvent, render, screen, within } from "@testing-library/react"
import { useSearchParams } from "next/navigation"
import NavigationPage from "@/app/navigation/page"
import { localeMessages } from "@/app/context/locale-catalog"
import { navigateOrAssign } from "@/lib/navigation/stale-router"

let mockRestricted = false
jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => localeMessages.en[key] ?? key }),
}))
jest.mock("@/app/components/navigation/use-sidebar-nav-keys", () => ({
  useSidebarNavKeys: () => new Set(),
}))
jest.mock("@/app/context/ScreenAccessContext", () => ({
  useOptionalScreenAccess: () => ({ canAccessNavKey: () => !mockRestricted }),
}))
jest.mock("@/lib/navigation/stale-router", () => ({ navigateOrAssign: jest.fn() }))
jest.mock("@/app/components/navigation/ModuleImage", () => ({ ModuleImage: () => null }))

beforeEach(() => {
  mockRestricted = false
  jest.mocked(navigateOrAssign).mockClear()
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
})

test("places Profile first in Settings and navigates to the account", () => {
  render(<NavigationPage />)
  const section = screen.getByRole("heading", { name: "Settings" }).parentElement!.parentElement!
  const tiles = within(section).getAllByRole("button")
  expect(tiles[0]).toHaveTextContent("Profile")
  fireEvent.click(tiles[0])
  expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), "/profile")
})

test("keeps Profile reachable for users restricted from workspace screens", () => {
  mockRestricted = true
  render(<NavigationPage />)
  const profile = screen.getByRole("button", { name: "Profile" })
  fireEvent.keyDown(profile, { key: "Enter" })
  expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), "/profile")
})