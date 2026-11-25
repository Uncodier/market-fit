import { act, fireEvent, render, screen } from "@testing-library/react"
import { usePathname, useSearchParams } from "next/navigation"
import { MobileWorkspaceNavigation } from "@/app/components/navigation/MobileWorkspaceNavigation"
import { resolveMobileWorkspaceTab, updateMobileWorkspaceTabs } from "@/app/components/navigation/mobile-workspace-tabs"
import { localeMessages } from "@/app/context/locale-catalog"
import { loadShortcuts, loadShortcutsFromLocalStorage } from "@/app/components/navigation/shortcut-storage"
import type { ShortcutRecord } from "@/app/components/navigation/shortcut-types"

jest.mock("@/app/components/navigation/shortcut-storage", () => ({
  loadShortcuts: jest.fn(),
  loadShortcutsFromLocalStorage: jest.fn(),
  SHORTCUTS_UPDATED_EVENT: "shortcuts-updated",
}))

let mockSiteId = "site-a"
let mockLocale: keyof typeof localeMessages = "en"
let mockUserId = "user-a"
let mockLoading = false
let mockBlocked: string[] = []
const mockSetMode = jest.fn()

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({ t: (key: string) => localeMessages[mockLocale][key] ?? key }),
}))
jest.mock("@/app/context/LayoutContext", () => ({
  useLayout: () => ({ setRobotsViewMode: mockSetMode }),
}))
jest.mock("@/app/context/SiteContext", () => ({
  useSite: () => ({ currentSite: { id: mockSiteId }, isLoading: mockLoading }),
}))
jest.mock("@/app/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: mockUserId, user_metadata: mockUserMetadata }, isLoading: mockLoading }),
}))
jest.mock("@/app/context/ScreenAccessContext", () => ({
  useOptionalScreenAccess: () => ({ canAccessNavKey: (key: string) => !mockBlocked.includes(key) }),
}))
jest.mock("@/app/components/navigation/NavigationLink", () => ({
  NavigationLink: ({ onNavigate, ...props }: React.ComponentProps<"a"> & { onNavigate?: () => void }) => (
    <a {...props} onClick={(event) => { event.preventDefault(); onNavigate?.() }} />
  ),
}))

function setRoute(path: string) {
  const [pathname, query] = path.split("?")
  jest.mocked(usePathname).mockReturnValue(pathname)
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as ReturnType<typeof useSearchParams>)
}

let mockUserMetadata: { avatar_url?: string; picture?: string }

beforeEach(() => {
  mockSiteId = "site-a"
  mockLocale = "en"
  mockUserId = "user-a"
  mockUserMetadata = {}
  mockLoading = false
  mockBlocked = []
  mockSetMode.mockClear()
  jest.mocked(loadShortcuts).mockReset().mockImplementation(() => new Promise(() => {}))
  jest.mocked(loadShortcutsFromLocalStorage).mockReset().mockReturnValue([])
  setRoute("/robots")
})

test("starts with labeled AI Workspace centered and the profile avatar in the last fixed slot", () => {
  render(<MobileWorkspaceNavigation />)
  const nav = screen.getByRole("navigation", { name: "Workspace navigation" })
  const slots = nav.firstElementChild!.children
  expect(slots).toHaveLength(5)
  expect(slots[2]).toBe(screen.getByRole("link", { name: "AI Workspace" }))
  const profile = screen.getByRole("link", { name: "Profile" })
  expect(slots[4]).toBe(profile)
  expect(profile).toHaveAttribute("href", "/profile")
  expect(profile.querySelector("svg")).toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Apps" })).not.toBeInTheDocument()
  expect(slots[2]).toHaveAttribute("aria-current", "page")
  expect(nav).toHaveTextContent("AI Workspace")
  expect(screen.getAllByRole("link")).toHaveLength(5)
  expect(slots[0]).toHaveAttribute("href", "/chat")
  expect(slots[1]).toHaveAttribute("href", "/leads")
  expect(slots[3]).toHaveAttribute("href", "/control-center")
  expect(nav).toHaveClass("dock", "md:hidden")
  for (const link of screen.getAllByRole("link")) {
    expect(link.textContent).toBe(link.getAttribute("aria-label"))
    expect(link).toHaveClass("tab")
    expect(link.querySelector("svg")).toHaveAttribute("stroke-width", "1.7")
  }
})

