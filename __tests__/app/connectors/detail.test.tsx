import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useSearchParams } from "next/navigation"
import { DetailContent } from "@/app/connectors/connector-detail"
import { connector, detail, jsonResponse, translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: React.ReactNode }) => <header>{children}</header> }))
jest.mock("@/app/connectors/connector-access", () => ({ ConnectorAccessPanel: () => <div>Account permissions</div> }))
const fetchMock = jest.mocked(fetch)
// jsdom has no scrolling implementation for Radix's keyboard-opened listbox.
beforeAll(() => { HTMLElement.prototype.scrollIntoView ??= jest.fn() })
function selectAccountByUrl() {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams({ connector: connector.id }) as ReturnType<typeof useSearchParams>)
}
beforeEach(() => {
  fetchMock.mockReset()
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
})

test("requires explicit account selection when several are visible", async () => {
  fetchMock.mockResolvedValue(jsonResponse({ ...detail, connections: [connector, { ...connector, id: "connector-2", display_name: "Support mailbox" }] }))
  render(<DetailContent slug="mail" siteId="site-1" />)
  await screen.findByText("Mail toolkit")
  expect(screen.queryByText("Account permissions")).not.toBeInTheDocument()
  expect(screen.getByRole("combobox", { name: "Connected account" })).toBeVisible()
  expect(screen.queryByRole("button", { name: "Verify provider status" })).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("the manager supplies the reference rather than trusting the label; the pinned account is reloaded after a verified receipt", async () => {
  const ref = "a".repeat(20)
  const old = { ...connector, toolkit_slug: "supabase", enabled: true, display_name: `Supabase · ${ref}`, can_verify_supabase_project: true }
  const accountDetail = { ...detail, connections: [old] }
  fetchMock.mockResolvedValueOnce(jsonResponse(accountDetail))
    .mockResolvedValueOnce(jsonResponse({ connector_id: old.id, revision: old.revision + 1 }))
    .mockResolvedValueOnce(jsonResponse({ ...accountDetail, connections: [{ ...old, can_verify_supabase_project: false }] }))
  render(<DetailContent slug="supabase" siteId="site-1" />)
  const field = await screen.findByLabelText("Project reference for this existing account")
  const button = screen.getByRole("button", { name: "Verify and bind this project" })
  expect(field).toHaveValue(""); expect(button).toBeDisabled()
  fireEvent.change(field, { target: { value: "1".repeat(20) } }); expect(button).toBeDisabled()
  fireEvent.change(field, { target: { value: ref } }); fireEvent.click(button)
  await screen.findByRole("button", { name: "Verify provider status" })
  await waitFor(() => expect(screen.queryByRole("button", { name: "Verify and bind this project" })).not.toBeInTheDocument())
  expect(fetchMock).toHaveBeenCalledWith(`/api/connectors/connections/${old.id}/bind-project`, expect.objectContaining({ method: "POST",
    body: JSON.stringify({ site_id: "site-1", expected_revision: old.revision, project_ref: ref }) }))
})

test("a nonmanager cannot start project verification", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ ...detail, can_manage: false, connections: [{ ...connector, enabled: true, toolkit_slug: "supabase", can_verify_supabase_project: true }] }))
  render(<DetailContent slug="supabase" siteId="site-1" />)
  await screen.findByText("Account permissions")
  expect(screen.queryByRole("button", { name: "Verify and bind this project" })).not.toBeInTheDocument()
})

test("labels a disabled account without selecting it even when it is the only option", async () => {
  fetchMock.mockResolvedValue(jsonResponse(detail))
  render(<DetailContent slug="mail" siteId="site-1" />)
  const picker = await screen.findByRole("combobox", { name: "Connected account" })
  expect(picker).toHaveTextContent("Select an account")
  expect(screen.queryByText("Account permissions")).not.toBeInTheDocument()
  fireEvent.keyDown(picker, { key: "ArrowDown" })
  const option = await screen.findByRole("option", { name: /Sales mailbox.*Disabled/ })
  expect(option).not.toHaveAttribute("aria-disabled", "true")
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
  expect(connection?.lastElementChild).not.toContainElement(screen.getByRole("combobox", { name: "Connected account" }))
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
  expect(screen.getByText("21 provider tools")).toBeVisible()
  expect(screen.getByText("Catalogue only")).toBeVisible()
  expect(fetchMock.mock.calls[1][0]).toBe("/api/connectors/catalog/mail/tools?site_id=site-1&page=1")
  fetchMock.mockResolvedValueOnce(jsonResponse({ items: [{ slug: "MAIL_GET", name: "Get message", description: "Read one", reviewed: true }], next_cursor: null, total: 21 }))
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  expect(await screen.findByText("Get message")).toBeVisible()
  expect(fetchMock.mock.calls[2][0]).toContain("page=2")
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Summary" }), { button: 0, ctrlKey: false })
  expect(screen.getByText("Mail toolkit")).toBeVisible()
  expect(screen.queryByText("Get message")).not.toBeInTheDocument()
})

test("a hidden URL account never falls back to another account", async () => {
  jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("connector=hidden-account") as ReturnType<typeof useSearchParams>)
  fetchMock.mockResolvedValue(jsonResponse(detail))
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