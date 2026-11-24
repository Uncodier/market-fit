import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { ConnectorAccessPanel } from "@/app/connectors/connector-access"
import type { ConnectorAccess } from "@/app/connectors/types"
import { access, connector, deferred, jsonResponse, translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn() } }))
const http = jest.mocked(fetch)
const site = "11111111-1111-4111-8111-111111111111"
const account = { ...connector, enabled: true, id: "22222222-2222-4222-8222-222222222222" }
const status = { connector_id: account.id, revision: account.revision, direct_revision: 4, attested: true, enabled: false }
const base = `/api/connectors/connections/${account.id}`
const accessDto: ConnectorAccess = { ...access, connector_id: account.id, policy: { ...access.policy, tool_access_mode: "all", catalog_reads: true } }
const allow = () => screen.findByRole("checkbox", { name: "Allow Ask to use this account" })
const save = () => screen.getByRole("button", { name: "Save policy" })
const patchCalls = () => http.mock.calls.filter(([, init]) => init?.method === "PATCH")

function show(dto = accessDto, manage = true, selected = account) {
  const changed = jest.fn()
  http.mockResolvedValueOnce(jsonResponse(dto))
  render(<ConnectorAccessPanel siteId={site} connector={selected} canManage={manage} onChanged={changed} />)
  return changed
}
async function load(data: unknown) {
  http.mockResolvedValueOnce(jsonResponse(data))
  await screen.findByRole("heading", { name: "Robots Ask access" })
}
beforeEach(() => { http.mockReset(); jest.mocked(toast.success).mockClear() })

const memberStatus = { ...status, enabled: true, authorization_mode: "member_policy", explicitly_disabled: false }
test.each([false, null])("blocks unsupported or unverified Ask opt-in (%s) without blocking policy reads", async compatible => {
  show({ ...accessDto, policy: { ...accessDto.policy, allowed_hosts: [] } })
  await load({ ...status, enabled: false, attested: false, authorization_mode: "host_policy", assistant_allowed: false, ask_compatible: compatible })
  expect(await screen.findByRole("checkbox", { name: "Allow Robots Ask on this account" })).toBeDisabled()
  expect(screen.getByText(compatible === null ? "Ask compatibility could not be verified" : "Connected method not supported by Ask")).toBeVisible()
  expect(patchCalls()).toHaveLength(0)
})

test("an incompatible saved host can still be turned off", async () => {
  const changed = show({ ...accessDto, policy: { ...accessDto.policy, allowed_hosts: ["assistant"] } })
  await load({ ...status, enabled: false, attested: false, authorization_mode: "host_policy", assistant_allowed: true, ask_compatible: false })
  const toggle = await screen.findByRole("checkbox", { name: "Allow Robots Ask on this account" })
  expect(toggle).toBeEnabled()
  fireEvent.click(toggle)
  http.mockResolvedValueOnce(jsonResponse({ connector_id: account.id, revision: 5 }))
  fireEvent.click(save())
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
  expect(JSON.parse(String(patchCalls()[0][1]?.body)).allowed_hosts).toEqual([])
})
const hostControl = () => screen.findByRole("checkbox", { name: "Allow the interactive assistant on this account" })

