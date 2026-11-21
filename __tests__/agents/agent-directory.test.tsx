import "@testing-library/jest-dom"
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import AgentsPage from "@/app/agents/page"
import { TopBarPrimaryActionsSlot } from "@/app/components/navigation/topbar-primary-actions"
import { invalidateAgentsCache } from "@/app/agents/agents-cache"
import type { AgentListRow } from "@/app/agents/list/agent-list-model"
import { useAgentList } from "@/app/agents/list/use-agent-list"

const mockPush = jest.fn()
const mockRange = jest.fn()
const mockEq = jest.fn().mockReturnThis()
const mockOrder = jest.fn().mockReturnThis()
const mockSelect = jest.fn().mockReturnThis()
const mockFrom = jest.fn(() => ({ select: mockSelect, eq: mockEq, order: mockOrder, range: mockRange }))
let mockSiteId = "site-a"
let mockUser: { id: string } | null = { id: "actor" }
let mockAuthLoading = false
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/agents" }))
jest.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: mockFrom }) }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: mockSiteId } }) }))
jest.mock("@/app/components/auth/auth-provider", () => ({ useAuthContext: () => ({ user: mockUser, isLoading: mockAuthLoading }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string, args?: { name: string }) => {
  const labels: Record<string, string> = {
    "settings.agentChannels.createAgent": "Create agent", "settings.agentChannels.listError": "Could not load agents.", "system.error.retry": "Try again",
    "agents.hierarchy.title": "Agent hierarchy", "agents.hierarchy.setupTemplates": "Templates to set up", "agents.hierarchy.setupTemplate": "Setup template",
    "agents.hierarchy.noSupervisor": "No supervisor", "agents.hierarchy.reportsTo": `Reports to ${args?.name}`,
    "agents.hierarchy.filteredSupervisor": `Reports to ${args?.name} (outside search results)`, "agents.hierarchy.missingSupervisor": "Supervisor unavailable",
    "agents.hierarchy.cycle": "Circular supervisor relationship", "agents.grid.empty.title": "No agents found",
  }
  return labels[key] || key
} }) }))
jest.mock("@/app/components/agents/zoomable-canvas", () => ({ ZoomableCanvas: ({ children }: { children: ReactNode }) => <div data-testid="zoomable-canvas">{children}</div> }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: ReactNode }) => <header>{children}</header> }))
jest.mock("@/app/components/agents/commands-panel", () => ({ CommandsPanel: () => <div>Commands panel</div> }))
jest.mock("@/app/components/agents/agent-tools-panel", () => ({ AgentToolsPanel: () => <div>Tools panel</div> }))

function row(id: string, overrides: Partial<AgentListRow> = {}): AgentListRow {
  return { id, name: "Sales West", description: "", status: "inactive", type: "sales", role: "Sales/CRM Specialist",
    agentOrigin: "independent", supervisor: null, conversations: 0, success_rate: 0, last_active: null, ...overrides }
}

function DirectoryShell({ children }: { children: ReactNode }) {
  return <><header aria-label="Workspace topbar"><TopBarPrimaryActionsSlot /></header>{children}</>
}
const renderDirectory = () => render(<AgentsPage />, { wrapper: DirectoryShell })

beforeEach(() => {
  jest.clearAllMocks()
  invalidateAgentsCache()
  mockSiteId = "site-a"
  mockUser = { id: "actor" }; mockAuthLoading = false
  mockRange.mockReset().mockResolvedValue({ data: [row("saved-1"), row("saved-2"), row("other", {
    role: null, name: "Customer Support", agentOrigin: null, type: "sales", description: "Not the template",
  })], count: 3, error: null })
})

