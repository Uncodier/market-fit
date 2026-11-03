import { fireEvent, render, screen } from "@testing-library/react"
import NavigationPage from "@/app/navigation/page"
import { navigateOrAssign } from "@/lib/navigation/stale-router"

jest.mock("@/lib/navigation/stale-router", () => ({ navigateOrAssign: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => ({
  "catalog.modifiers.groupsTitle": "Modifier groups",
  "layout.category.operations": "Operations",
}[key] ?? key) }) }))
jest.mock("@/app/context/ScreenAccessContext", () => ({ useOptionalScreenAccess: () => ({ canAccessNavKey: () => true }) }))
jest.mock("@/app/components/navigation/use-sidebar-nav-keys", () => ({ useSidebarNavKeys: () => new Set() }))

beforeEach(() => jest.mocked(navigateOrAssign).mockClear())

test.each([false, true])("launcher displays modifier groups in Operations with its generated image (overlay=%s)", isOverlay => {
  const onClose = jest.fn()
  render(<NavigationPage isOverlay={isOverlay} onClose={onClose} />)
  const tile = screen.getByRole("button", { name: /Modifier groups/ })
  const operations = screen.getByRole("heading", { name: "Operations" }).parentElement!.parentElement!
  expect(operations).toContainElement(tile)
  expect(screen.getByRole("img", { name: "Modifier groups app icon" }))
    .toHaveAttribute("src", "/api/images/modules/modifierGroups")
  fireEvent.click(tile)
  expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), "/catalog/modifier-groups")
  expect(onClose).toHaveBeenCalledTimes(1)
})