test.each([false, true])("uses one Ask setting even without execution authorization (currently on: %s)", async current => {
  const changed = show({ ...accessDto, policy: { ...accessDto.policy, allowed_hosts: current ? ["assistant", "direct"] : ["direct"] } },
    true, { ...account, toolkit_slug: "supabase" })
  await load({ ...status, enabled: false, attested: false, authorization_mode: "host_policy", assistant_allowed: current, setup_pending: false })
  expect(await screen.findByText(current ? "Ask is on · execution not authorized" : "Ask is off")).toBeVisible()
  const toggle = screen.getByRole("checkbox", { name: "Allow Robots Ask on this account" })
  if (current) expect(toggle).toBeChecked(); else expect(toggle).not.toBeChecked()
  expect(screen.queryByRole("button", { name: "Restore Ask access on save" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Turn off Ask access" })).not.toBeInTheDocument()
  fireEvent.click(toggle)
  http.mockResolvedValueOnce(jsonResponse({ connector_id: account.id, revision: 5 }))
  fireEvent.click(save())
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
  expect(patchCalls()).toHaveLength(1)
  expect(patchCalls()[0][0]).toBe(`${base}/policy`)
  const body = JSON.parse(String(patchCalls()[0][1]?.body))
  expect(body.allowed_hosts).toEqual(current ? ["direct"] : ["direct", "assistant"])
  expect(body).not.toHaveProperty("ask_access")
  expect(body).not.toHaveProperty("catalog_reads")
})

test.each(["disabled account", "empty selected scope", "assistant host off"])("member-policy eligibility alone is insufficient: %s", async reason => {
  show({ ...accessDto, policy: { ...accessDto.policy, tool_access_mode: "selected", allowed_hosts: reason === "assistant host off" ? [] : ["assistant"],
    allowed_tools: reason === "empty selected scope" ? [] : ["MAIL_ADD_LABEL"] } }, true, { ...account, enabled: reason !== "disabled account" })
  await load(memberStatus)
  expect(await screen.findByText("Blocked by account or tool settings")).toBeVisible()
  expect(screen.queryByText("Available to authorized members")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Restore Ask access on save" })).not.toBeInTheDocument()
  expect(save()).toBeDisabled()
  expect(patchCalls()).toHaveLength(0)
})

test("unverified member-policy status is not an explicit disable or a claim about shared SQL authority", async () => {
  show(accessDto, true, { ...account, toolkit_slug: "supabase", display_name: "Shared project" })
  await load({ ...memberStatus, enabled: false, attested: false })
  expect(await screen.findByText("Generic provider tools not verified")).toBeVisible()
  expect(screen.getByRole("button", { name: "Restore Ask access on save" })).toBeDisabled()
  expect(screen.queryByText("Turned off by a manager")).not.toBeInTheDocument()
  expect(screen.queryByText("Available to authorized members")).not.toBeInTheDocument()
  expect(patchCalls()).toHaveLength(0)
})

test.each(["all", "selected"] as const)("verified %s member policy needs no enrollment; removing the host preserves other hosts", async mode => {
  show({ ...accessDto, policy: { ...accessDto.policy, allowed_hosts: ["assistant", "direct"], tool_access_mode: mode, allowed_tools: ["MAIL_ADD_LABEL"] } })
  await load(memberStatus)
  expect(await screen.findByText("Available to authorized members")).toBeVisible()
  expect(screen.queryByRole("checkbox", { name: "Allow Ask to use this account" })).not.toBeInTheDocument()
  expect(save()).toBeDisabled()
  expect(patchCalls()).toHaveLength(0)
  fireEvent.click(await hostControl())
  http.mockResolvedValueOnce(jsonResponse({ revision: 5 }))
  fireEvent.click(save())
  await waitFor(() => expect(patchCalls()).toHaveLength(1))
  const body = JSON.parse(String(patchCalls()[0][1]?.body))
  expect(body).toMatchObject({ allowed_hosts: ["direct"], tool_access_mode: mode, allowed_tools: ["MAIL_ADD_LABEL"] })
  expect(body).not.toHaveProperty("ask_access")
})

test("ordinary edits do not restore a deliberate block or an absent assistant host", async () => {
  show({ ...accessDto, policy: { ...accessDto.policy, allowed_hosts: ["direct"] } })
  await load({ ...memberStatus, enabled: false, explicitly_disabled: true })
  expect(await screen.findByText("Turned off by a manager")).toBeVisible()
  expect(await hostControl()).not.toBeChecked()
  expect(screen.getByRole("button", { name: "Restore Ask access on save" })).toBeDisabled()
  fireEvent.click(screen.getByRole("radio", { name: "Only selected tools" }))
  http.mockResolvedValueOnce(jsonResponse({ revision: 5 }))
  fireEvent.click(save())
  await waitFor(() => expect(patchCalls()).toHaveLength(1))
  const body = JSON.parse(String(patchCalls()[0][1]?.body))
  expect(body.allowed_hosts).toEqual(["direct"])
  expect(body).not.toHaveProperty("ask_access")
})

test("keeps the restore button visible and explains why an explicitly disabled unverified account cannot be restored", async () => {
  show(accessDto, true, { ...account, toolkit_slug: "supabase" })
  await load({ ...memberStatus, enabled: false, attested: false, explicitly_disabled: true })
  expect(await screen.findByText("Ask is off · not authorized for execution")).toBeVisible()
  expect(screen.getByText(/this connection has no current authorization.*cannot be restored here/i)).toBeVisible()
  expect(await hostControl()).toBeChecked()
  const restore = screen.getByRole("button", { name: "Restore Ask access on save" })
  expect(restore).toBeVisible()
  expect(restore).toBeDisabled()
  fireEvent.click(restore)
  expect(save()).toBeDisabled()
  expect(patchCalls()).toHaveLength(0)
})

test("only an explicit restore with usable scope and host clears the block in a single revision-bound save", async () => {
  show({ ...accessDto, policy: { ...accessDto.policy, allowed_hosts: [], allowed_tools: [], tool_access_mode: "selected" } })
  await load({ ...memberStatus, enabled: false, explicitly_disabled: true })
  const restore = await screen.findByRole("button", { name: "Restore Ask access on save" })
  fireEvent.click(await hostControl())
  expect(restore).toBeDisabled()
  fireEvent.click(screen.getByRole("radio", { name: "All catalog tools" }))
  fireEvent.click(restore)
  fireEvent.click(await hostControl())
  expect(save()).toBeDisabled()
  fireEvent.click(await hostControl())
  expect(patchCalls()).toHaveLength(0)
  http.mockResolvedValueOnce(jsonResponse({ connector_id: account.id, revision: 5, direct_revision: 5, ask_enabled: true }))
  fireEvent.click(save())
  await waitFor(() => expect(patchCalls()).toHaveLength(1))
  expect(JSON.parse(String(patchCalls()[0][1]?.body))).toMatchObject({ allowed_hosts: ["assistant"], tool_access_mode: "all",
    expected_revision: 4, ask_access: { enabled: true, expected_direct_revision: 4 } })
})

test("restores a delegated Supabase account without a separate binding or attestation step", async () => {
  show(accessDto, true, { ...account, toolkit_slug: "supabase" })
  await load({ ...memberStatus, authority_kind: "connected_account", attested: false, enabled: false, explicitly_disabled: true })
  const restore = await screen.findByRole("button", { name: "Restore Ask access on save" })
  expect(restore).toBeEnabled()
  fireEvent.click(restore)
  http.mockResolvedValueOnce(jsonResponse({ connector_id: account.id, revision: 5, direct_revision: 5, ask_enabled: true }))
  fireEvent.click(save())
  await waitFor(() => expect(patchCalls()).toHaveLength(1))
  expect(patchCalls()[0][0]).toBe(`${base}/policy`)
  const body = JSON.parse(String(patchCalls()[0][1]?.body))
  expect(body.ask_access).toEqual({ enabled: true, expected_direct_revision: 4 })
  expect(body).not.toHaveProperty("project_ref")
})

test("standalone disable reloads the member status rather than treating a legacy receipt as a legacy server", async () => {
  show()
  await load(memberStatus)
  const disable = await screen.findByRole("button", { name: "Turn off Ask access" })
  http.mockResolvedValueOnce(jsonResponse({ ...status, direct_revision: 5 }))
    .mockResolvedValueOnce(jsonResponse({ ...memberStatus, direct_revision: 5, enabled: false, explicitly_disabled: true }))
  fireEvent.click(disable)
  expect(await screen.findByText("Turned off by a manager")).toBeVisible()
  expect(await hostControl()).toBeChecked()
  expect(screen.queryByRole("checkbox", { name: "Allow Ask to use this account" })).not.toBeInTheDocument()
  expect(patchCalls()).toHaveLength(1)
  expect(JSON.parse(String(patchCalls()[0][1]?.body))).toEqual({ site_id: site, expected_revision: 4, expected_direct_revision: 4, enabled: false })
})

test("legacy read/all and verified login are not proof or consent; an ordinary member cannot fetch the manager report", async () => {
  show({ ...accessDto, can_manage: false }, false)
  expect(await screen.findByText(/Member access alone does not make tools available/)).toBeVisible()
  expect(screen.queryByRole("button", { name: /Ask access/ })).not.toBeInTheDocument()
  expect(screen.queryByText("Available to authorized members")).not.toBeInTheDocument()
  expect(http.mock.calls.map(([url]) => url)).toEqual([`${base}/access?site_id=${site}`])
})

test("an unattested account never offers enable; managers can clear consent after proof loss", async () => {
  show()
  await load({ ...status, attested: false })
  expect(await screen.findByText("Off · not verified")).toBeVisible()
  expect(screen.queryByRole("checkbox", { name: "Allow Ask to use this account" })).not.toBeInTheDocument()
  http.mockResolvedValueOnce(jsonResponse({ ...status, attested: false, direct_revision: 5 }))
  fireEvent.click(screen.getByRole("button", { name: "Clear any saved Ask access" }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(`Ask access turned off for ${account.display_name}.`))
  expect(JSON.parse(String(patchCalls()[0][1]?.body))).toEqual({ site_id: site, expected_revision: status.revision, expected_direct_revision: 4, enabled: false })
  expect(screen.queryByRole("button", { name: "Clear any saved Ask access" })).not.toBeInTheDocument()
})

test.each(["all", "selected"] as const)("one policy save grants a verified account with the chosen %s scope", async mode => {
  const dto = { ...accessDto, policy: { ...accessDto.policy, tool_access_mode: mode, allowed_tools: ["MAIL_ADD_LABEL"], catalog_reads: false } }
  const changed = show(dto)
  await load(status)
  expect(await allow()).not.toBeChecked() // An existing assistant host is not generic Ask consent.
  expect(save()).toBeDisabled()
  fireEvent.click(await allow())
  expect(screen.getByText(/send data to the external provider.*create, change or delete.*fees may apply.*private receipt/i)).toBeVisible()
  expect(patchCalls()).toHaveLength(0)
  const pending = deferred<Response>()
  http.mockReturnValueOnce(pending.promise)
  fireEvent.click(save())
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled()
  expect(changed).not.toHaveBeenCalled()
  expect(patchCalls()).toHaveLength(1)
  expect(patchCalls()[0][0]).toBe(`${base}/policy`)
  expect(JSON.parse(String(patchCalls()[0][1]?.body))).toEqual({ site_id: site, expected_revision: status.revision,
    ask_access: { enabled: true, expected_direct_revision: 4 }, enabled: true, tool_access_mode: mode,
    allowed_tools: ["MAIL_ADD_LABEL"], allowed_hosts: ["assistant"], require_approval: true })
  await act(async () => pending.resolve(jsonResponse({ connector_id: account.id, revision: 5, direct_revision: 5, ask_enabled: true })))
  expect(changed).toHaveBeenCalledTimes(1)
})

test("no dormant grant: select a usable scope and grant the assistant host in the same save", async () => {
  show({ ...accessDto, policy: { ...accessDto.policy, tool_access_mode: "selected", allowed_tools: [], allowed_hosts: ["direct"] } })
  await load(status)
  expect(await allow()).toBeDisabled()
  fireEvent.click(screen.getByRole("radio", { name: "All catalog tools" }))
  expect(await allow()).not.toBeChecked()
  fireEvent.click(await allow())
  fireEvent.click(screen.getByRole("radio", { name: "Only selected tools" }))
  expect(save()).toBeDisabled()
  fireEvent.click(screen.getByRole("radio", { name: "All catalog tools" }))
  http.mockResolvedValueOnce(jsonResponse({ connector_id: account.id, revision: 5, direct_revision: 5, ask_enabled: true }))
  fireEvent.click(save())
  await waitFor(() => expect(patchCalls()).toHaveLength(1))
  expect(JSON.parse(String(patchCalls()[0][1]?.body))).toMatchObject({ allowed_hosts: ["direct", "assistant"], tool_access_mode: "all", ask_access: { enabled: true, expected_direct_revision: 4 } })
})

test.each([true, false])("unrelated edits preserve opt-outs and the saved host (existing assistant host: %s)", async host => {
  const hosts = host ? ["direct", "assistant"] : ["direct"]
  show({ ...accessDto, policy: { ...accessDto.policy, allowed_hosts: hosts } })
  await load(status)
  fireEvent.click(await allow()); fireEvent.click(await allow()) // Undo the grant draft.
  fireEvent.click(screen.getByRole("checkbox", { name: "Allow requests for access" }))
  http.mockResolvedValueOnce(jsonResponse({ revision: 5 }))
  fireEvent.click(save())
  await waitFor(() => expect(patchCalls()).toHaveLength(1))
  const body = JSON.parse(String(patchCalls()[0][1]?.body))
  expect(body.allowed_hosts).toEqual(hosts)
  expect(body).not.toHaveProperty("ask_access")
})

test("a different policy revision cannot be combined with the displayed scope", async () => {
  const changed = show()
  await load({ ...status, revision: status.revision + 1 })
  expect(await screen.findByRole("alert")).toHaveTextContent(/connector changed/i)
  expect(screen.queryByRole("checkbox", { name: "Allow Ask to use this account" })).not.toBeInTheDocument()
  http.mockResolvedValueOnce(jsonResponse(status))
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  expect(await allow()).toBeEnabled()
  expect(changed).toHaveBeenCalledTimes(1)
  expect(patchCalls()).toHaveLength(0)
})

test("refresh discards an unsaved Ask grant and its implicit host change, not other drafts", async () => {
  show({ ...accessDto, policy: { ...accessDto.policy, allowed_hosts: ["direct"] } })
  await load(status)
  fireEvent.click(await allow())
  fireEvent.click(screen.getByRole("checkbox", { name: "Allow requests for access" }))
  http.mockResolvedValueOnce(jsonResponse({ ...status, direct_revision: 6 }))
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  expect(await allow()).not.toBeChecked()
  http.mockResolvedValueOnce(jsonResponse({ revision: 5 }))
  fireEvent.click(save())
  await waitFor(() => expect(patchCalls()).toHaveLength(1))
  const body = JSON.parse(String(patchCalls()[0][1]?.body))
  expect(body).not.toHaveProperty("ask_access")
  expect(body).toMatchObject({ allowed_hosts: ["direct"], require_approval: false })
})

test("first setup is not an enrollment; a fresh verified status becomes available without a second click to enable", async () => {
  show()
  await load({ ...status, attested: false, setup_pending: true })
  expect(await screen.findByText("Waiting for verification")).toBeVisible()
  expect(screen.getByRole("button", { name: "Cancel automatic setup" })).toBeEnabled()
  expect(screen.queryByRole("checkbox", { name: "Allow Ask to use this account" })).not.toBeInTheDocument()
  expect(screen.queryByText("Available to authorized members")).not.toBeInTheDocument()
  http.mockResolvedValueOnce(jsonResponse({ ...status, setup_pending: false, enabled: true, direct_revision: 6 }))
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  expect(await screen.findByText("Available to authorized members")).toBeVisible()
  expect(await allow()).toBeChecked()
  expect(screen.queryByRole("button", { name: "Cancel automatic setup" })).not.toBeInTheDocument()
  expect(patchCalls()).toHaveLength(0)
})

test.each([true, false, undefined])("cancel before proof requires an exact receipt confirming no pending setup (returned: %s)", async returned => {
  show()
  await load({ ...status, attested: false, setup_pending: true })
  http.mockResolvedValueOnce(jsonResponse({ ...status, attested: false, direct_revision: 5, setup_pending: returned }))
  fireEvent.click(await screen.findByRole("button", { name: "Cancel automatic setup" }))
  if (returned === false) {
    expect(await screen.findByText("Off · not verified")).toBeVisible()
    expect(toast.success).toHaveBeenCalledWith(`Ask access turned off for ${account.display_name}.`)
  } else {
    expect(await screen.findByRole("alert")).toHaveTextContent(/outcome is not confirmed/)
    expect(toast.success).not.toHaveBeenCalled()
  }
  expect(patchCalls()).toHaveLength(1)
  expect(JSON.parse(String(patchCalls()[0][1]?.body))).toEqual({ site_id: site, expected_revision: status.revision, expected_direct_revision: 4, enabled: false })
})

test.each([true, false])("only an explicit legacy server denial is labeled unavailable (hint: %s)", async known => {
  show(accessDto, true, { ...account, toolkit_slug: "supabase", display_name: "Makinari shared project" })
  await load({ ...status, attested: false, setup_pending: false, ...(known && { unsupported_reason: "shared_makinari_project" }) })
  expect(await screen.findByText(known ? "Unavailable in Ask" : "Off · not verified")).toBeVisible()
  expect(screen.queryByText(/Ask execution is unavailable for this account/) !== null).toBe(known)
  expect(screen.queryByRole("checkbox", { name: "Allow Ask to use this account" })).not.toBeInTheDocument()
  expect(patchCalls()).toHaveLength(0)
})

test("known shared project never promises availability even if first setup was requested", async () => {
  show()
  await load({ ...status, attested: false, setup_pending: true, unsupported_reason: "shared_makinari_project" })
  expect(await screen.findByText("Unavailable in Ask")).toBeVisible()
  expect(screen.getByRole("button", { name: "Cancel automatic setup" })).toBeEnabled()
  expect(screen.queryByText("Waiting for verification")).not.toBeInTheDocument()
  expect(patchCalls()).toHaveLength(0)
})

test.each([{ allowed_tools: [], allowed_hosts: ["assistant"] }, { allowed_tools: ["MAIL_ADD_LABEL"], allowed_hosts: [] }])("no claim of usable tools when the saved policy blocks calls (%j)", async scope => {
  show({ ...accessDto, policy: { ...accessDto.policy, tool_access_mode: "selected", ...scope } })
  await load({ ...status, enabled: true, setup_pending: false })
  expect(await screen.findByText("On · tools unavailable")).toBeVisible()
  expect(screen.getByRole("button", { name: "Turn off Ask access" })).toBeEnabled()
  expect(screen.queryByText("Available to authorized members")).not.toBeInTheDocument()
  expect(patchCalls()).toHaveLength(0)
})

test("an omitted saved tool mode cannot confirm availability, but does not prevent turning Ask off", async () => {
  show({ ...accessDto, policy: { ...accessDto.policy, tool_access_mode: undefined, allowed_tools: ["MAIL_ADD_LABEL"] } })
  await load({ ...status, enabled: true })
  expect(await screen.findByText("On · tool scope unknown")).toBeVisible()
  expect(screen.getByRole("button", { name: "Turn off Ask access" })).toBeEnabled()
  expect(screen.queryByText("Available to authorized members")).not.toBeInTheDocument()
})

test("unchecking Ask removes only the assistant host and revokes consent on the same policy save", async () => {
  const changed = show({ ...accessDto, policy: { ...accessDto.policy, allowed_hosts: ["assistant", "direct"] } })
  await load({ ...status, enabled: true })
  expect(await allow()).toBeChecked()
  fireEvent.click(await allow())
  http.mockResolvedValueOnce(jsonResponse({ connector_id: account.id, revision: 5, direct_revision: 5, ask_enabled: false }))
  fireEvent.click(save())
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
  expect(patchCalls()).toHaveLength(1)
  expect(JSON.parse(String(patchCalls()[0][1]?.body))).toMatchObject({ allowed_hosts: ["direct"], ask_access: {enabled: false, expected_direct_revision: 4} })
})

test.each(["revision conflict", "attestation lost", "wrong receipt"])("%s never displays success or retries the policy or standalone opt-in", async failure => {
  const changed = show()
  await load(status)
  const malformed = failure === "wrong receipt"
  http.mockResolvedValueOnce(malformed ? jsonResponse({ connector_id: account.id, revision: 5 })
    : jsonResponse({ error: { code: failure === "revision conflict" ? "REVISION_CONFLICT" : "DIRECT_ATTESTATION_REQUIRED", message: "upstream debug" } }, 409))
  fireEvent.click(await allow()); fireEvent.click(save())
  const alert = await screen.findByRole("alert")
  expect(alert).toHaveTextContent(malformed ? /outcome is not confirmed/ : failure === "revision conflict" ? /connector changed/i : /Ask needs current verification/)
  expect(alert).not.toHaveTextContent("upstream debug")
  expect(save()).toBeDisabled()
  expect(changed).not.toHaveBeenCalled()
  expect(patchCalls()).toHaveLength(1)
  expect(patchCalls()[0][0]).toBe(`${base}/policy`)
})

test("a business OAuth account needs no independent resource attestation", async () => {
  show({ ...accessDto, policy: { ...accessDto.policy, allowed_hosts: ["assistant"], tool_access_mode: "all" } })
  await load({ ...memberStatus, attested: false, authority_kind: "connected_account" })
  expect(await screen.findByText("Available to authorized members")).toBeVisible()
  expect(screen.queryByText("Generic provider tools not verified")).not.toBeInTheDocument()
  expect(patchCalls()).toHaveLength(0)
})
