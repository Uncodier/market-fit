import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useRouter, useSearchParams } from "next/navigation"
import ConnectorCatalog from "@/app/connectors/connector-catalog"
import { catalog, deferred, jsonResponse, translate } from "./fixtures"

let mockSite = "site-1"
let mockUser = "user-1"
let mockMobile = false
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite ? { id: mockSite } : null, isLoading: false }) }))
jest.mock("@/app/components/auth/auth-context", () => ({ useAuthContext: () => ({ user: { id: mockUser }, isLoading: false }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
jest.mock("@/app/context/LayoutContext", () => ({ useLayout: () => ({ isLayoutCollapsed: false }) }))
jest.mock("@/app/hooks/use-mobile-view", () => ({ useIsMobile: () => mockMobile }))
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
const countsMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
const push = jest.fn()
beforeEach(() => {
  window.history.replaceState(null, "", "/connectors")
  mockSite = "site-1"; mockUser = "user-1"; mockMobile = false
  fetchMock.mockReset(); push.mockReset()
  countsMock.mockReset().mockResolvedValue(jsonResponse({ error: { code: "NOT_FOUND" } }, 404))
  jest.mocked(fetch).mockImplementation((...args) => String(args[0]).startsWith("/api/connectors/domain-counts?") ? countsMock(...args) : fetchMock(...args))
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
  jest.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
})

test("renders scoped catalogue and real partial counts without claiming execution access", async () => {
  fetchMock.mockResolvedValue(jsonResponse(catalog))
  render(<ConnectorCatalog />)
  expect(await screen.findByRole("link", { name: "Mail toolkit" })).toHaveAttribute("href", "/connectors/mail")
  expect(screen.getByText("1 toolkits on this page")).toBeVisible()
  expect(screen.getByText("1 visible accounts")).toBeVisible()
  expect(screen.getByText(/An agent acting on its own needs a grant for the specific account/)).toBeVisible()
  expect(fetchMock.mock.calls[0][0]).toBe("/api/connectors/catalog?tab=all&site_id=site-1&page=1")
})

test("keeps the toolbar and shows non-interactive placeholders while the catalogue loads", async () => {
  const pending = deferred<Response>()
  fetchMock.mockReturnValue(pending.promise)
  render(<ConnectorCatalog />)
  expect(screen.getByRole("tablist")).toBeVisible()
  expect(screen.getByText("Loading connectors…")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "All domains" })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Mail toolkit" })).not.toBeInTheDocument()
  await act(async () => pending.resolve(jsonResponse(catalog)))
  expect(screen.getByRole("link", { name: "Mail toolkit" })).toBeVisible()
  expect(screen.queryByText("Loading connectors…")).not.toBeInTheDocument()
})

test("retains intersecting URL filters, resets cursor on search, and supports next page", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tab=connected&q=mail&category=messaging&cursor=old") as ReturnType<typeof useSearchParams>)
  fetchMock.mockResolvedValue(jsonResponse(catalog))
  render(<ConnectorCatalog />)
  await screen.findByRole("link", { name: "Mail toolkit" })
  expect(screen.getByRole("tab", { name: "Connected" })).toHaveAttribute("aria-selected", "true")
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  expect(push).toHaveBeenLastCalledWith("/connectors?tab=connected&q=mail&category=messaging&page=2", { scroll: false })
  fireEvent.change(screen.getByRole("textbox", { name: "Search connectors" }), { target: { value: "calendar" } })
  fireEvent.submit(screen.getByRole("search", { name: "Search connectors" }))
  expect(push).toHaveBeenLastCalledWith("/connectors?tab=connected&q=calendar&category=messaging", { scroll: false })
})

test("setup-required and authorization failures are not empty search results", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ ...catalog, configured: false }))
  const view = render(<ConnectorCatalog />)
  expect(await screen.findByRole("link", { name: "Open Integrations" })).toHaveAttribute("href", "/integrations")
  expect(screen.queryByText("No matching connectors")).not.toBeInTheDocument()
  mockSite = "site-2"
  fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "forbidden" } }, 403))
  view.rerender(<ConnectorCatalog />)
  expect(await screen.findByRole("alert")).toHaveTextContent("You do not have access")
})