test.each(["avatar_url", "picture"] as const)("uses the account photo from %s when it loads", async (key) => {
  const src = "https://example.com/avatar.png"
  mockUserMetadata = { [key]: src }
  const NativeImage = window.Image
  const image = new NativeImage()
  const imageFactory = jest.spyOn(window, "Image").mockImplementation(() => image)
  try {
    render(<MobileWorkspaceNavigation />)
    expect(image.src).toBe(src)
    await act(async () => { fireEvent.load(image) })
    const profile = screen.getByRole("link", { name: "Profile" })
    expect(profile.querySelector("img")).toHaveAttribute("src", src)
    expect(profile.querySelector("svg")).not.toBeInTheDocument()
  } finally {
    imageFactory.mockRestore()
  }
})

test("compacts on downward content scroll, ignores jitter and expands on reversal or navigation", () => {
  const content = () => <><main><div data-testid="list" /></main><MobileWorkspaceNavigation /></>
  const view = render(content())
  const nav = screen.getByRole("navigation")
  const list = screen.getByTestId("list")
  Object.defineProperties(list, { scrollHeight: { value: 600 }, clientHeight: { value: 400 } })
  const scroll = (top: number) => { list.scrollTop = top; fireEvent.scroll(list) }
  scroll(5)
  scroll(15)
  expect(nav).not.toHaveAttribute("data-compact")
  scroll(40)
  expect(nav).toHaveAttribute("data-compact", "true")
  expect(screen.getByRole("link", { name: "AI Workspace" })).toHaveAttribute("aria-current", "page")
  scroll(210)
  scroll(198)
  expect(nav).toHaveAttribute("data-compact")
  scroll(180)
  expect(nav).not.toHaveAttribute("data-compact")
  scroll(0)
  scroll(40)
  expect(nav).toHaveAttribute("data-compact")
  setRoute("/navigation")
  view.rerender(content())
  expect(nav).not.toHaveAttribute("data-compact")
})

test.each(["en", "es", "fr", "de", "ja"] as const)("uses translated app labels in %s", (locale) => {
  mockLocale = locale
  const view = render(<MobileWorkspaceNavigation />)
  for (const key of ["chat", "leads", "controlCenter", "agents", "profile"]) {
    const title = localeMessages[locale][`layout.sidebar.${key}`]
    expect(screen.getByRole("link", { name: title })).toHaveTextContent(title)
  }
  mockLocale = "en"
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.getByRole("link", { name: "AI Workspace" })).toHaveTextContent("AI Workspace")
})

test("restores navigation on the pushed instance list and hides it on selection", () => {
  setRoute("/robots?instance=one")
  const view = render(<MobileWorkspaceNavigation />)
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  setRoute("/robots?view=instances")
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.getByRole("navigation")).toBeInTheDocument()
  setRoute("/robots?instance=two")
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
})

test("opens three dynamic tabs, keeps anchors fixed and updates URLs without duplicating modules", () => {
  const view = render(<MobileWorkspaceNavigation />)
  for (const route of ["/leads", "/catalog", "/chat?conversationId=one"]) {
    setRoute(route)
    view.rerender(<MobileWorkspaceNavigation />)
  }
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  setRoute("/chat?conversationId=two")
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  setRoute("/navigation")
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.getByRole("link", { name: "Conversations" })).toHaveAttribute("href", "/chat?conversationId=two")
  setRoute("/sales")
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.queryByRole("link", { name: "Customers" })).not.toBeInTheDocument()
  const slots = screen.getByRole("navigation").firstElementChild!.children
  expect(slots[2]).toHaveAttribute("aria-label", "AI Workspace")
  expect(slots[4]).toHaveAttribute("aria-label", "Profile")
  expect(screen.getByRole("link", { name: "Sales" })).toHaveAttribute("aria-current", "page")
})

test("keeps open tabs while Profile is active and does not forward unrelated query parameters to AI", () => {
  setRoute("/catalog?search=desk")
  const view = render(<MobileWorkspaceNavigation />)
  expect(screen.getByRole("link", { name: "AI Workspace" })).toHaveAttribute("href", "/robots")
  setRoute("/profile")
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("aria-current", "page")
  expect(screen.getByRole("link", { name: "Catalog" })).toBeInTheDocument()
  setRoute("/navigation")
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.getByRole("link", { name: "Profile" })).not.toHaveAttribute("aria-current")
})

