import { randomBytes } from "node:crypto"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { TopBarPrimaryActionsSlot } from "@/app/components/navigation/topbar-primary-actions"
import { ConnectAccount } from "@/app/connectors/connector-connect-account"
import type { ConnectorDetail } from "@/app/connectors/types"
import { deferred, detail, jsonResponse, translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))

const fetchMock = jest.mocked(fetch)
const calendar = { ...detail, toolkit: { ...detail.toolkit, slug: "googlecalendar" }, connections: [], auth_configs: [], can_create_managed_oauth: true }
const supabase = { ...detail, toolkit: { ...detail.toolkit, slug: "supabase", auth_schemes: ["API_KEY", "OAUTH2"] }, connections: [], auth_configs: [] }
function show(value: ConnectorDetail, onChanged = jest.fn()) {
  return render(<><TopBarPrimaryActionsSlot /><ConnectAccount siteId="site-1" detail={value} onChanged={onChanged} /></>)
}

beforeEach(() => { fetchMock.mockReset(); sessionStorage.clear() })
beforeAll(() => { HTMLElement.prototype.scrollIntoView ??= jest.fn() })

test("creates OAuth only after confirmation and refreshes rather than claiming an account is connected", async () => {
  const changed = jest.fn()
  const response = deferred<Response>()
  fetchMock.mockReturnValue(response.promise)
  show(calendar, changed)
  fireEvent.click(screen.getByRole("button", { name: "Set up OAuth" }))
  expect(screen.getByRole("dialog", { name: "Set up OAuth" })).toHaveTextContent("read-only access")
  expect(screen.getByRole("dialog")).not.toHaveTextContent("By continuing, you allow private Robots Ask")
  expect(fetchMock).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Create OAuth configuration" }))
  expect(screen.getByRole("button", { name: /Creating OAuth/ })).toBeDisabled()
  expect(fetchMock).toHaveBeenCalledWith("/api/connectors/managed-oauth", expect.objectContaining({ method: "POST", body: JSON.stringify({ site_id: "site-1", toolkit_slug: "googlecalendar" }) }))
  response.resolve(jsonResponse({ status: "available" }))
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("prefers an existing OAuth configuration and does not offer creation", () => {
  show({ ...calendar, auth_configs: detail.auth_configs })
  fireEvent.click(screen.getByRole("button", { name: "Connect account" }))
  expect(screen.getByRole("button", { name: "Continue to authorization" })).toBeEnabled()
  expect(screen.queryByRole("button", { name: "Create OAuth configuration" })).not.toBeInTheDocument()
})

test.each([false, true])("explains Ask before OAuth and starts only the notice-aware attempt (additional account: %s)", async additional => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "API_NOT_CONFIGURED" } }, 503))
  show({ ...detail, toolkit: { ...detail.toolkit, slug: "gmail" }, connections: additional ? detail.connections : [] })
  fireEvent.click(screen.getByRole("button", { name: additional ? "Connect another account" : "Connect account" }))
  const dialog = screen.getByRole("dialog")
  expect(dialog).toHaveAccessibleDescription(/shared with eligible workspace members by default. No current or future agent gets access automatically/)
  expect(dialog).toHaveAccessibleDescription(/reading messages from the connected mailbox/)
  expect(dialog).toHaveAccessibleDescription(/authorize this workspace to use the account you select.*permissions you intend to delegate/)
  expect(dialog).toHaveAccessibleDescription(/private Ask uses the signed-in member’s access.*provider enforces the permissions of the connected token or API key.*read-only credential stays read-only.*change or delete real data.*provider or Composio fees/i)
  expect(fetchMock).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Continue to authorization" }))
  await screen.findByRole("alert")
  expect(fetchMock.mock.calls).toHaveLength(1)
  expect(fetchMock).toHaveBeenCalledWith("/api/connectors/auth-attempts/ask", expect.objectContaining({ method: "POST",
    body: JSON.stringify({ site_id: "site-1", toolkit_slug: "gmail", auth_config_id: "auth-1" }) }))
})