test("desktop keeps domains in a collapsible sidebar before the catalogue", async () => {
  fetchMock.mockResolvedValue(jsonResponse(catalog))
  render(<ConnectorCatalog />)
  const link = await screen.findByRole("link", { name: "Mail toolkit" })
  const collapsedToggle = screen.queryByRole("button", { name: "Show domains" })
  if (collapsedToggle) fireEvent.click(collapsedToggle)
  const panel = screen.getByRole("complementary", { name: "Domains" })
  expect(panel.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(within(panel).getByRole("heading", { name: "Domains" })).toBeVisible()
  expect(within(panel).getByRole("button", { name: "All domains" })).toHaveAttribute("aria-pressed", "true")
  fireEvent.click(screen.getByRole("button", { name: "Hide domains" }))
  expect(panel).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Show domains" }))
  expect(screen.getByRole("complementary", { name: "Domains" })).toBeVisible()
})

test("shows complete category totals, including zero counts, and refreshes them for a different search and tab", async () => {
  const pending = deferred<Response>()
  const domains = [...catalog.domains, { id: "calendar", label: "Calendar", skill_slugs: [] }]
  fetchMock.mockResolvedValue(jsonResponse({ ...catalog, domains }))
  countsMock.mockResolvedValueOnce(jsonResponse({ total: 120, counts: { messaging: 61, calendar: 0 } })).mockReturnValueOnce(pending.promise)
  const view = render(<ConnectorCatalog />)
  await screen.findByRole("link", { name: "Mail toolkit" })
  const collapsedToggle = screen.queryByRole("button", { name: "Show domains" })
  if (collapsedToggle) fireEvent.click(collapsedToggle)
  const messaging = await screen.findByRole("button", { name: "Messaging 61" })
  const all = screen.getByRole("button", { name: "All domains 120" })
  const calendar = screen.getByRole("button", { name: "Calendar 0" })
  const icons = [messaging, all, calendar].map(row => {
    const group = row.firstElementChild?.firstElementChild
    const iconWrapper = group?.firstElementChild
    expect(iconWrapper).toHaveAttribute("aria-hidden", "true")
    expect(group?.nextElementSibling).toHaveClass("text-right")
    const icon = iconWrapper?.querySelector("svg")
    expect(icon).toBeInTheDocument()
    return icon?.innerHTML
  })
  expect(new Set(icons).size).toBe(3)

  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tab=connected&q=mail&category=messaging&page=2") as ReturnType<typeof useSearchParams>)
  view.rerender(<ConnectorCatalog />)
  expect(screen.queryByRole("button", { name: "Messaging 61" })).not.toBeInTheDocument()
  expect(countsMock.mock.calls[1][0]).toBe("/api/connectors/domain-counts?site_id=site-1&tab=connected&q=mail")
  await act(async () => pending.resolve(jsonResponse({ total: 1, counts: { messaging: 1, calendar: 0 } })))
  expect(screen.getByRole("button", { name: "Messaging 1" })).toHaveAttribute("aria-pressed", "true")
})

test("changing domains updates only the results and keeps the catalogue controls mounted", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tab=connected&q=mail&cursor=old") as ReturnType<typeof useSearchParams>)
  const pending = deferred<Response>()
  fetchMock.mockResolvedValueOnce(jsonResponse(catalog)).mockReturnValueOnce(pending.promise)
  const view = render(<ConnectorCatalog />)
  await screen.findByRole("link", { name: "Mail toolkit" })
  const collapsedToggle = screen.queryByRole("button", { name: "Show domains" })
  if (collapsedToggle) fireEvent.click(collapsedToggle)
  const panel = screen.getByRole("complementary", { name: "Domains" })
  const search = screen.getByRole("textbox", { name: "Search connectors" })
  const tabs = screen.getByRole("tablist")
  const provider = screen.getByText(/Provider mode is not reported/)
  const messaging = within(panel).getByRole("button", { name: "Messaging" })
  fireEvent.click(messaging)
  expect(push).not.toHaveBeenCalled()
  expect(window.location.search).toBe("?tab=connected&q=mail&category=messaging")

  // Next.js publishes native history changes through useSearchParams.
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams(window.location.search) as ReturnType<typeof useSearchParams>)
  view.rerender(<ConnectorCatalog />)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  expect(fetchMock.mock.calls[1][0]).toBe("/api/connectors/catalog?tab=connected&q=mail&category=messaging&site_id=site-1&page=1")
  expect(screen.getByText("Loading connectors…")).toBeVisible()
  expect(screen.queryByRole("link", { name: "Mail toolkit" })).not.toBeInTheDocument()
  expect(screen.getByRole("complementary", { name: "Domains" })).toBe(panel)
  expect(messaging).toHaveAttribute("aria-pressed", "true")
  expect(screen.getByRole("tablist")).toBe(tabs)
  expect(screen.getByRole("textbox", { name: "Search connectors" })).toBe(search)
  expect(screen.getByText(/Provider mode is not reported/)).toBe(provider)

  await act(async () => pending.resolve(jsonResponse({ ...catalog, items: [], next_cursor: null })))
  expect(screen.getByText("No matching connected toolkits")).toBeVisible()
  expect(screen.queryByText("Loading connectors…")).not.toBeInTheDocument()
})

