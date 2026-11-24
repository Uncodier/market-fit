import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { useRouter, useSearchParams } from "next/navigation"
import ConnectorDetailPage, { DetailContent } from "@/app/connectors/connector-detail"
import ConnectorDetailLoading from "@/app/connectors/[slug]/loading"
import { connector, deferred, detail, jsonResponse, translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header> }))
jest.mock("@/app/connectors/connector-access", () => ({ ConnectorAccessPanel: () => <div>Account permissions</div> }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-1" }, isLoading: false }) }))
jest.mock("@/app/components/auth/auth-context", () => ({ useAuthContext: () => ({ user: { id: "actor" }, isLoading: false }) }))
const fetchMock = jest.mocked(fetch)
const push = jest.fn()
const active = { ...connector, enabled: true }
const newestActive = { ...active, id: "connector-2", display_name: "Support mailbox", verified_at: "2026-11-02T12:00:00Z" }
// jsdom has no scrolling implementation for Radix's keyboard-opened listbox.
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= jest.fn()
  global.IntersectionObserver ??= jest.fn(() => ({ observe: jest.fn(), disconnect: jest.fn() })) as unknown as typeof IntersectionObserver
})
function selectAccountByUrl() {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ connector: connector.id }) as ReturnType<typeof useSearchParams>)
}
beforeEach(() => {
  fetchMock.mockReset()
  push.mockReset()
  jest.mocked(useRouter).mockReturnValue({
    push, back: jest.fn(), forward: jest.fn(), refresh: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), bfcacheId: "test",
  })
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
})

test("the route fallback mirrors the summary sections and keeps the account placeholder out of the body", () => {
  render(<ConnectorDetailLoading />)
  const loading = screen.getByRole("status")
  expect(loading).toHaveTextContent("Loading connectors…")
  const placeholder = within(loading).getByTestId("connector-account-skeleton")
  const summary = within(loading).getByTestId("connector-summary-skeleton")
  expect(placeholder).toHaveAttribute("aria-hidden", "true")
  expect(summary).not.toContainElement(placeholder)
  expect(Array.from(summary.children, section => section.getAttribute("data-skeleton-section"))).toEqual([
    "overview", "connection", "access", "related-skills", "activity",
  ])
  expect(screen.queryByRole("combobox", { name: "Connected account" })).not.toBeInTheDocument()
})

test("a callback review link cannot fetch the account under a different active workspace", () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ connector: connector.id, workspace: "original-site" }) as ReturnType<typeof useSearchParams>)
  render(<ConnectorDetailPage slug="mail" />)
  expect(screen.getByRole("status")).toHaveTextContent(/Switch to the workspace where you connected/)
  expect(fetchMock).not.toHaveBeenCalled()
})

test("reserves the account selector in the sticky header while detail fetches", async () => {
  const pending = deferred<Response>()
  fetchMock.mockReturnValueOnce(pending.promise)
  render(<DetailContent slug="mail" siteId="site-1" />)
  const toolbar = within(screen.getByRole("banner"))
  expect(toolbar.getByTestId("connector-account-skeleton")).toBeVisible()
  expect(toolbar.queryByRole("combobox", { name: "Connected account" })).not.toBeInTheDocument()
  expect(screen.getByText("Loading connectors…")).toBeInTheDocument()
  expect(screen.getByTestId("connector-summary-skeleton")).toBeVisible()

  await act(async () => pending.resolve(jsonResponse({ ...detail, connections: [active] })))
  expect(toolbar.getByRole("combobox", { name: "Connected account" })).toHaveTextContent(active.display_name)
  expect(toolbar.queryByTestId("connector-account-skeleton")).not.toBeInTheDocument()
  expect(screen.queryByTestId("connector-summary-skeleton")).not.toBeInTheDocument()
  expect(screen.queryByText("Loading connectors…")).not.toBeInTheDocument()
})

