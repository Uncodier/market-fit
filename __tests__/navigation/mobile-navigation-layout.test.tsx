import { fireEvent, render, screen, within } from "@testing-library/react"
import NavigationPage from "@/app/navigation/page"
import { getModuleImageUrl } from "@/app/config/module-image-visuals"
import { navigateOrAssign } from "@/lib/navigation/stale-router"
import { rawLocaleMessages } from "@/app/context/locale-catalog"
import type { SupportedLocale } from "@/app/context/locale-preferences"

let mockLocale: SupportedLocale = "en"

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    t: (key: string) => key.startsWith("layout.sidebar.leads")
      ? rawLocaleMessages[mockLocale][key] : key,
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
  beforeEach(() => {
    mockLocale = "en"
    jest.clearAllMocks()
  })

  it.each([
    ["en", "Customers"], ["es", "Clientes"], ["fr", "Clients"],
    ["de", "Kunden"], ["ja", "顧客"],
  ] as const)("shows and finds customers in %s while keeping the leads destination", (locale, title) => {
    mockLocale = locale
    expect(rawLocaleMessages[locale]["layout.sidebar.leads"]).toBe(title)
    expect(rawLocaleMessages[locale]["layout.nav.leads.title"]).toBe(title)
    render(<NavigationPage />)

    const customersTile = screen.getByRole("button", { name: new RegExp(title) })
    expect(customersTile).toHaveAttribute("id", "tour-app-leads")
    expect(within(customersTile).getByText(title)).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("Search..."), {
      target: { value: title.toLowerCase() },
    })

    expect(screen.getByRole("button", { name: new RegExp(title) })).toBeInTheDocument()
    expect(screen.queryByText("Contacts")).not.toBeInTheDocument()
    fireEvent.click(customersTile)
    expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), "/leads")
  })

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

  it("opens AI Workspace from the first Automation app", () => {
    render(<NavigationPage />)

    const automationHeading = screen.getByRole("heading", { name: "automation" })
    const automationSection = automationHeading.parentElement?.parentElement
    expect(automationSection).toBeTruthy()

    const automationTiles = within(automationSection as HTMLElement).getAllByRole(
      "button",
    )
    expect(automationTiles[0]).toHaveAttribute("id", "tour-app-aiWorkspace")
    expect(within(automationTiles[0]).getByText("AI Workspace")).toBeInTheDocument()
    expect(within(automationTiles[0]).getByAltText("AI Workspace app icon")).toHaveAttribute(
      "src",
      getModuleImageUrl("automation", "aiWorkspace", "AI Workspace"),
    )
    fireEvent.click(automationTiles[0])
    expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), "/robots")
  })

  it("shows Accounts Receivable after Subscriptions in Sales with its shared image and opens its route", () => {
    render(<NavigationPage />)

    const heading = screen.getByRole("heading", { name: "sales" })
    const section = heading.parentElement?.parentElement as HTMLElement
    const tile = within(section).getByRole("button", { name: /Accounts Receivable/ })
    const tiles = within(section).getAllByRole("button")
    expect(tiles[tiles.indexOf(tile) - 1]).toHaveAttribute("id", "tour-app-subscriptions")
    expect(screen.getAllByRole("button", { name: /Accounts Receivable/ })).toHaveLength(1)
    expect(tile).toHaveAttribute("id", "tour-app-accountsReceivable")
    expect(within(tile).getByAltText("Accounts Receivable app icon")).toHaveAttribute(
      "src", getModuleImageUrl("sales", "accountsReceivable", "Accounts Receivable"),
    )
    fireEvent.click(tile)
    expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), "/accounts-receivable")
  })

  it("finds Accounts Receivable by search and supports keyboard navigation", () => {
    render(<NavigationPage />)

    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "receivable" } })
    const tile = screen.getByRole("button", { name: /Accounts Receivable/ })
    expect(screen.queryByRole("button", { name: /Subscriptions/ })).not.toBeInTheDocument()
    fireEvent.keyDown(tile, { key: "Enter" })
    expect(navigateOrAssign).toHaveBeenCalledWith(expect.anything(), "/accounts-receivable")
  })
})