it('uses a static hierarchy while pending, or six-cell placeholders if switched to table, without hiding the toolbar', async () => {
  let settle!: () => void
  mockRange.mockReturnValueOnce(new Promise(resolve => { settle = () => resolve({ data: [row('saved')], count: 1, error: null }) }))
  renderDirectory()
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(screen.queryByRole('region', { name: 'Agent hierarchy' })).toBeNull()
  expect(screen.getByRole('link', { name: 'Create agent' })).toBeVisible()
  fireEvent.click(screen.getByRole('radio', { name: 'Toggle grid view' }))
  const table = screen.getByRole('table')
  expect(table.closest('[aria-busy="true"]')).not.toBeNull()
  expect(table.querySelectorAll('thead th')).toHaveLength(6)
  table.querySelectorAll('tbody tr').forEach(tr => expect(tr.children).toHaveLength(6))
  await act(async () => settle())
  expect(screen.queryByRole('status')).toBeNull()
  expect(await screen.findByRole('button', { name: 'Manage Sales West' })).toBeVisible()
})

it('does not leave an unauthenticated visitor in a permanent loading state', () => {
  mockUser = null; mockAuthLoading = true
  const view = renderDirectory()
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(screen.queryByRole('link', { name: 'Create agent' })).toBeNull()
  mockAuthLoading = false
  view.rerender(<AgentsPage />)
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByText('auth.workspace.signInDesc')).toBeVisible()
  expect(mockRange).not.toHaveBeenCalled()
})

