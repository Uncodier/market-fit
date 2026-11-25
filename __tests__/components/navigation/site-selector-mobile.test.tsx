import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { SiteSelector } from "@/app/components/navigation/SiteSelector"
import type { Site } from "@/app/context/site-types"

const currentSite = { id: "site-a", user_id: "user-a", name: "Current site", url: "https://current.example.test" } as Site
const sharedSite = { id: "site-b", user_id: "user-b", name: "Shared site" } as Site
const mockSelectSite = jest.fn()
const mockNavigate = jest.fn()
const mockRefresh = jest.fn()
let mockSites: Site[]

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({
  currentSite, sites: mockSites, setCurrentSite: mockSelectSite, refreshSites: mockRefresh,
  requestScope: { actorId: "user-a", siteId: currentSite.id }, isLoading: false,
}) }))
jest.mock("@/app/components/auth/auth-context", () => ({ useAuthContext: () => ({ user: { id: "user-a" }, isLoading: false }) }))
jest.mock("@/app/context/use-project-list-logos", () => ({ useProjectListLogos: () => ({}) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/lib/navigation/stale-router", () => ({ navigateOrAssign: (...args: unknown[]) => mockNavigate(...args) }))

beforeEach(() => {
  jest.clearAllMocks()
  mockSites = [currentSite, sharedSite]
  mockRefresh.mockResolvedValue(undefined)
})

it("uses a full-width mobile trigger and switches sites from the filtered dialog", () => {
  render(<SiteSelector isMobile />)
  const trigger = screen.getByRole("button", { name: "Current site" })
  expect(trigger).toHaveClass("w-full", "min-h-16")
  expect(trigger).toHaveAttribute("aria-haspopup", "dialog")
  fireEvent.click(trigger)
  const dialog = screen.getByRole("dialog", { name: "layout.sidebar.switchProject" })
  expect(within(dialog).getByRole("button", { name: /Current site/ })).toHaveAttribute("aria-current", "true")
  fireEvent.mouseDown(within(dialog).getByRole("tab", { name: "layout.sidebar.shared" }), { button: 0 })
  expect(within(dialog).queryByRole("button", { name: /Current site/ })).not.toBeInTheDocument()
  fireEvent.click(within(dialog).getByRole("button", { name: /Shared site/ }))
  expect(mockSelectSite).toHaveBeenCalledWith(sharedSite)
  expect(mockNavigate).toHaveBeenCalledWith(expect.anything(), "/robots")
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
})

it("retains the dropdown on desktop and dismisses the mobile dialog with Escape", async () => {
  const view = render(<SiteSelector />)
  const desktopTrigger = screen.getByRole("button", { name: "Current site" })
  expect(desktopTrigger).toHaveAttribute("aria-haspopup", "menu")
  const name = within(desktopTrigger).getByText(currentSite.name)
  expect(name.parentElement).toHaveClass("text-left")
  expect(name.parentElement).toContainElement(within(desktopTrigger).getByText(currentSite.url!))
  view.rerender(<SiteSelector isMobile />)
  fireEvent.click(screen.getByRole("button", { name: "Current site" }))
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole("button", { name: "Current site" })).toHaveFocus())
})