test("dismissal before authorization creates neither an attempt nor a grant", () => {
  show({ ...detail, toolkit: { ...detail.toolkit, slug: "supabase" } })
  fireEvent.click(screen.getByRole("button", { name: "Connect another account" }))
  const dialog = screen.getByRole("dialog")
  expect(dialog).toHaveAccessibleDescription(/does not enable unrestricted SQL/)
  fireEvent.keyDown(dialog, { key: "Escape" })
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
})

test("connects Supabase via a masked token and refreshes only after server verification", async () => {
  const changed = jest.fn()
  const response = deferred<Response>()
  fetchMock.mockReturnValue(response.promise)
  show(supabase, changed)
  fireEvent.click(screen.getByRole("button", { name: "Supabase API token setup" }))
  const dialog = screen.getByRole("dialog")
  expect(dialog).toHaveTextContent("personal access token (PAT) starting with sbp_")
  expect(dialog).toHaveAccessibleDescription(/shared with eligible workspace members by default. No current or future agent gets access automatically/)
  expect(dialog).toHaveAccessibleDescription(/delegate this token for eligible tools on the selected project/)
  expect(dialog).not.toHaveAccessibleDescription(/tools become available automatically/)
  expect(dialog).toHaveTextContent(/does not limit the token’s permissions or authorize raw SQL/)
  expect(screen.getByRole("link", { name: "Open Supabase Access Tokens" })).toHaveAttribute("href", "https://supabase.com/dashboard/account/tokens")
  const button = screen.getByRole("button", { name: "Connect with API token" })
  const tokenField = screen.getByLabelText("Personal access token")
  expect(button).toBeEnabled()
  expect(tokenField).toHaveAttribute("type", "password")
  expect(screen.queryByRole("button", { name: "Continue to authorization" })).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
  const reference = "a".repeat(20)
  const token = `sbp_${randomBytes(24).toString("hex")}`
  // Password autofill may populate DOM inputs without firing React change events.
  ;(screen.getByLabelText("Supabase project reference") as HTMLInputElement).value = ` ${reference} `
  ;(tokenField as HTMLInputElement).value = token
  fireEvent.click(button)
  expect(fetchMock).toHaveBeenCalledWith("/api/connectors/supabase-token", expect.objectContaining({ method: "POST", body: JSON.stringify({ site_id: "site-1", project_ref: reference, token, delegate_account: true }) }))
  expect(tokenField).toHaveValue("")
  expect(changed).not.toHaveBeenCalled()
  response.resolve(jsonResponse({ status: "completed", connector_id: "11111111-1111-4111-8111-111111111111" }))
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("offers the project-token route for Ask even when Supabase OAuth is configured", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ status: "completed", connector_id: "11111111-1111-4111-8111-111111111111" }))
  const changed = jest.fn()
  show({ ...supabase, auth_configs: detail.auth_configs }, changed)
  fireEvent.click(screen.getByRole("button", { name: "Connect account" }))
  expect(screen.getByRole("dialog")).toHaveAccessibleDescription(/OAuth connects this account but does not bind it to a single project for Ask/)
  fireEvent.click(screen.getByRole("button", { name: "Use a project token for Ask" }))
  expect(screen.getByRole("dialog", { name: "Supabase API token setup" })).toBeVisible()
  const tokenField = screen.getByLabelText("Personal access token")
  fireEvent.input(tokenField, { target: { value: `sbp_${randomBytes(24).toString("hex")}` } })
  fireEvent.click(screen.getByRole("button", { name: "Use OAuth instead" }))
  expect(screen.queryByLabelText("Personal access token")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Continue to authorization" })).toBeEnabled()
  expect(fetchMock).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Use a project token for Ask" }))
  expect(screen.getByLabelText("Personal access token")).toHaveValue("")
  const project_ref = "a".repeat(20), token = `sbp_${randomBytes(24).toString("hex")}`
  fireEvent.input(screen.getByLabelText("Supabase project reference"), { target: { value: project_ref } })
  fireEvent.input(screen.getByLabelText("Personal access token"), { target: { value: token } })
  fireEvent.click(screen.getByRole("button", { name: "Connect with API token" }))
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith("/api/connectors/supabase-token", expect.objectContaining({ method: "POST",
    body: JSON.stringify({ site_id: "site-1", project_ref, token, delegate_account: true }) }))
})