it("exposes a no-write create action, keeps setup separate, and navigates every saved instance by ID on both views", async () => {
  renderDirectory()
  const topbar = within(screen.getByRole("banner", { name: "Workspace topbar" }))
  const create = topbar.getByRole("link", { name: "Create agent" })
  expect(create).toHaveAttribute("href", "/agents/new")
  expect(screen.getByRole("link", { name: "Create agent" })).toBe(create)
  expect(screen.getByRole("tab", { name: "Agents" }).closest("header")).not.toContainElement(create)
  const saved = await screen.findAllByRole("button", { name: "Manage Sales West" })
  expect(saved).toHaveLength(2)
  fireEvent.click(saved[0]); fireEvent.click(saved[1])
  fireEvent.click(screen.getByRole("button", { name: "Manage Sales/CRM Specialist" }))
  expect(mockPush.mock.calls).toEqual([["/agents/saved-1"], ["/agents/saved-2"], ["/agents/sales"]])
  expect(screen.getAllByRole("button", { name: "Manage Customer Support" })).toHaveLength(2)

  fireEvent.click(screen.getByLabelText("Toggle grid view"))
  expect(screen.getByRole("table")).toBeVisible()
  fireEvent.click(screen.getAllByRole("button", { name: "Manage Sales West" })[1])
  expect(mockPush).toHaveBeenLastCalledWith("/agents/saved-2")
  fireEvent.change(screen.getByPlaceholderText("Search team..."), { target: { value: "not the template" } })
  expect(screen.queryByRole("button", { name: "Manage Sales West" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Manage Customer Support" }))
  expect(mockPush).toHaveBeenLastCalledWith("/agents/other")
  fireEvent.click(screen.getByLabelText("Toggle hierarchy view"))
  expect(screen.getByRole("button", { name: "Manage Customer Support" })).toBeVisible()
  expect(screen.queryByRole("button", { name: "Manage Sales West" })).toBeNull()
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Commands" }), { button: 0 })
  expect(await screen.findByText("Commands panel")).toBeVisible()
  expect(topbar.queryByRole("link", { name: "Create agent" })).toBeNull()
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Agent Tools" }), { button: 0 })
  expect(await screen.findByText("Tools panel")).toBeVisible()
  expect(topbar.queryByRole("link", { name: "Create agent" })).toBeNull()
  fireEvent.mouseDown(screen.getByRole("tab", { name: "Agents" }), { button: 0 })
  expect(topbar.getByRole("link", { name: "Create agent" })).toHaveAttribute("href", "/agents/new")
  expect(mockFrom.mock.calls).toEqual([["agents"]])
  expect(mockEq).toHaveBeenCalledWith("site_id", "site-a")
  expect(fetch).not.toHaveBeenCalled()
})

it("doesn't let a retired site fetch publish cards or turn a failed lookup into a missing-default prompt", async () => {
  let settleOld!: (value: unknown) => void
  mockRange.mockImplementationOnce(() => new Promise(r => { settleOld = r }))
  const { rerender } = renderDirectory()
  await waitFor(() => expect(mockEq).toHaveBeenCalledWith("site_id", "site-a"))
  mockSiteId = "site-b"
  mockRange.mockResolvedValueOnce({ error: { code: "42501" }, data: null })
  rerender(<AgentsPage />)
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not load agents.")
  await act(async () => settleOld({ data: [row("foreign", { name: "Foreign Site" })], error: null }))
  expect(screen.queryByRole("button", { name: /^Manage/ })).toBeNull()
  mockRange.mockResolvedValueOnce({ data: [row("visible", { name: "Current Site" })], count: 1, error: null })
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(await screen.findByRole("button", { name: "Manage Current Site" })).toBeVisible()
  expect(screen.queryByText("Foreign Site")).not.toBeInTheDocument()
})

it("draws only visible persisted edges, keeps card controls, and identifies the actual supervisor in both views", async () => {
  mockRange.mockResolvedValueOnce({ data: [row("same-a", { name: "Team lead" }), row("same-b", { name: "Team lead" }),
    row("analyst", { name: "Renamed analyst", role: "Data Analyst", agentOrigin: null, supervisor: "same-b" }),
    row("orphan", { name: "Orphan", supervisor: "not-on-site" }), row("cyclic", { name: "Loop", supervisor: "cyclic" })], count: 5, error: null })
  renderDirectory()
  const hierarchy = await screen.findByRole("region", { name: "Agent hierarchy" })
  const templates = screen.getByRole("region", { name: "Templates to set up" })
  expect(screen.getByTestId("zoomable-canvas")).toContainElement(hierarchy)
  expect(templates.querySelector("[data-supervisor-id]")).toBeNull()
  expect(within(templates).getByRole("button", { name: "Chat with Customer Support" })).toBeDisabled()
  expect(hierarchy.querySelectorAll("[data-supervisor-id]")).toHaveLength(1)
  expect(hierarchy.querySelector('[data-agent-id="same-a"] [data-agent-id="analyst"]')).toBeNull()
  const analyst = hierarchy.querySelector<HTMLElement>('[data-agent-id="same-b"] [data-agent-id="analyst"]')!
  expect(within(analyst).getByText("Reports to Team lead (same-b)")).toBeVisible()
  expect(analyst.querySelector('[data-supervisor-id="same-b"]')).toBeInTheDocument()
  expect(within(hierarchy).getByText("Supervisor unavailable")).toBeVisible()
  expect(within(hierarchy).getByText("Circular supervisor relationship")).toBeVisible()
  expect(within(analyst).getByRole("button", { name: "Chat with Renamed analyst" })).toBeEnabled()
  fireEvent.click(within(analyst).getByRole("button", { name: /^Show Activities/ }))
  expect(within(analyst).getByRole("button", { name: "Hide Activities" })).toBeVisible()
  fireEvent.click(within(analyst).getByRole("button", { name: "Manage Renamed analyst" }))
  expect(mockPush).toHaveBeenLastCalledWith("/agents/analyst")

  const search = screen.getByPlaceholderText("Search team...")
  fireEvent.change(search, { target: { value: "Renamed" } })
  expect(hierarchy.querySelectorAll('[data-agent-id]')).toHaveLength(1)
  expect(hierarchy.querySelector('[data-supervisor-id]')).toBeNull()
  expect(within(hierarchy).getByText("Reports to Team lead (same-b) (outside search results)")).toBeVisible()
  expect(screen.queryByRole("region", { name: "Templates to set up" })).toBeNull()
  fireEvent.click(screen.getByLabelText("Toggle grid view"))
  const table = screen.getByRole("table")
  expect(within(table).getByText("Reports to Team lead (same-b) (outside search results)")).toBeVisible()
  expect(within(table).getByRole("button", { name: "Collapse" })).toBeVisible()
  fireEvent.change(search, { target: { value: "won't match" } })
  expect(screen.getByText("No agents found")).toBeVisible()
  fireEvent.click(screen.getByLabelText("Toggle hierarchy view"))
  expect(screen.getByText("No agents found")).toBeVisible()
  fireEvent.change(search, { target: { value: "Renamed" } })
  expect(screen.getByRole("button", { name: "Hide Activities" })).toBeVisible()
  expect(fetch).not.toHaveBeenCalled()
})

it("offers setup routes but shows no hierarchy or reporting lines on a site with no saved agents", async () => {
  mockRange.mockResolvedValueOnce({ data: [], count: 0, error: null })
  renderDirectory()
  const templates = await screen.findByRole("region", { name: "Templates to set up" })
  expect(screen.queryByRole("region", { name: "Agent hierarchy" })).toBeNull()
  expect(templates.querySelector("[data-supervisor-id]")).toBeNull()
  fireEvent.click(within(templates).getByRole("button", { name: "Manage Customer Support" }))
  expect(mockPush).toHaveBeenLastCalledWith("/agents/support")
  fireEvent.click(screen.getByLabelText("Toggle grid view"))
  const row = screen.getByRole("row", { name: /Customer Support .*Setup template/ })
  expect(within(row).getByText("Setup template")).toBeVisible()
  expect(within(row).getByText("—")).toBeVisible()
  expect(within(row).getByRole("button", { name: "Chat with Customer Support" })).toBeDisabled()
})

it("lists later pages in stable order and does not project missed pages as missing default agents", async () => {
  const first = Array.from({ length: 250 }, (_, i) => row(`first-${i}`))
  mockRange.mockResolvedValueOnce({ data: first, count: 251, error: null }).mockResolvedValueOnce({ data: [row("last")], count: 251, error: null })
  const { result } = renderHook(() => useAgentList("site-a", "actor"))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(mockRange.mock.calls).toEqual([[0, 249], [250, 499]])
  expect(mockOrder.mock.calls).toEqual([["created_at"], ["id"], ["created_at"], ["id"]])
  expect(result.current.agents.filter(a => a.dbData)).toHaveLength(251)
  expect(result.current.agents.at(-1)?.id).toBe("last")
  expect(mockSelect.mock.calls[0][0].split(",")).toContain("supervisor")
  expect(mockSelect.mock.calls[0][0]).not.toMatch(/\*|prompt|backstory|\btools\b/)

  mockRange.mockResolvedValueOnce({ data: first, count: 251, error: null }).mockResolvedValueOnce({ error: { code: "503" } })
  act(() => result.current.reload())
  await waitFor(() => expect(result.current.error).toBe(true))
  expect(result.current.agents).toEqual([])
})

it('keeps reading when PostgREST caps a page below the requested size, so a visible supervisor is not mistaken for a missing one', async () => {
  const all = [row('child', { supervisor: 'parent' }), row('peer'), row('parent')]
  mockRange.mockImplementation((start: number) => Promise.resolve({ data: all.slice(start, start + 2), count: all.length, error: null }))
  const { result } = renderHook(() => useAgentList('site-a', 'actor'))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.agents.filter(a => a.dbData).map(a => a.id)).toEqual(['child', 'peer', 'parent'])
  expect(mockRange.mock.calls).toEqual([[0, 249], [2, 251]])
})

it('does not publish setup templates or partial graph data when pages overlap or an exact total is inconsistent', async () => {
  mockRange.mockResolvedValueOnce({ data: [row('a'), row('b')], count: 4 })
    .mockResolvedValueOnce({ data: [row('b'), row('c')], count: 4 })
  const { result } = renderHook(() => useAgentList('site-a', 'actor'))
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  expect(result.current.error).toBe(true)
  expect(result.current.agents).toEqual([])
})