test("mobile opens domains in a sheet and closes it after selecting a filter", async () => {
  mockMobile = true
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tab=connected&q=mail&page=2") as ReturnType<typeof useSearchParams>)
  fetchMock.mockResolvedValue(jsonResponse(catalog))
  countsMock.mockResolvedValue(jsonResponse({ total: 5, counts: { messaging: 3 } }))
  render(<ConnectorCatalog />)
  await screen.findByRole("link", { name: "Mail toolkit" })
  expect(screen.queryByRole("complementary", { name: "Domains" })).not.toBeInTheDocument()
  const trigger = screen.getByRole("button", { name: "Show domains" })
  fireEvent.click(trigger)
  const sheet = screen.getByRole("dialog", { name: "Domains" })
  expect(within(sheet).getByRole("heading", { name: "Domains" })).toBeVisible()
  const messaging = await within(sheet).findByRole("button", { name: "Messaging 3" })
  expect(messaging.firstElementChild?.querySelector("svg")).toBeInTheDocument()
  fireEvent.click(messaging)
  expect(push).not.toHaveBeenCalled()
  expect(window.location.search).toBe("?tab=connected&q=mail&category=messaging")
  expect(screen.queryByRole("dialog", { name: "Domains" })).not.toBeInTheDocument()
  await waitFor(() => expect(trigger).toHaveFocus())
})

test("site and actor changes abort old reads and never publish previous private counts", async () => {
  const pending = deferred<Response>()
  fetchMock.mockReturnValueOnce(pending.promise).mockResolvedValue(jsonResponse({ ...catalog, items: [], next_cursor: null }))
  const view = render(<ConnectorCatalog />)
  const firstSignal = fetchMock.mock.calls[0][1]?.signal
  mockSite = "site-2"
  view.rerender(<ConnectorCatalog />)
  expect(firstSignal?.aborted).toBe(true)
  await screen.findByText("No matching connectors")
  await act(async () => pending.resolve(jsonResponse(catalog)))
  expect(screen.queryByText("Mail toolkit")).not.toBeInTheDocument()
  mockUser = "user-2"
  view.rerender(<ConnectorCatalog />)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
})

test("no workspace means no connector request", () => {
  mockSite = ""
  render(<ConnectorCatalog />)
  expect(screen.getByRole("link", { name: "Select a workspace" })).toHaveAttribute("href", "/projects")
  expect(fetchMock).not.toHaveBeenCalled()
})

test("shows the tabs before search and the platform notices after the catalogue", async () => {
  fetchMock.mockResolvedValue(jsonResponse({ ...catalog, credential_source: "platform" }))
  const { container } = render(<ConnectorCatalog />)
  await screen.findByRole("link", { name: "Mail toolkit" })
  const footer = screen.getByRole("contentinfo")
  expect(within(footer).getByText(/Connect external accounts to your workspace/)).toBeVisible()
  expect(within(footer).getByText(/Provider mode: platform-managed/)).toHaveTextContent("A workspace API key is not required")
  expect(within(footer).getByText(/Platform-managed credentials do not promise free usage/)).toBeVisible()
  expect(screen.getByRole("button", { name: "Next" }).compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(screen.queryByRole("link", { name: "Open Integrations" })).not.toBeInTheDocument()
  expect(screen.queryByRole("heading", { name: "Connectors" })).not.toBeInTheDocument()
  expect(screen.getAllByRole("button", { name: /Search/ })).toHaveLength(1)
  expect(container.querySelector('form[role="search"] button[type="submit"]')).toBeNull()
  expect(screen.getByRole("tablist").compareDocumentPosition(screen.getByRole("search")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test.each([false, true])("keeps search in the toolbar without a Private reports shortcut (mobile: %s)", async mobile => {
  mockMobile = mobile
  fetchMock.mockResolvedValue(jsonResponse(catalog))
  render(<ConnectorCatalog />)
  await screen.findByRole("link", { name: "Mail toolkit" })

  expect(screen.queryByRole("button", { name: "Private reports" })).not.toBeInTheDocument()
  expect(screen.queryByRole("link", { name: "Private reports" })).not.toBeInTheDocument()
  const search = screen.getByRole("button", { name: "Search connectors" })
  expect(search).toHaveClass("h-10", "w-10")
  expect(search.querySelector("svg")).toBeInTheDocument()
})

test("clearing search removes the query and cursor without changing the selected tab", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("tab=connected&q=mail&cursor=old") as ReturnType<typeof useSearchParams>)
  fetchMock.mockResolvedValue(jsonResponse(catalog))
  render(<ConnectorCatalog />)
  await screen.findByRole("link", { name: "Mail toolkit" })
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
  expect(push).toHaveBeenLastCalledWith("/connectors?tab=connected", { scroll: false })
})