test("explains which Supabase fields are invalid and never submits a project API key", () => {
  show(supabase)
  fireEvent.click(screen.getByRole("button", { name: "Supabase API token setup" }))
  const project = screen.getByLabelText("Supabase project reference")
  const token = screen.getByLabelText("Personal access token")
  const button = screen.getByRole("button", { name: "Connect with API token" })
  fireEvent.input(project, { target: { value: "https://example.supabase.co" } })
  fireEvent.input(token, { target: { value: `sb_secret_${randomBytes(24).toString("hex")}` } })
  fireEvent.click(button)
  expect(project).toHaveFocus()
  expect(project).toHaveAccessibleDescription(/20-character project reference/)
  expect(token).toHaveAccessibleDescription(/Account → Access Tokens, not a key from Project Settings/)
  expect(fetchMock).not.toHaveBeenCalled()
  fireEvent.input(project, { target: { value: "a".repeat(20) } })
  fireEvent.click(button)
  expect(token).toHaveFocus()
  expect(project).toHaveAttribute("aria-invalid", "false")
  expect(fetchMock).not.toHaveBeenCalled()
})

test("keeps setup actions hidden from users who cannot manage connectors", () => {
  show({ ...calendar, can_manage: false })
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
})
test("opens a hosted API-key link for a new toolkit without collecting the credential in the workspace", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "API_NOT_CONFIGURED" } }, 503))
  show({ ...detail, connections: [], toolkit: { ...detail.toolkit, slug: "examplecrm", auth_schemes: ["API_KEY"] }, auth_configs: [{ id:"config-key",name:"API key",auth_scheme:"API_KEY" }] })
  fireEvent.click(screen.getByRole("button",{name:"Connect account"}))
  expect(screen.queryByLabelText("Personal access token")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button",{name:"Continue to authorization"}))
  await screen.findByRole("alert")
  expect(fetchMock).toHaveBeenCalledWith("/api/connectors/auth-attempts/ask",expect.objectContaining({body:JSON.stringify({site_id:"site-1",toolkit_slug:"examplecrm",auth_config_id:"config-key"})}))
})

const setupKey = randomBytes(32).toString("hex")
const meta: ConnectorDetail = { ...detail, connections: [], auth_configs: [],
  toolkit: { ...detail.toolkit, slug: "metaads", name: "Meta Ads", auth_schemes: ["API_KEY", "OAUTH2"] },
  connection_setup: { kind: "managed_oauth", auth_scheme: "OAUTH2", setup_key: setupKey } }