test("tracks robot modes separately and returns to agent mode", () => {
  setRoute("/robots?mode=workflow")
  const view = render(<MobileWorkspaceNavigation />)
  expect(screen.getByRole("link", { name: "Workflows" })).toHaveAttribute("aria-current", "page")
  const agent = screen.getByRole("link", { name: "AI Workspace" })
  expect(agent).toHaveAttribute("href", "/robots")
  fireEvent.click(agent)
  expect(mockSetMode).toHaveBeenCalledWith("agent")
  setRoute("/robots?mode=imprenta")
  view.rerender(<MobileWorkspaceNavigation />)
  fireEvent.click(screen.getByRole("link", { name: "Workflows" }))
  expect(mockSetMode).toHaveBeenLastCalledWith("workflow")
})

test.each([
  "/leads/lead-one", "/catalog/item-one/edit", "/control-center/task-one",
  "/purchases/orders/order-one", "/chat?conversationId=one",
  "/robots?instance=robot-one", "/robots?instance=robot-one&mode=workflow",
])("hides the bar on breadcrumb detail %s and restores it at the module root", (route) => {
  setRoute(route)
  const view = render(<MobileWorkspaceNavigation />)
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument()
  setRoute("/navigation")
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.getByRole("navigation")).toBeInTheDocument()
  expect(screen.getAllByRole("link").map((link) => link.getAttribute("href")))
    .toContain(route.startsWith("/robots") ? "/robots" : route)
})

test.each([
  "/purchases/orders", "/inventory/minimums", "/accounting/entries",
  "/settings?tab=channels", "/dashboard?tab=sales", "/catalog?search=desk",
])("keeps the bar visible on module root %s", (route) => {
  setRoute(route)
  render(<MobileWorkspaceNavigation />)
  expect(screen.getByRole("navigation")).toBeInTheDocument()
})

test("filters denied modules and clears history when the site or actor changes", () => {
  setRoute("/catalog")
  const view = render(<MobileWorkspaceNavigation />)
  setRoute("/leads")
  view.rerender(<MobileWorkspaceNavigation />)
  mockBlocked = ["catalog"]
  setRoute("/robots")
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.queryByRole("link", { name: "Catalog" })).not.toBeInTheDocument()
  mockSiteId = "site-b"
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.getAllByRole("link")).toHaveLength(5)
  expect(screen.queryByRole("link", { name: "Catalog" })).not.toBeInTheDocument()
  setRoute("/chat")
  view.rerender(<MobileWorkspaceNavigation />)
  mockUserId = "user-b"
  setRoute("/robots")
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.getAllByRole("link")).toHaveLength(5)
})

test("does not record modules during scope hydration", () => {
  mockLoading = true
  setRoute("/catalog")
  const view = render(<MobileWorkspaceNavigation />)
  expect(screen.getAllByRole("link")).toHaveLength(5)
  expect(screen.queryByRole("link", { name: "Catalog" })).not.toBeInTheDocument()
  mockLoading = false
  view.rerender(<MobileWorkspaceNavigation />)
  expect(screen.getByRole("link", { name: "Catalog" })).toBeInTheDocument()
})

test.each([
  ["/pos/check-in", "", "checkIn"],
  ["/inventory/minimums", "", "inventoryMinimums"],
  ["/accounting/entries/id", "", "journalEntries"],
  ["/settings", "tab=channels", "channels"],
  ["/dashboard", "tab=sales", "reportSales"],
  ["/robots", "mode=imprenta", "contentCreator"],
])("resolves the most specific module for %s?%s", (path, query, key) => {
  expect(resolveMobileWorkspaceTab(path, query)?.key).toBe(key)
})

test("ignores anchor/account routes and reuses unchanged history", () => {
  for (const path of ["/robots", "/navigation", "/profile"]) {
    expect(resolveMobileWorkspaceTab(path, "")).toBeNull()
  }
  const active = resolveMobileWorkspaceTab("/catalog", "")!
  const tabs = [active]
  expect(updateMobileWorkspaceTabs(tabs, active)).toBe(tabs)
  expect(updateMobileWorkspaceTabs(tabs, null)).toBe(tabs)
})