test("shows no authentication required instead of an empty onboarding flow", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ ...detail, auth_configs: [], connections: [], connection_setup: { kind: "no_auth" } }))
  render(<DetailContent slug="mail" siteId="site-1" />)
  expect(await screen.findByText("This connector does not require authentication. There is no account to connect.")).toBeVisible()
  expect(screen.queryByRole("button", { name: /connect account|setup required/i })).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("defaults to the most recently verified active account in the sticky header", async () => {
  const later = { ...active, verified_at: "2026-11-03T12:00:00Z" }
  fetchMock.mockResolvedValue(jsonResponse({ ...detail, connections: [
    active, { ...later, id: "expired", provider_status: "EXPIRED" }, newestActive,
    { ...later, id: "disabled", enabled: false }, { ...later, id: "disconnecting", revocation_pending: true },
    { ...active, id: "unverified", verified_at: null },
  ] }))
  render(<DetailContent slug="mail" siteId="site-1" />)
  const picker = await within(screen.getByRole("banner")).findByRole("combobox", { name: "Connected account" })
  expect(picker).toHaveTextContent("Support mailbox")
  expect(screen.getByText("Account permissions")).toBeVisible()
  expect(screen.getByRole("button", { name: "Verify provider status" })).toBeVisible()
  expect(push).not.toHaveBeenCalled()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("switching accounts in the header pins the exact account in the URL without dropping other parameters", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("source=catalog") as ReturnType<typeof useSearchParams>)
  fetchMock.mockResolvedValue(jsonResponse({ ...detail, connections: [connector, newestActive] }))
  const { rerender } = render(<DetailContent slug="mail" siteId="site-1" />)
  const picker = await screen.findByRole("combobox", { name: "Connected account" })
  expect(picker).toHaveTextContent("Support mailbox")
  fireEvent.keyDown(picker, { key: "ArrowDown" })
  fireEvent.click(await screen.findByRole("option", { name: /Sales mailbox.*Disabled/ }))
  expect(push).toHaveBeenCalledWith("/connectors/mail?source=catalog&connector=connector-1", { scroll: false })

  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("source=catalog&connector=connector-1") as ReturnType<typeof useSearchParams>)
  rerender(<DetailContent slug="mail" siteId="site-1" />)
  expect(picker).toHaveTextContent(/Sales mailbox.*Disabled/)
  expect(screen.getByText("Connected · locally disabled")).toBeVisible()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("ignores the old project-binding flag while retaining normal provider verification for managers", async () => {
  const old = { ...active, toolkit_slug: "supabase", can_verify_supabase_project: true }
  fetchMock.mockResolvedValueOnce(jsonResponse({ ...detail, connections: [old] }))
  render(<DetailContent slug="supabase" siteId="site-1" />)
  await screen.findByRole("button", { name: "Verify provider status" })
  expect(screen.queryByLabelText("Project reference for this existing account")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Verify and bind this project" })).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("labels a disabled account without selecting it even when it is the only option", async () => {
  fetchMock.mockResolvedValue(jsonResponse(detail))
  render(<DetailContent slug="mail" siteId="site-1" />)
  const picker = await screen.findByRole("combobox", { name: "Connected account" })
  expect(picker).toHaveTextContent("Select an account")
  expect(screen.getByText("No active accounts. Select an account in the header to review its status.")).toBeVisible()
  expect(screen.queryByText("Account permissions")).not.toBeInTheDocument()
  fireEvent.keyDown(picker, { key: "ArrowDown" })
  const option = await screen.findByRole("option", { name: /Sales mailbox.*Disabled/ })
  expect(option).not.toHaveAttribute("aria-disabled", "true")
})

test("hides the account selector when no accounts are visible", async () => {
  fetchMock.mockResolvedValue(jsonResponse({ ...detail, connections: [] }))
  render(<DetailContent slug="mail" siteId="site-1" />)
  expect(await screen.findByText("There are no accounts available to you for this toolkit.")).toBeVisible()
  expect(screen.queryByRole("combobox", { name: "Connected account" })).not.toBeInTheDocument()
  expect(screen.queryByText("Account permissions")).not.toBeInTheDocument()
})

test("groups the selected account actions in the connection card footer", async () => {
  fetchMock.mockResolvedValue(jsonResponse({ ...detail, connections: [{ ...connector, enabled: true }] }))
  render(<DetailContent slug="mail" siteId="site-1" />)

  const disconnect = await screen.findByRole("button", { name: "Disconnect account" })
  const verify = screen.getByRole("button", { name: "Verify provider status" })
  const connection = screen.getByRole("heading", { name: "Connection" }).closest("#connection")
  expect(connection).toBeInTheDocument()
  expect(disconnect.parentElement).toBe(connection?.lastElementChild)
  expect(verify.parentElement).toBe(connection?.lastElementChild)
  expect(connection).not.toContainElement(screen.getByRole("combobox", { name: "Connected account" }))
})

test("replaces back action with Summary/Tools and loads real tool pages only on selection", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(detail))
  render(<DetailContent slug="mail" siteId="site-1" />)
  await screen.findByText("Mail toolkit")
  expect(screen.queryByRole("link", { name: "Connectors" })).not.toBeInTheDocument()
  expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute("aria-selected", "true")
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [{ slug: "MAIL_LIST", name: "List messages", description: "Read messages", reviewed: false }], next_cursor: "page2", total: 21 }))
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Tools" }), { button: 0, ctrlKey: false })
  expect(await screen.findByText("List messages")).toBeVisible()
  expect(within(screen.getByRole("banner")).getByRole("combobox", { name: "Connected account" })).toBeVisible()
  expect(screen.getByText("21 provider tools")).toBeVisible()
  expect(screen.getByText("Provider-listed · not reviewed")).toBeVisible()
  expect(fetchMock.mock.calls[1][0]).toBe("/api/connectors/catalog/mail/tools?site_id=site-1&page=1")
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [{ slug: "MAIL_GET", name: "Get message", description: "Read one", reviewed: true }], next_cursor: null, total: 21 }))
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  expect(await screen.findByText("Get message")).toBeVisible()
  expect(fetchMock.mock.calls[2][0]).toContain("page=2")
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Summary" }), { button: 0, ctrlKey: false })
  expect(screen.getByText("Mail toolkit")).toBeVisible()
  expect(screen.queryByText("Get message")).not.toBeInTheDocument()
})

