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
const review = () => screen.findByRole("button", { name: "Review provider-direct access" })
const enable = () => screen.findByRole("button", { name: "Enable provider-direct execution" })
const patchCalls = () => http.mock.calls.filter(([, init]) => init?.method === "PATCH")

function show(dto = accessDto, manage = true) {
  const changed = jest.fn()
  http.mockResolvedValueOnce(jsonResponse(dto))
  render(<ConnectorAccessPanel siteId={site} connector={account} canManage={manage} onChanged={changed} />)
  return changed
}
async function load(data: unknown) {
  http.mockResolvedValueOnce(jsonResponse(data))
  fireEvent.click(await review())
}
async function confirmEnable() {
  fireEvent.click(await enable())
  const dialog = screen.getByRole("alertdialog", { name: `Enable direct execution for ${account.display_name}?` })
  fireEvent.click(within(dialog).getByRole("button", { name: "Enable provider-direct execution" }))
}
beforeEach(() => { http.mockReset(); jest.mocked(toast.success).mockClear() })

test("legacy read/all and verified login are not proof or consent; an ordinary member cannot fetch the manager report", async () => {
  show({ ...accessDto, can_manage: false }, false)
  expect(await screen.findByText(/Your member access alone does not enable it/)).toBeVisible()
  expect(screen.queryByRole("button", { name: "Review provider-direct access" })).not.toBeInTheDocument()
  expect(screen.queryByText("Inactive — no effective opt-in")).not.toBeInTheDocument()
  expect(http.mock.calls.map(([url]) => url)).toEqual([`${base}/access?site_id=${site}`])
})

test("a manager cannot self-verify an unattested account but can clear consent after proof loss", async () => {
  const changed = show()
  await load({ ...status, attested: false })
  expect(await enable()).toBeDisabled()
  expect(screen.getByText(/A workspace manager cannot verify this boundary here/)).toBeVisible()
  expect(screen.getByText("Inactive — no effective opt-in")).toBeVisible()
  http.mockResolvedValueOnce(jsonResponse({ ...status, attested: false, direct_revision: 5 }))
  fireEvent.click(screen.getByRole("button", { name: "Clear saved provider-direct consent" }))
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
  expect(JSON.parse(String(patchCalls()[0][1]?.body))).toEqual({ site_id: site, expected_revision: status.revision, expected_direct_revision: 4, enabled: false })
  expect(toast.success).toHaveBeenCalledWith(`Provider-direct consent cleared for ${account.display_name}.`)
})

test.each(["all", "selected"] as const)("requires an explicit informed opt-in for the saved %s scope, not the legacy flags", async mode => {
  const changed = show({ ...accessDto, policy: { ...accessDto.policy, tool_access_mode: mode, allowed_tools: mode === "all" ? [] : ["MAIL_ADD_LABEL"], catalog_reads: false } })
  await load(status)
  expect(await enable()).toBeEnabled()
  expect(screen.getByText("Inactive — no effective opt-in")).toBeVisible()
  fireEvent.click(await enable())
  const dialog = screen.getByRole("alertdialog")
  expect(dialog).toHaveAccessibleDescription(mode === "all" ? /All compatible tools, including new provider actions and writes/ : /Only selected tools \(1 saved\).*exact IDs/)
  expect(dialog).toHaveAccessibleDescription(/send data to the external provider.*create, change or delete.*fees may apply.*private receipt.*does not publish/)
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }))
  expect(http.mock.calls.map(([url]) => url)).toEqual([`${base}/access?site_id=${site}`, `${base}/provider-direct?site_id=${site}`])
  const pending = deferred<Response>()
  http.mockReturnValueOnce(pending.promise)
  await confirmEnable()
  expect(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Enable provider-direct execution" })).toBeDisabled()
  expect(changed).not.toHaveBeenCalled()
  expect(patchCalls()).toHaveLength(1)
  expect(patchCalls()[0][0]).toBe(`${base}/provider-direct`)
  expect(JSON.parse(String(patchCalls()[0][1]?.body))).toEqual({ site_id: site, expected_revision: status.revision, expected_direct_revision: 4, enabled: true })
  await act(async () => pending.resolve(jsonResponse({ ...status, enabled: true, direct_revision: 5 })))
  expect(changed).toHaveBeenCalledTimes(1)
  expect(toast.success).toHaveBeenCalledWith(`Provider-direct execution enabled for ${account.display_name}.`)
  // No ordinary revision changed to force a remount: use the confirmed epoch on the next action.
  http.mockResolvedValueOnce(jsonResponse({ ...status, direct_revision: 6 }))
  fireEvent.click(screen.getByRole("button", { name: "Revoke provider-direct access" }))
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(2))
  expect(JSON.parse(String(patchCalls()[1][1]?.body))).toEqual({ site_id: site, expected_revision: status.revision, expected_direct_revision: 5, enabled: false })
})

test("unsaved host and tool edits never become authority for opt-in", async () => {
  show({ ...accessDto, policy: { ...accessDto.policy, tool_access_mode: "selected", allowed_tools: [], allowed_hosts: [] } })
  await load(status)
  expect(await enable()).toBeEnabled()
  expect(screen.getByText(/saved policy does not currently allow calls/)).toBeVisible()
  fireEvent.click(screen.getByRole("radio", { name: "All compatible tools" }))
  fireEvent.click(screen.getByRole("checkbox", { name: "Allow the interactive assistant" }))
  expect(await enable()).toBeDisabled()
  expect(screen.getByText(/discard other policy edits before opting in/)).toBeVisible()
  expect(screen.getByText(/Saved scope: Only selected tools \(0 saved\)/)).toBeVisible()
  expect(patchCalls()).toHaveLength(0)
})

test("a different policy revision cannot be combined with the displayed scope", async () => {
  const changed = show()
  await load({ ...status, revision: status.revision + 1 })
  expect(await screen.findByRole("alert")).toHaveTextContent(/connector changed/i)
  expect(screen.queryByRole("button", { name: "Enable provider-direct execution" })).not.toBeInTheDocument()
  http.mockResolvedValueOnce(jsonResponse(status))
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  expect(await enable()).toBeEnabled()
  expect(changed).toHaveBeenCalledTimes(1)
  expect(patchCalls()).toHaveLength(0)
})

test.each(["revision conflict", "attestation lost", "wrong receipt"])("%s never displays success or automatically retries the mutation", async failure => {
  const changed = show()
  await load(status)
  const malformed = failure === "wrong receipt"
  http.mockResolvedValueOnce(malformed ? jsonResponse({ ...status, revision: status.revision + 1 })
    : jsonResponse({ error: { code: failure === "revision conflict" ? "REVISION_CONFLICT" : "DIRECT_ATTESTATION_REQUIRED", message: "upstream debug" } }, 409))
  await confirmEnable()
  const alert = await screen.findByRole("alert")
  expect(alert).toHaveTextContent(malformed ? /outcome is not confirmed/ : failure === "revision conflict" ? /connector changed/i : /Current operator verification is required/)
  expect(alert).not.toHaveTextContent("upstream debug")
  expect(screen.queryByRole("button", { name: "Enable provider-direct execution" })).not.toBeInTheDocument()
  expect(toast.success).not.toHaveBeenCalled()
  expect(changed).not.toHaveBeenCalled()
  http.mockResolvedValueOnce(jsonResponse({ ...status, direct_revision: 8 }))
  fireEvent.click(within(alert).getByRole("button", { name: "Refresh status" }))
  expect(await enable()).toBeEnabled()
  expect(changed).toHaveBeenCalledTimes(1)
  expect(patchCalls()).toHaveLength(1)
})