test("restores sidebar history instead of defaults and preserves visits during the read", async () => {
  let finish!: (entries: ShortcutRecord[]) => void
  jest.mocked(loadShortcuts).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  const view = render(<MobileWorkspaceNavigation />)
  setRoute("/sales")
  view.rerender(<MobileWorkspaceNavigation />)
  await act(async () => finish([
    { id: "catalog", pinned: false },
    { id: "reportSales", pinned: false },
  ]))
  expect(loadShortcuts).toHaveBeenCalledWith("user-a", "site-a")
  expect(screen.getByRole("link", { name: "Catalog" })).toBeInTheDocument()
  expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toContain("/dashboard?tab=sales")
  expect(screen.getByRole("link", { name: "Sales" })).toHaveAttribute("aria-current", "page")
  expect(screen.queryByRole("link", { name: "Conversations" })).not.toBeInTheDocument()
})

test("uses defaults for the automatically inserted Overview and filters denied defaults", async () => {
  mockBlocked = ["leads"]
  jest.mocked(loadShortcuts).mockResolvedValue([{ id: "reportOverview", pinned: true }])
  await act(async () => { render(<MobileWorkspaceNavigation />) })
  expect(screen.getByRole("link", { name: "Conversations" })).toBeInTheDocument()
  expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toContain("/control-center")
  expect(screen.queryByRole("link", { name: "Customers" })).not.toBeInTheDocument()
  expect(screen.getAllByRole("link")).toHaveLength(5)
})

test.each([
  { entries: [] },
  { entries: [{ id: "deals", pinned: false }] },
  { entries: [{ id: "controlCenter", pinned: false }, { id: "deals", pinned: false }] },
  { entries: [{ id: "chat", pinned: false }, { id: "chat", pinned: false }] },
  { entries: [{ id: "unknown-module", pinned: false }] },
])("fills empty or partial cached history with unique mobile defaults: $entries", async ({ entries }) => {
  jest.mocked(loadShortcuts).mockResolvedValue(entries)
  await act(async () => { render(<MobileWorkspaceNavigation />) })
  const links = screen.getAllByRole("link")
  expect(links).toHaveLength(5)
  expect(new Set(links.map((link) => link.getAttribute("href"))).size).toBe(5)
  expect(screen.getByRole("link", { name: "Conversations" })).toBeInTheDocument()
  if (entries.some((entry) => entry.id === "deals")) {
    expect(links[entries[0].id === "deals" ? 0 : 1]).toHaveAttribute("href", "/deals")
  }
})

test("replaces denied cached and default apps with permitted modules", async () => {
  mockBlocked = ["chat", "leads", "controlCenter", "deals"]
  jest.mocked(loadShortcuts).mockResolvedValue([{ id: "deals", pinned: false }])
  await act(async () => { render(<MobileWorkspaceNavigation />) })
  const links = screen.getAllByRole("link")
  expect(links).toHaveLength(5)
  for (const href of ["/chat", "/leads", "/control-center", "/deals"]) {
    expect(links.map((link) => link.getAttribute("href"))).not.toContain(href)
  }
})

test("keeps all five links when shortcut storage fails", async () => {
  jest.mocked(loadShortcuts).mockRejectedValue(new Error("Storage unavailable"))
  await act(async () => { render(<MobileWorkspaceNavigation />) })
  expect(screen.getAllByRole("link")).toHaveLength(5)
  expect(screen.getByRole("link", { name: "Conversations" })).toBeInTheDocument()
})

test("ignores old-site reads and foreign events while accepting current sidebar updates", async () => {
  let finish!: (entries: ShortcutRecord[]) => void
  jest.mocked(loadShortcuts).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  const view = render(<MobileWorkspaceNavigation />)
  mockSiteId = "site-b"
  view.rerender(<MobileWorkspaceNavigation />)
  await act(async () => finish([{ id: "catalog", pinned: false }]))
  expect(screen.queryByRole("link", { name: "Catalog" })).not.toBeInTheDocument()
  jest.mocked(loadShortcutsFromLocalStorage).mockReturnValue([{ id: "catalog", pinned: false }])
  act(() => window.dispatchEvent(new CustomEvent("shortcuts-updated", { detail: { siteId: "site-a" } })))
  expect(screen.queryByRole("link", { name: "Catalog" })).not.toBeInTheDocument()
  act(() => window.dispatchEvent(new CustomEvent("shortcuts-updated", { detail: { siteId: "site-b" } })))
  expect(screen.getByRole("link", { name: "Catalog" })).toBeInTheDocument()
})