test("opens Tools from the sticky header and searches the toolkit across pages", async () => {
  const tool = { slug: "MAIL_LIST", name: "List messages", description: "Read messages", reviewed: true, action_types: ["read"] }
  const results = (name: string, total: number, next_cursor: string | null = null) => jsonResponse({ items: [{ ...tool, name }], total, next_cursor })
  const oldResults = deferred<Response>()
  fetchMock.mockResolvedValueOnce(jsonResponse(detail)).mockReturnValueOnce(oldResults.promise)
    .mockResolvedValueOnce(results("Read invoices", 21, "page-two")).mockResolvedValueOnce(results("Read archived invoices", 21))
    .mockResolvedValueOnce(jsonResponse({ items: [], total: 0, next_cursor: null })).mockResolvedValueOnce(results(tool.name, 1))
  render(<DetailContent slug="mail" siteId="site-1" />)
  await screen.findByText("Mail toolkit")
  expect(fetchMock).toHaveBeenCalledTimes(1)

  const search = within(screen.getByRole("banner")).getByRole("search", { name: "Search tools" })
  fireEvent.click(within(search).getByRole("button", { name: "Search tools" }))
  expect(screen.getByRole("tab", { name: "Tools" })).toHaveAttribute("aria-selected", "true")
  expect(within(screen.getByRole("region", { name: "Tools" })).getByRole("status")).toHaveTextContent("Loading tools…")
  const input = within(search).getByRole("textbox", { name: "Search tools" })
  fireEvent.change(input, { target: { value: "  invoices & mail  " } })
  expect(await screen.findByRole("heading", { name: "Read invoices" })).toBeVisible()
  await act(async () => oldResults.resolve(results("Stale tool", 1)))
  expect(screen.queryByText("Stale tool")).not.toBeInTheDocument()
  expect(screen.getByText("21 matching tools")).toBeVisible()
  expect(screen.getByRole("heading", { name: "On this page" })).toBeInTheDocument()

  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  expect(await screen.findByRole("heading", { name: "Read archived invoices" })).toBeVisible()
  fireEvent.change(input, { target: { value: "unknown" } })
  const pendingTools = within(screen.getByRole("region", { name: "Tools" }))
  expect(pendingTools.getByRole("heading", { name: "Tools" })).toBeVisible()
  expect(pendingTools.getByRole("status")).toHaveTextContent("Loading tools…")
  expect(screen.queryByRole("heading", { name: "Read archived invoices" })).not.toBeInTheDocument()
  expect(screen.queryByText("21 matching tools")).not.toBeInTheDocument()
  fireEvent.submit(search)
  expect(await screen.findByText("No matching tools.")).toBeVisible()
  fireEvent.click(within(search).getByRole("button", { name: "Clear search" }))
  expect(await screen.findByRole("heading", { name: tool.name })).toBeVisible()
  expect(screen.getByRole("tab", { name: "Tools" })).toHaveAttribute("aria-selected", "true")
  const path = "/api/connectors/catalog/mail/tools?site_id=site-1&page="
  expect(fetchMock.mock.calls.slice(1).map(([url]) => url)).toEqual([
    path + "1", path + "1&q=invoices+%26+mail", path + "2&q=invoices+%26+mail", path + "1&q=unknown", path + "1",
  ])
})

