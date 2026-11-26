import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { AgentConnectorsTab } from "@/app/components/agents/agent-connectors-tab"
import { LocalizationProvider } from "@/app/context/LocalizationContext"

const site = "11111111-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const agent = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const granted = { id: "aaaaaaaa-bbbb-4ccc-8ddd-111111111111", toolkit_slug: "gmail", display_name: "Support mail", revision: 4, available: true }
const unassigned = { id: "aaaaaaaa-bbbb-4ccc-8ddd-222222222222", toolkit_slug: "gmail", display_name: "Team mail", revision: 2 }
const directory = { active: true, assigned: [granted], available: [unassigned] }
const access = { connector_id: granted.id, revision: 4, can_manage: true, agents: [{ agent_id: agent, enabled: true, expires_at: null }], members: [],
  agent_options: [], member_options: [], policy: { allowed_tools: ["GMAIL_FETCH_EMAILS", "GMAIL_SEND_EMAIL", "OTHER_WRITE"], allowed_hosts: ["assistant"], require_approval: true },
  reviewed_tools: [{ slug: "GMAIL_FETCH_EMAILS", description: "Read email" }, { slug: "GMAIL_LIST_LABELS", description: "List labels" }] }
const request = jest.mocked(global.fetch)
const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body } as Response)
const start = () => render(<LocalizationProvider preferredLocale="en"><AgentConnectorsTab siteId={site} agentId={agent} showDetailsLink /></LocalizationProvider>)

beforeEach(() => { request.mockReset() })

it("fetches tools on expansion and distinguishes selected policy entries from the reviewed inventory", async () => {
  request.mockResolvedValueOnce(response(directory)).mockResolvedValueOnce(response(access))
  start()
  expect(screen.getByRole("status", { name: "Loading..." })).toHaveAttribute("aria-busy", "true")
  const row = await screen.findByRole("button", { name: /Support mail/ })
  expect(screen.getByRole("link", { name: "Open access view" })).toHaveAttribute("href", `/agents/${agent}/connectors`)
  expect(request).toHaveBeenCalledTimes(1)
  expect(screen.queryByText("Team mail")).not.toBeInTheDocument()
  fireEvent.click(row)
  expect(row).toHaveAttribute("aria-expanded", "true")
  expect(await screen.findByText("GMAIL_FETCH_EMAILS")).toBeVisible()
  expect(screen.getByText("Read email")).toBeVisible()
  expect(screen.getByText("GMAIL_SEND_EMAIL")).toBeVisible()
  expect(screen.getByText(/not confirmed in the reviewed tool inventory/)).toBeVisible()
  expect(screen.queryByText("OTHER_WRITE")).not.toBeInTheDocument()
  expect(screen.queryByText("GMAIL_LIST_LABELS")).not.toBeInTheDocument()
  fireEvent.click(row)
  expect(screen.queryByText("GMAIL_FETCH_EMAILS")).not.toBeInTheDocument()
})

it("writes only a versioned agent grant and refreshes before showing the new assignment", async () => {
  request.mockResolvedValueOnce(response(directory)).mockResolvedValueOnce(response({ connector_id: unassigned.id, revision: 3 }))
    .mockResolvedValueOnce(response({ active: true, assigned: [{ ...unassigned, revision: 3, available: true }], available: [] }))
  start()
  fireEvent.click(await screen.findByRole("button", { name: "Add connector" }))
  const dialog = within(screen.getByRole("dialog"))
  const grant = dialog.getByRole("button", { name: "Grant access" })
  expect(dialog.getByRole("link", { name: "Open Connectors" })).toHaveAttribute("href", "/connectors")
  expect(grant).toBeDisabled()
  fireEvent.click(dialog.getByRole("radio", { name: /Team mail/ }))
  fireEvent.click(grant)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(await screen.findByRole("button", { name: /Team mail/ })).toBeVisible()
  expect(request.mock.calls[1][0]).toBe(`/api/connectors/connections/${unassigned.id}/access`)
  expect(request.mock.calls[1][1]?.method).toBe("PATCH")
  expect(JSON.parse(String(request.mock.calls[1][1]?.body))).toEqual({ site_id: site, expected_revision: 2,
    members: [], agents: [{ agent_id: agent, enabled: true, expires_at: null }] })
})

it("does not list stale tools or expose grant controls on a permission denial", async () => {
  request.mockResolvedValueOnce(response(directory)).mockResolvedValueOnce(response({ ...access, revision: 5 }))
    .mockResolvedValueOnce(response({ error: { code: "ACCESS_DENIED" } }, 403))
  start()
  fireEvent.click(await screen.findByRole("button", { name: /Support mail/ }))
  const error = await screen.findByRole("alert")
  expect(screen.queryByText("GMAIL_FETCH_EMAILS")).not.toBeInTheDocument()
  fireEvent.click(within(error).getByRole("button"))
  expect(await screen.findByText(/Only workspace owners and admins/)).toBeVisible()
  expect(screen.queryByRole("button", { name: "Add connector" })).not.toBeInTheDocument()
})

it.each([true, false])("honors assistant host access (%s) when policy selects all compatible tools", async assistant => {
  request.mockResolvedValueOnce(response(directory)).mockResolvedValueOnce(response({ ...access, policy: { ...access.policy,
    tool_access_mode: "all", allowed_hosts: assistant ? ["assistant"] : ["direct"],
  } }))
  start()
  fireEvent.click(await screen.findByRole("button", { name: /Support mail/ }))
  if (assistant) expect(await screen.findByText("GMAIL_LIST_LABELS")).toBeVisible()
  else {
    expect(await screen.findByText(/does not allow assistant tools/)).toBeVisible()
    expect(screen.queryByText("GMAIL_LIST_LABELS")).not.toBeInTheDocument()
  }
  expect(screen.queryByText("GMAIL_SEND_EMAIL")).not.toBeInTheDocument()
})

it("requires a matching write receipt and does not retry an uncertain write automatically", async () => {
  request.mockResolvedValueOnce(response(directory)).mockResolvedValueOnce(response({ connector_id: unassigned.id, revision: 2 }))
  start()
  fireEvent.click(await screen.findByRole("button", { name: "Add connector" }))
  const dialog = within(screen.getByRole("dialog"))
  fireEvent.click(dialog.getByRole("radio", { name: /Team mail/ }))
  fireEvent.click(dialog.getByRole("button", { name: "Grant access" }))
  expect(await dialog.findByRole("alert")).toBeVisible()
  expect(dialog.getByRole("button", { name: "Grant access" })).toBeDisabled()
  expect(request).toHaveBeenCalledTimes(2)
})