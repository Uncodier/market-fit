import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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
const enable = () => screen.findByRole("button", { name: "Turn on Ask access" })
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
async function confirmEnable() {
  fireEvent.click(await enable())
  const dialog = screen.getByRole("alertdialog", { name: `Allow Ask to use ${account.display_name}?` })
  fireEvent.click(within(dialog).getByRole("button", { name: "Turn on Ask access" }))
}
beforeEach(() => { http.mockReset(); jest.mocked(toast.success).mockClear() })

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
  expect(screen.queryByRole("button", { name: "Turn on Ask access" })).not.toBeInTheDocument()
  http.mockResolvedValueOnce(jsonResponse({ ...status, attested: false, direct_revision: 5 }))
  fireEvent.click(screen.getByRole("button", { name: "Clear any saved Ask access" }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith(`Ask access turned off for ${account.display_name}.`))
  expect(JSON.parse(String(patchCalls()[0][1]?.body))).toEqual({ site_id: site, expected_revision: status.revision, expected_direct_revision: 4, enabled: false })
  expect(screen.queryByRole("button", { name: "Clear any saved Ask access" })).not.toBeInTheDocument()
})

test.each(["all", "selected"] as const)("an off, verified legacy account can be explicitly enabled for its saved %s scope", async mode => {
  const changed = show({ ...accessDto, policy: { ...accessDto.policy, tool_access_mode: mode, allowed_tools: mode === "all" ? [] : ["MAIL_ADD_LABEL"], catalog_reads: false } })
  await load(status)
  expect(await enable()).toBeEnabled()
  expect(screen.getByText("Off")).toBeVisible()
  fireEvent.click(await enable())
  const dialog = screen.getByRole("alertdialog")
  expect(dialog).toHaveAccessibleDescription(mode === "all" ? /All compatible tools.*does not grant write access/ : /Only selected tools \(1 saved\).*exact IDs.*does not change the credential’s permissions/)
  expect(dialog).toHaveAccessibleDescription(/send data to the external provider.*create, change or delete.*only if the provider allows this credential to write.*fees may apply.*private receipt.*Nothing is published/)
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
  expect(http.mock.calls.map(([url]) => url)).toEqual([`${base}/access?site_id=${site}`, `${base}/provider-direct?site_id=${site}`])
  const pending = deferred<Response>()
  http.mockReturnValueOnce(pending.promise)
  await confirmEnable()
  expect(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Turn on Ask access" })).toBeDisabled()
  expect(changed).not.toHaveBeenCalled()
  expect(patchCalls()).toHaveLength(1)
  expect(patchCalls()[0][0]).toBe(`${base}/provider-direct`)
  expect(JSON.parse(String(patchCalls()[0][1]?.body))).toEqual({ site_id: site, expected_revision: status.revision, expected_direct_revision: 4, enabled: true })
  await act(async () => pending.resolve(jsonResponse({ ...status, enabled: true, direct_revision: 5 })))
  expect(changed).not.toHaveBeenCalled()
  expect(toast.success).toHaveBeenCalledWith(`Ask access turned on for ${account.display_name}.`)
  // No ordinary revision changed to force a remount: use the confirmed epoch on the next action.
  http.mockResolvedValueOnce(jsonResponse({ ...status, direct_revision: 6 }))
  fireEvent.click(screen.getByRole("button", { name: "Turn off Ask access" }))
  expect(await screen.findByText("Off")).toBeVisible()
  expect(JSON.parse(String(patchCalls()[1][1]?.body))).toEqual({ site_id: site, expected_revision: status.revision, expected_direct_revision: 5, enabled: false })
})

test("unsaved host and tool edits never become authority for opt-in", async () => {
  show({ ...accessDto, policy: { ...accessDto.policy, tool_access_mode: "selected", allowed_tools: [], allowed_hosts: [] } })
  await load(status)
  expect(await enable()).toBeEnabled()
  fireEvent.click(await enable())
  expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(/Only selected tools \(0 saved\).*Your saved policy currently blocks calls/)
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }))
  fireEvent.click(screen.getByRole("radio", { name: "All compatible tools" }))
  fireEvent.click(screen.getByRole("checkbox", { name: "Allow the interactive assistant" }))
  expect(await enable()).toBeDisabled()
  expect(screen.getByText(/Turning on Ask uses the saved permissions, not the draft/)).toBeVisible()
  expect(patchCalls()).toHaveLength(0)
})