test("a hidden URL account never falls back to another account", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("connector=hidden-account") as ReturnType<typeof useSearchParams>)
  fetchMock.mockResolvedValue(jsonResponse({ ...detail, connections: [active, newestActive] }))
  render(<DetailContent slug="mail" siteId="site-1" />)
  expect(await screen.findByRole("alert")).toHaveTextContent("not available to you")
  expect(screen.queryByText("Account permissions")).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("revocation pending never claims successful disconnection", async () => {
  selectAccountByUrl()
  fetchMock.mockResolvedValue(jsonResponse({ ...detail, can_manage: false, connections: [{ ...connector, revocation_pending: true }] }))
  render(<DetailContent slug="mail" siteId="site-1" />)
  expect(await screen.findByText("Disconnect pending · remote revocation unconfirmed")).toBeVisible()
  expect(screen.queryByRole("button", { name: "Disconnect account" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Verify provider status" })).not.toBeInTheDocument()
  expect(screen.getByRole("link", { name: "makinari-email" })).toHaveAttribute("href", "/skills?tab=makinari-skills#system-skill-makinari-email")
})

test("explains manual token revocation for a locally disabled Supabase connection", async () => {
  selectAccountByUrl()
  fetchMock.mockResolvedValue(jsonResponse({ ...detail, toolkit: { ...detail.toolkit, slug: "supabase" },
    connections: [{ ...connector, toolkit_slug: "supabase", revocation_pending: true, revocation_dispatched: true }] }))
  render(<DetailContent slug="supabase" siteId="site-1" />)
  expect(await screen.findByText("Disabled in Makinari")).toBeVisible()
  expect(screen.getByText(/revoke it manually in Supabase/)).toBeVisible()
  expect(screen.getByRole("link", { name: "Open Supabase Access Tokens" })).toHaveAttribute("href", "https://supabase.com/dashboard/account/tokens")
  expect(screen.queryByText(/Verify provider status instead of retrying/)).not.toBeInTheDocument()
})

test.each([undefined, true, false])("pending disconnect retry depends on explicit dispatch state %s", async revocation_dispatched => {
  selectAccountByUrl()
  fetchMock.mockResolvedValue(jsonResponse({ ...detail, credential_source: "platform", connections: [{ ...connector, revocation_pending: true, revocation_dispatched }] }))
  render(<DetailContent slug="mail" siteId="site-1" />)
  const disconnect = await screen.findByRole("button", { name: "Disconnect account" })
  if (revocation_dispatched === false) {
    expect(disconnect).toBeEnabled()
    expect(screen.getByText(/provider revocation was not dispatched/)).toBeVisible()
  } else {
    expect(disconnect).toBeDisabled()
    expect(screen.getByText(/Verify provider status instead of retrying/)).toBeVisible()
  }
  expect(screen.getByText(/Provider mode: platform-managed/)).toBeVisible()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})