test("Meta Ads uses one hosted authorization request and does not claim a connection before the callback", async () => {
  const virtualNavigation = jest.spyOn(console, "error").mockImplementation((error: unknown) => {
    if (!String(error).includes("Not implemented: navigation")) throw error
  })
  const response = deferred<Response>()
  const changed = jest.fn()
  fetchMock.mockReturnValue(response.promise)
  show(meta, changed)
  fireEvent.click(screen.getByRole("button", { name: "Connect account" }))
  expect(screen.getByRole("dialog")).toHaveAccessibleDescription(/prepare the provider’s managed sign-in.*does not enable Robots Ask/)
  expect(screen.queryByRole("button", { name: "Create OAuth configuration" })).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Continue to authorization" }))
  expect(screen.getByRole("button", { name: "Preparing authorization…" })).toBeDisabled()
  expect(fetchMock).toHaveBeenCalledWith("/api/connectors/auth-attempts/hosted", expect.objectContaining({ method: "POST",
    body: JSON.stringify({ site_id: "site-1", toolkit_slug: "metaads", expected_setup: setupKey }) }))
  response.resolve(jsonResponse({ attempt_id: "11111111-1111-4111-8111-111111111111", continuation: randomBytes(32).toString("hex"), redirect_url: "https://connect.composio.dev/link" }))
  await waitFor(() => expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true"))
  expect(virtualNavigation).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Not implemented: navigation") }))
  virtualNavigation.mockRestore()
  expect(changed).not.toHaveBeenCalled()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test.each(["api", "mcp"] as const)("discloses Ask incompatibility before authorizing a %s connection", type => {
  const setup_key = "e".repeat(64)
  show({ ...meta, toolkit: { ...meta.toolkit, toolkit_type: type }, connection_setup: type === "api"
    ? { kind: "hosted_credentials", auth_scheme: "BEARER_TOKEN", setup_key } : { kind: "managed_oauth", auth_scheme: "OAUTH2", setup_key } })
  fireEvent.click(screen.getByRole("button", { name: "Connect account" }))
  expect(screen.getByRole("dialog")).toHaveAccessibleDescription(/Robots Ask does not support this connection method/)
  expect(screen.getByRole("button", { name: type === "api" ? "Continue to secure form" : "Continue to authorization" })).toBeEnabled()
  expect(fetchMock).not.toHaveBeenCalled()
})

test("opens the secure credentials flow for a toolkit without a prior config", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "AUTH_CONFIG_PROVIDER_SETUP_REQUIRED" } }, 422))
  show({ ...meta, toolkit: { ...meta.toolkit, slug: "_1password", auth_schemes: ["API_KEY"] },
    connection_setup: { kind: "hosted_credentials", auth_scheme: "API_KEY", setup_key: setupKey } })
  fireEvent.click(screen.getByRole("button", { name: "Connect account" }))
  expect(screen.getByRole("dialog")).toHaveAccessibleDescription(/secure form to enter the credentials/)
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Continue to secure form" }))
  expect(await screen.findByRole("alert")).toHaveTextContent(/check the provider configuration and project key permissions/)
  expect(fetchMock).toHaveBeenCalledWith("/api/connectors/auth-attempts/hosted", expect.objectContaining({
    body: JSON.stringify({ site_id: "site-1", toolkit_slug: "_1password", expected_setup: setupKey }) }))
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("only lets the manager select currently eligible configurations", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ error: { code: "AUTH_CONFIG_UNAVAILABLE" } }, 422))
  show({ ...meta, auth_configs: [
    { id: "first", setup_key: randomBytes(32).toString("hex"), name: "Provider OAuth", auth_scheme: "OAUTH2" }, { id: "second", setup_key: setupKey, name: "A different OAuth app", auth_scheme: "OAUTH2" },
    { id: "blocked", name: "Shared key", auth_scheme: "API_KEY" },
  ], connection_setup: { kind: "existing", config_ids: ["first", "second"] } })
  fireEvent.click(screen.getByRole("button", { name: "Connect account" }))
  const button = screen.getByRole("button", { name: "Continue to authorization" })
  expect(button).toBeDisabled()
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Authorization configuration" }), { key: "ArrowDown" })
  expect(screen.queryByRole("option", { name: "Shared key" })).not.toBeInTheDocument()
  fireEvent.click(await screen.findByRole("option", { name: "A different OAuth app" }))
  expect(button).toBeEnabled()
  fireEvent.click(button)
  expect(await screen.findByRole("alert")).toHaveTextContent("Available sign-in options changed")
  expect(fetchMock).toHaveBeenCalledWith("/api/connectors/auth-attempts/hosted", expect.objectContaining({
    body: JSON.stringify({ site_id: "site-1", toolkit_slug: "metaads", auth_config_id: "second", expected_setup: setupKey }) }))
})

test("does not submit or fall back when an older API omits the selected config's setup key", async () => {
  show({ ...meta, auth_configs: [{ id: "first", name: "Provider OAuth", auth_scheme: "OAUTH2" }],
    connection_setup: { kind: "existing", config_ids: ["first"] } })
  fireEvent.click(screen.getByRole("button", { name: "Connect account" }))
  fireEvent.click(screen.getByRole("button", { name: "Continue to authorization" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Available sign-in options changed")
  expect(fetchMock).not.toHaveBeenCalled()
})

test("gives project-admin instructions for custom OAuth and never asks to connect a no-auth toolkit", () => {
  const refreshed = jest.fn()
  const page = show({ ...meta, connection_setup: { kind: "admin_oauth" } }, refreshed)
  fireEvent.click(screen.getByRole("button", { name: "Setup required" }))
  expect(screen.getByRole("dialog")).toHaveAccessibleDescription(/project administrator.*provider’s own OAuth app/)
  expect(screen.queryByRole("button", { name: "Continue to authorization" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  expect(refreshed).toHaveBeenCalledTimes(1)
  expect(fetchMock).not.toHaveBeenCalled()
  page.unmount()
  show({ ...meta, connection_setup: { kind: "no_auth" } })
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
})
