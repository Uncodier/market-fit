import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ConnectorAccessPanel } from "@/app/connectors/connector-access"
import { access, connector, jsonResponse, translate } from "./fixtures"

jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: translate }) }))
// These tests isolate member/agent policy requests from the independent manager status read.
jest.mock("@/app/connectors/provider-direct-settings", () => ({ AskStatus: () => null, useAskStatus: () => ({ status: { enabled: false, attested: false } }) }))
jest.mock("@/app/components/ui/select", () => ({
  Select: ({ children, value, onValueChange, disabled }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void; disabled?: boolean }) => <select value={value} onChange={event => onValueChange(event.target.value)} disabled={disabled}><option value="">Choose</option>{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}))
const fetchMock = jest.mocked(fetch)
beforeEach(() => fetchMock.mockReset())

test("new access revision never legitimizes stale enabled=true; refresh reads both snapshots", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ ...access, revision: 5 })).mockResolvedValueOnce(jsonResponse({ ...access, revision: 5 }))
  const changed = jest.fn()
  const view = render(<ConnectorAccessPanel siteId="site-1" connector={{ ...connector, enabled: true }} canManage onChanged={changed} />)
  expect(await screen.findByRole("alert")).toHaveTextContent("The connector changed")
  expect(screen.queryByText("Allowed tools")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Save policy" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  expect(changed).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  view.rerender(<ConnectorAccessPanel siteId="site-1" connector={{ ...connector, revision: 5, enabled: false }} canManage onChanged={changed} />)
  fireEvent.click(await screen.findByRole("checkbox", { name: "Allow requests for access" }))
  fetchMock.mockResolvedValueOnce(jsonResponse({ revision: 6 }))
  fireEvent.click(screen.getByRole("button", { name: "Save policy" }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
  expect(JSON.parse(fetchMock.mock.calls[2][1]?.body as string)).toMatchObject({ expected_revision: 5, enabled: false })
})

test.each(["member", "agent"] as const)("retained ineligible %s is selectable for revocation only", async kind => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ ...access, member_options: [], agent_options: [],
    agents: [{ agent_id: "agent-1", enabled: true, expires_at: null }] })).mockResolvedValueOnce(jsonResponse({ revision: 5 }))
  render(<ConnectorAccessPanel siteId="site-1" connector={connector} canManage onChanged={jest.fn()} />)
  const id = `${kind}-1`
  fireEvent.click(await screen.findByRole("button", { name: `Edit ${id}` }))
  expect(screen.getByRole("button", { name: "Save grant" })).toBeDisabled()
  expect(screen.getByRole("checkbox", { name: "Can use subject to policy" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Revoke grant" }))
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  const body = JSON.parse(fetchMock.mock.calls[1][1]?.body as string)
  expect(body[kind === "member" ? "members" : "agents"]).toEqual([kind === "member"
    ? { user_id: id, can_view: false, can_use: false, expires_at: null }
    : { agent_id: id, enabled: false, expires_at: null }])
})

test("member cannot edit, see the full ACL or use management as execution permission", async () => {
  fetchMock.mockResolvedValue(jsonResponse({ ...access, can_manage: false }))
  render(<ConnectorAccessPanel siteId="site-1" connector={connector} canManage={false} onChanged={jest.fn()} />)
  expect(await screen.findByText(/Only workspace owners and administrators/)).toBeVisible()
  expect(screen.queryByText("Member One")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Save policy" })).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Add tool" })).not.toBeInTheDocument()
  expect(screen.getByText(/You do not currently have effective member-use access/)).toBeVisible()
})

test("grant mutation is a revision-bound individual upsert and use implies view", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(access)).mockResolvedValueOnce(jsonResponse({ revision: 5 }))
  const changed = jest.fn()
  render(<ConnectorAccessPanel siteId="site-1" connector={connector} canManage onChanged={changed} />)
  expect(await screen.findByText(/Explicit access only/)).toBeVisible()
  expect(screen.queryByText(/Inherits workspace access/)).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Edit Member One" }))
  fireEvent.click(screen.getByRole("checkbox", { name: "Can use subject to policy" }))
  expect(screen.getByRole("checkbox", { name: "Can view account" })).toBeChecked()
  fireEvent.click(screen.getByRole("button", { name: "Save grant" }))
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
  const [path, options] = fetchMock.mock.calls[1]
  expect(path).toBe("/api/connectors/connections/connector-1/access")
  expect(options?.method).toBe("PATCH")
  expect(JSON.parse(options?.body as string)).toEqual({ site_id: "site-1", expected_revision: 4, members: [{ user_id: "member-1", can_view: true, can_use: true, expires_at: null }], agents: [] })
})

const workspaceAccess = {
  ...access, access_mode: "workspace" as const,
  members: [
    { user_id: "blocked", can_view: false, can_use: false, expires_at: null },
    { user_id: "expired", can_view: false, can_use: false, expires_at: "2020-01-01T00:00:00Z" },
    { user_id: "view-only", can_view: true, can_use: false, expires_at: null },
  ],
  agents: [{ agent_id: "allowed", enabled: true, expires_at: null }],
  member_options: [...access.member_options, { id: "blocked", label: "Blocked Member" },
    { id: "expired", label: "Expired Member" }, { id: "view-only", label: "View-only Member" }],
  agent_options: [...access.agent_options, { id: "allowed", label: "Allowed Agent" }],
  policy: { ...access.policy, allowed_tools: ["GMAIL_FETCH_EMAILS"], require_approval: false },
}