test("a different policy revision cannot be combined with the displayed scope", async () => {
  const changed = show()
  await load({ ...status, revision: status.revision + 1 })
  expect(await screen.findByRole("alert")).toHaveTextContent(/connector changed/i)
  expect(screen.queryByRole("button", { name: "Turn on Ask access" })).not.toBeInTheDocument()
  http.mockResolvedValueOnce(jsonResponse(status))
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  expect(await enable()).toBeEnabled()
  expect(changed).toHaveBeenCalledTimes(1)
  expect(patchCalls()).toHaveLength(0)
})

test("first setup is not an enrollment; a fresh verified status becomes available without a second click to enable", async () => {
  show()
  await load({ ...status, attested: false, setup_pending: true })
  expect(await screen.findByText("Waiting for verification")).toBeVisible()
  expect(screen.getByRole("button", { name: "Cancel automatic setup" })).toBeEnabled()
  expect(screen.queryByRole("button", { name: "Turn on Ask access" })).not.toBeInTheDocument()
  expect(screen.queryByText("Available to authorized members")).not.toBeInTheDocument()
  http.mockResolvedValueOnce(jsonResponse({ ...status, setup_pending: false, enabled: true, direct_revision: 6 }))
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  expect(await screen.findByText("Available to authorized members")).toBeVisible()
  expect(screen.getByRole("button", { name: "Turn off Ask access" })).toBeEnabled()
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

test.each([true, false])("only a server-confirmed shared Makinari project is labeled scoped-read-only (hint: %s)", async known => {
  show(accessDto, true, { ...account, toolkit_slug: "supabase", display_name: "Makinari shared project" })
  await load({ ...status, attested: false, setup_pending: false, ...(known && { unsupported_reason: "shared_makinari_project" }) })
  expect(await screen.findByText(known ? "Makinari reports only" : "Off · not verified")).toBeVisible()
  expect(screen.queryByText(/This account is bound to Makinari’s shared Supabase project/) !== null).toBe(known)
  expect(screen.queryByRole("button", { name: "Turn on Ask access" })).not.toBeInTheDocument()
  expect(patchCalls()).toHaveLength(0)
})

test("known shared project never promises availability even if first setup was requested", async () => {
  show()
  await load({ ...status, attested: false, setup_pending: true, unsupported_reason: "shared_makinari_project" })
  expect(await screen.findByText("Makinari reports only")).toBeVisible()
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

test("turning off a verified account never submits or discards an unsaved tool restriction", async () => {
  const changed = show()
  await load({ ...status, enabled: true, setup_pending: false })
  const selected = screen.getByRole("radio", { name: "Only selected tools" })
  fireEvent.click(selected)
  http.mockResolvedValueOnce(jsonResponse({ ...status, setup_pending: false, direct_revision: 5 }))
  fireEvent.click(await screen.findByRole("button", { name: "Turn off Ask access" }))
  expect(await screen.findByText("Off")).toBeVisible()
  expect(selected).toBeChecked()
  expect(await enable()).toBeDisabled()
  expect(changed).not.toHaveBeenCalled()
  expect(patchCalls()).toHaveLength(1)
  expect(JSON.parse(String(patchCalls()[0][1]?.body))).toEqual({ site_id: site, expected_revision: status.revision, expected_direct_revision: 4, enabled: false })
})

test.each(["revision conflict", "attestation lost", "wrong receipt"])("%s never displays success or automatically retries the mutation", async failure => {
  const changed = show()
  await load(status)
  const malformed = failure === "wrong receipt"
  http.mockResolvedValueOnce(malformed ? jsonResponse({ ...status, revision: status.revision + 1 })
    : jsonResponse({ error: { code: failure === "revision conflict" ? "REVISION_CONFLICT" : "DIRECT_ATTESTATION_REQUIRED", message: "upstream debug" } }, 409))
  await confirmEnable()
  const alert = await screen.findByRole("alert")
  expect(alert).toHaveTextContent(malformed ? /outcome is not confirmed/ : failure === "revision conflict" ? /connector changed/i : /Ask needs current verification/)
  expect(alert).not.toHaveTextContent("upstream debug")
  expect(screen.queryByRole("button", { name: "Turn on Ask access" })).not.toBeInTheDocument()
  expect(toast.success).not.toHaveBeenCalled()
  expect(changed).not.toHaveBeenCalled()
  http.mockResolvedValueOnce(jsonResponse({ ...status, direct_revision: 8 }))
  fireEvent.click(within(alert).getByRole("button", { name: "Refresh status" }))
  expect(await enable()).toBeEnabled()
  expect(changed).not.toHaveBeenCalled()
  expect(patchCalls()).toHaveLength(1)
})