test("workspace lists missing rows as inherited and saved rows as exceptions, with server-supplied policy", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(workspaceAccess))
  render(<ConnectorAccessPanel siteId="site-1" connector={{ ...connector, access_mode: "workspace", enabled: true }} canManage onChanged={jest.fn()} />)
  expect(await screen.findByText(/Workspace access by default/)).toBeVisible()
  const [members, agents] = screen.getAllByText("Inherits workspace access (1)")
  expect(members.parentElement).toHaveTextContent("Member One")
  expect(agents.parentElement).toHaveTextContent("Agent One")
  expect(members.parentElement).not.toHaveTextContent("Expired Member")
  expect(screen.getByText("Exception expired · access blocked")).toBeVisible()
  expect(screen.getByText("Blocked by exception")).toBeVisible()
  expect(screen.getByText("View only by exception")).toBeVisible()
  expect(screen.getByText("Allowed by exception, subject to policy")).toBeVisible()
  expect(screen.getByText("GMAIL_FETCH_EMAILS")).toBeVisible()
  expect(screen.getByRole("button", { name: "Save policy" })).toBeDisabled()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test.each(["member", "agent"] as const)("blocks an inherited %s with an explicit deny and restores with an explicit allow", async kind => {
  const id = `${kind}-1`
  const blocked = kind === "member" ? { user_id: id, can_view: false, can_use: false, expires_at: null } : { agent_id: id, enabled: false, expires_at: null }
  const allowed = kind === "member" ? { user_id: id, can_view: true, can_use: true, expires_at: null } : { agent_id: id, enabled: true, expires_at: null }
  const grantArray = kind === "member" ? "members" : "agents"
  fetchMock.mockResolvedValueOnce(jsonResponse(workspaceAccess)).mockResolvedValueOnce(jsonResponse({ revision: 5 }))
    .mockResolvedValueOnce(jsonResponse({ ...workspaceAccess, revision: 5, [grantArray]: [blocked] })).mockResolvedValueOnce(jsonResponse({ revision: 6 }))
  const changed = jest.fn()
  const view = render(<ConnectorAccessPanel key="4" siteId="site-1" connector={connector} canManage onChanged={changed} />)
  const add = await screen.findByRole("button", { name: `Add ${kind}` })
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  fireEvent.click(add)
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.click(add)
  fireEvent.change(screen.getByRole("combobox"), { target: { value: id } })
  expect(screen.getByText("Inherits workspace access")).toBeVisible()
  expect(screen.getByRole("checkbox", { name: "Can use subject to policy" })).toBeChecked()
  expect(screen.getByRole("button", { name: "Save exception" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "Block access" }))
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
  expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toMatchObject({ expected_revision: 4, [grantArray]: [blocked] })

  view.rerender(<ConnectorAccessPanel key="5" siteId="site-1" connector={{ ...connector, revision: 5 }} canManage onChanged={changed} />)
  fireEvent.click(await screen.findByRole("button", { name: kind === "member" ? "Edit Member One" : "Edit Agent One" }))
  expect(screen.getByText(/does not remove the exception/)).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "Restore access" }))
  await waitFor(() => expect(changed).toHaveBeenCalledTimes(2))
  expect(JSON.parse(fetchMock.mock.calls[3][1]?.body as string)).toMatchObject({ expected_revision: 5, [grantArray]: [allowed] })
})

test("a workspace member with no persisted row sees effective access without management details", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ ...workspaceAccess, can_manage: false, members: [], agents: [], member_options: [], agent_options: [] }))
  render(<ConnectorAccessPanel siteId="site-1" connector={{ ...connector, can_use: true }} canManage={false} onChanged={jest.fn()} />)
  expect(await screen.findByText(/You have effective member-use access/)).toBeVisible()
  expect(screen.getByText("Inherits workspace access")).toBeVisible()
  expect(screen.queryByRole("button", { name: "Add member" })).not.toBeInTheDocument()
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
})

test("a workspace member sees their own view-only exception without seeing other principals", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ ...workspaceAccess, can_manage: false,
    members: [workspaceAccess.members[2]], agents: [], member_options: [], agent_options: [],
    policy: { ...workspaceAccess.policy, allowed_tools: [], allowed_hosts: [] }, reviewed_tools: [],
  }))
  render(<ConnectorAccessPanel siteId="site-1" connector={connector} canManage={false} onChanged={jest.fn()} />)
  expect(await screen.findByText("View only by exception")).toBeVisible()
  expect(screen.queryByText("Inherits workspace access")).not.toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

test("revision conflict blocks draft replay until an authoritative refresh", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse(access)).mockResolvedValueOnce(jsonResponse({ error: { code: "revision_conflict" } }, 409))
  const changed = jest.fn()
  render(<ConnectorAccessPanel siteId="site-1" connector={connector} canManage onChanged={changed} />)
  fireEvent.click(await screen.findByRole("checkbox", { name: "Allow requests for access" }))
  fireEvent.click(screen.getByRole("button", { name: "Save policy" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("The connector changed")
  expect(screen.getByRole("button", { name: "Save policy" })).toBeDisabled()
  expect(changed).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Refresh status" }))
  expect(changed).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})