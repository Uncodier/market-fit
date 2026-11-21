import type { ReactNode } from "react"
import "@testing-library/jest-dom"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import AgentDetailPage from "@/app/agents/[id]/page"
import NewAgentPage from "@/app/agents/new/page"
import { upsertAgentRecord } from "@/app/agents/save-agent"
import { invalidateAgentsCache } from "@/app/agents/agents-cache"

const ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
const SITE = "11111111-bbbb-4ccc-8ddd-eeeeeeeeeeee"
let mockRoute = ID
let mockSite: string | null = SITE
let mockRole: string | null = null
const mockReplace = jest.fn(), mockPush = jest.fn(), mockFrom = jest.fn(), mockSession = jest.fn()
const mockChannels = jest.fn(({ siteId, agentId }: { siteId: string; agentId: string }) =>
  <div data-testid="channels-panel">{siteId}/{agentId}</div>)

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: mockRoute }), useSearchParams: () => ({ get: (key: string) => key === "role" ? mockRole : null }),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: mockSite ? { id: mockSite } : null }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: mockFrom, auth: { getSession: mockSession } }) }))
jest.mock("@/app/assets/actions", () => ({ getAssets: () => Promise.resolve({ assets: [] }) }))
jest.mock("@/app/components/agents/agent-channels-tab", () => ({ AgentChannelsTab: (props: Parameters<typeof mockChannels>[0]) => mockChannels(props) }))
jest.mock("@/app/components/agents/context-file", () => ({ ContextFile: ({ name }: { name: string }) => <span>{name}</span> }))
jest.mock("@/app/components/agents/upload-file-dialog", () => ({ UploadFileDialog: () => <button>Add File</button> }))
jest.mock("@/app/components/ui/sticky-header", () => ({ StickyHeader: ({ children }: { children: ReactNode }) => <header>{children}</header> }))
jest.mock("@/app/agents/save-agent", () => ({ ...jest.requireActual("@/app/agents/save-agent"), upsertAgentRecord: jest.fn() }))
jest.mock("@/app/agents/agents-cache", () => ({ invalidateAgentsCache: jest.fn() }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const channelLabel = "settings.agentChannels.tab"
const createLabel = "settings.agentChannels.createAgent"
const save = jest.mocked(upsertAgentRecord)
const supervisors = jest.mocked(global.fetch)
const first = { id: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa1", name: "Team Lead", role: "Sales" }
const second = { ...first, id: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaa2" }
const noSupervisor = "agents.hierarchy.noSupervisor"
const supervisorField = () => screen.getByRole("combobox", { name: "agents.hierarchy.field" })
function reply(data: unknown, ok = true) { return { ok, json: async () => data } as Response }
function openSupervisor() { fireEvent.keyDown(supervisorField(), { key: "Enter" }) }
async function chooseSupervisor(name: string | RegExp) {
  openSupervisor()
  fireEvent.click(await screen.findByRole("option", { name }))
}
const row = {
  id: ID, site_id: SITE, supervisor: null as string | null, name: "Support One", description: "Handles requests", status: "active", type: "support",
  prompt: "Original prompt", backstory: "Background", role: "Customer Support", tools: {}, integrations: {},
  configuration: { contextFiles: [{ id: "legacy", name: "Legacy context", path: "legacy.txt" }] },
  activities: { faq: { name: "Handle FAQ", description: "Triage requests", enabled: true } },
}
type Fixture = Omit<typeof row, "configuration" | "activities"> & { configuration: Record<string, unknown>; activities: Record<string, unknown> }
type Result = { data: Fixture | null; error: null | { message: string } }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => { resolve = res })
  return { promise, resolve }
}
const readRow = jest.fn<Promise<Result>, []>()
const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
  abortSignal: jest.fn().mockReturnThis(), single: readRow }
function selectTab(name: string) { fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 }) }

const oldObserver = global.ResizeObserver
const oldScroll = HTMLElement.prototype.scrollIntoView
beforeAll(() => {
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  HTMLElement.prototype.scrollIntoView = jest.fn()
})
afterAll(() => {
  global.ResizeObserver = oldObserver
  HTMLElement.prototype.scrollIntoView = oldScroll
})
beforeEach(() => {
  jest.clearAllMocks()
  mockSite = SITE; mockRoute = ID; mockRole = null
  readRow.mockReset().mockResolvedValue({ data: row, error: null })
  mockFrom.mockImplementation((table: string) => {
    if (table === "agents") return query
    if (table === "agent_assets") return { select: () => ({ eq: () => ({ abortSignal: () => Promise.resolve({ data: [], error: null }) }) }) }
    throw new Error(`Unexpected read: ${table}`)
  })
  mockSession.mockReset().mockResolvedValue({ data: { session: { user: { id: "actor" } } } })
  save.mockReset().mockResolvedValue(ID)
  supervisors.mockReset().mockResolvedValue(reply({ agents: [first, second] }))
})
afterEach(() => { jest.restoreAllMocks() })

it("never fills an independent stored profile's empty fields with legacy template defaults", async () => {
  readRow.mockResolvedValue({ data: { ...row, description: "", prompt: "", backstory: "", status: "inactive",
    activities: {}, configuration: { agentOrigin: "independent", contextFiles: [] } }, error: null })
  render(<AgentDetailPage />)
  expect(await screen.findByLabelText("Agent Prompt")).toHaveValue("")
  selectTab("Activities")
  expect(screen.getByText("No activities configured")).toBeVisible()
  fireEvent.click(screen.getByRole("button", { name: "Save Activities" }))
  await waitFor(() => expect(save.mock.calls[0][1]).toMatchObject({ activities: {}, tools: {}, integrations: {},
    description: "", prompt: "", backstory: "", configuration: { triggers: {}, contextFiles: [] } }))
})

it("adds the localized Channels tab only after the site-scoped profile read and retains unsaved edits on tab changes", async () => {
  const loading = deferred<Result>()
  readRow.mockReturnValueOnce(loading.promise)
  render(<AgentDetailPage />)
  expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
  expect(screen.queryByText('Save changes')).not.toBeInTheDocument()
  expect(screen.queryByRole("tab", { name: channelLabel })).not.toBeInTheDocument()
  expect(query.eq.mock.calls).toEqual([["site_id", SITE], ["id", ID]])
  await act(async () => loading.resolve({ data: row, error: null }))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.getAllByRole("tab").map((el) => el.textContent)).toEqual(["Basic Information", "Context Files", "Activities", channelLabel])
  expect(mockChannels).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Edited name" } })
  selectTab(channelLabel)
  expect(screen.getByTestId("channels-panel")).toHaveTextContent(`${SITE}/${ID}`)
  expect(mockChannels).toHaveBeenCalledWith({ siteId: SITE, agentId: ID })
  selectTab("Context Files")
  expect(screen.getByText("Legacy context")).toBeVisible()
  selectTab("Activities")
  fireEvent.click(screen.getByRole("switch", { name: "Toggle Handle FAQ" }))
  fireEvent.click(screen.getByRole("button", { name: "Save Activities" }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    agentId: ID, siteId: SITE, userId: "actor", name: "Edited name", role: row.role, isNewAgent: false,
    prompt: row.prompt, configuration: { contextFiles: row.configuration.contextFiles,
      triggers: expect.any(Object) }, activities: { faq: { name: "Handle FAQ", description: "Triage requests", status: "deprecated", enabled: false } },
  })))
  expect(invalidateAgentsCache).toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
  selectTab("Basic Information")
  expect(screen.getByLabelText("Name", { exact: true })).toHaveValue("Edited name")
})

it("exposes the same Channels panel in the narrow header overflow", async () => {
  mockRoute = ID.toUpperCase()
  jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(120)
  jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return { width: this.hasAttribute("data-overflow-measure") ? 40 : 75, height: 32, top: 0, left: 0,
      bottom: 32, right: 75, x: 0, y: 0, toJSON: () => ({}) }
  })
  render(<AgentDetailPage />)
  fireEvent.keyDown(await screen.findByRole("button", { name: "More options" }), { key: "Enter" })
  fireEvent.click(screen.getByRole("menuitem", { name: channelLabel }))
  expect(screen.getByRole("tab", { name: channelLabel })).toHaveAttribute("aria-selected", "true")
  expect(screen.getByTestId("channels-panel")).toHaveTextContent(`${SITE}/${ID}`)
})

it("retires a displayed profile immediately on a site switch and never exposes an old-site or mismatched row", async () => {
  const view = render(<AgentDetailPage />)
  await screen.findByRole("tab", { name: channelLabel })
  selectTab(channelLabel)
  expect(screen.getByTestId("channels-panel")).toBeVisible()
  const loading = deferred<Result>()
  readRow.mockReturnValueOnce(loading.promise)
  mockSite = "site-2"
  view.rerender(<AgentDetailPage />)
  expect(screen.queryByTestId("channels-panel")).not.toBeInTheDocument()
  expect(screen.queryByDisplayValue(row.name)).not.toBeInTheDocument()
  await act(async () => loading.resolve({ data: row, error: null }))
  expect(screen.getByText("Error loading agent")).toBeVisible()
  expect(mockChannels.mock.calls.every(([props]) => props.siteId === SITE)).toBe(true)
  expect(screen.queryByRole("button", { name: "Save Basic Information" })).not.toBeInTheDocument()
})

it("discards a late old-site response even after returning to the same site and route", async () => {
  const loading = deferred<Result>()
  readRow.mockReturnValueOnce(loading.promise).mockResolvedValue({ data: null, error: { message: "denied" } })
  const view = render(<AgentDetailPage />)
  const initialSignal = query.abortSignal.mock.calls[0][0] as AbortSignal
  mockSite = null
  view.rerender(<AgentDetailPage />)
  expect(initialSignal.aborted).toBe(true)
  mockSite = SITE
  view.rerender(<AgentDetailPage />)
  await screen.findByText("Error loading agent")
  await act(async () => loading.resolve({ data: row, error: null }))
  expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  expect(readRow).toHaveBeenCalledTimes(2)
  expect(mockChannels).not.toHaveBeenCalled()
})

it("refuses missing profiles, wrong IDs and unknown template routes without a save or channel fallback", async () => {
  readRow.mockResolvedValue({ data: { ...row, id: "other" }, error: null })
  const view = render(<AgentDetailPage />)
  await screen.findByText("Error loading agent")
  mockRoute = "unknown-route"
  view.rerender(<AgentDetailPage />)
  expect(screen.getByText("Agent not found")).toBeVisible()
  expect(screen.queryByRole("tab")).not.toBeInTheDocument()
  expect(mockFrom).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("button", { name: "Back to Agents" }))
  expect(mockPush).toHaveBeenCalledWith("/agents")
})

it("starts /agents/new blank and inactive, and keeps the independent insert identity across failures/retries", async () => {
  const view = render(<NewAgentPage />)
  expect(screen.getByLabelText("Name", { exact: true })).toHaveValue("")
  expect(screen.getByLabelText("Agent Prompt")).toHaveValue("")
  expect(screen.getByLabelText("Agent Backstory")).toHaveValue("")
  expect(screen.getByRole("switch", { name: "Toggle agent status" })).toBeDisabled()
  const role = () => screen.getByRole("combobox", { name: "settings.agentChannels.role" })
  expect(role()).toHaveTextContent("settings.agentChannels.chooseRole")
  expect(screen.getByRole("button", { name: createLabel })).toBeDisabled()
  expect(screen.queryByRole("tab", { name: channelLabel })).not.toBeInTheDocument()
  expect(mockFrom).not.toHaveBeenCalled()

  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Named draft" } })
  expect(screen.getByRole("button", { name: createLabel })).toBeDisabled()
  fireEvent.keyDown(role(), { key: "Enter" })
  fireEvent.click(await screen.findByRole("option", { name: "Growth Marketer" }))
  expect(screen.getByRole("button", { name: createLabel })).toBeEnabled()

  // An explicit role hint selects just the role, not its template's prompt or privileges.
  mockRole = "support"
  view.rerender(<NewAgentPage />)
  expect(role()).toHaveTextContent("Customer Support")
  expect(screen.getByLabelText("Agent Prompt")).toHaveValue("")
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "  Second support  " } })
  expect(screen.getByRole("button", { name: createLabel })).toBeEnabled()
  save.mockRejectedValueOnce(new Error("Capacity reached"))
  fireEvent.click(screen.getByRole("button", { name: createLabel }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Capacity reached")))
  expect(mockReplace).not.toHaveBeenCalled()
  const input = save.mock.calls[0][1]
  expect(input).toMatchObject({ agentId: "new", creationId: expect.any(String), isNewAgent: true, role: "Customer Support",
    type: "support", status: "inactive", name: "Second support", siteId: SITE, activities: {}, tools: {},
    integrations: {}, configuration: { contextFiles: [], triggers: {} }, prompt: "", description: "", backstory: "" })
  const inserting = deferred<string>()
  save.mockReturnValueOnce(inserting.promise)
  const create = screen.getByRole("button", { name: createLabel })
  fireEvent.click(create)
  fireEvent.click(create)
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
  expect(save.mock.calls[1][1].creationId).toBe(input.creationId)
  await act(async () => inserting.resolve(ID))
  expect(mockReplace).toHaveBeenCalledWith(`/agents/${ID}`)
  expect(invalidateAgentsCache).toHaveBeenCalledTimes(1)
  expect(mockChannels).not.toHaveBeenCalled()
  // Creation success isn't a profile read; the destination must authorize its own tab.
  mockRoute = ID
  view.rerender(<AgentDetailPage />)
  await screen.findByRole("tab", { name: channelLabel })
  selectTab(channelLabel)
  expect(screen.getByTestId("channels-panel")).toHaveTextContent(`${SITE}/${ID}`)
})

it("keeps legacy template setup distinct from blank creation and saved UUID edits", async () => {
  mockRoute = "support"
  render(<AgentDetailPage />)
  expect(screen.getByLabelText("Name", { exact: true })).toHaveValue("Customer Support")
  expect(screen.queryByRole("tab", { name: channelLabel })).not.toBeInTheDocument()
  selectTab("Context Files")
  expect(screen.getByText("settings.agentChannels.saveFirst")).toBeVisible()
  expect(screen.queryByText("Add File")).not.toBeInTheDocument()
  selectTab("Basic Information")
  fireEvent.click(screen.getByRole("button", { name: "Save Basic Information" }))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/agents/${ID}`))
  expect(save.mock.calls[0][1]).toMatchObject({ agentId: "support", isNewAgent: false, role: "Customer Support",
    activities: expect.objectContaining({ cs1: expect.objectContaining({ enabled: true }) }) })
  expect(mockChannels).not.toHaveBeenCalled()
})

it("does not start a write or navigate for a retired editor while authentication is pending", async () => {
  const auth = deferred<{ data: { session: { user: { id: string } } } }>()
  mockSession.mockReturnValueOnce(auth.promise)
  const view = render(<AgentDetailPage />)
  fireEvent.click(await screen.findByRole("button", { name: "Save Prompt" }))
  expect(mockSession).toHaveBeenCalledTimes(1)
  mockSite = "site-2"
  view.rerender(<AgentDetailPage />)
  await act(async () => auth.resolve({ data: { session: { user: { id: "actor" } } } }))
  expect(save).not.toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
})

it("never redirects the new site or exposes Channels when the previous site's draft insert finishes", async () => {
  mockRoute = "new"
  mockRole = "sales"
  const insertion = deferred<string>()
  save.mockReturnValueOnce(insertion.promise)
  const view = render(<AgentDetailPage />)
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Site one draft" } })
  fireEvent.click(screen.getByRole("button", { name: createLabel }))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  mockSite = "site-2"
  view.rerender(<AgentDetailPage />)
  expect(screen.getByLabelText("Name", { exact: true })).toHaveValue("")
  await act(async () => insertion.resolve(ID))
  expect(mockReplace).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  expect(mockChannels).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Site two draft" } })
  fireEvent.click(screen.getByRole("button", { name: createLabel }))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1))
  const second = save.mock.calls[1][1]
  expect(second.siteId).toBe("site-2")
  expect(second.creationId).not.toBe(save.mock.calls[0][1].creationId)
})

it.each(["new", "support"])("loads only eligible persisted options on demand in the %s draft and sends the chosen UUID on save", async route => {
  mockRoute = route
  mockRole = "support"
  render(route === "new" ? <NewAgentPage /> : <AgentDetailPage />)
  expect(supervisorField()).toHaveTextContent(noSupervisor)
  expect(supervisors).not.toHaveBeenCalled()
  expect(mockFrom).not.toHaveBeenCalled()
  openSupervisor()
  expect(await screen.findByRole("option", { name: `Team Lead · Sales (${first.id})` })).toBeVisible()
  fireEvent.click(screen.getByRole("option", { name: `Team Lead · Sales (${second.id})` }))
  expect(supervisorField()).toHaveTextContent(second.id)
  expect(supervisors).toHaveBeenCalledWith(`/api/agents/supervisors?siteId=${SITE}`, expect.objectContaining({ signal: expect.anything() }))
  expect(save).not.toHaveBeenCalled()
  if (route === "new") fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Independent agent" } })
  fireEvent.click(screen.getByRole("button", { name: route === "new" ? createLabel : "Save Basic Information" }))
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith(`/agents/${ID}`))
  expect(save.mock.calls[0][1]).toMatchObject({ agentId: route, isNewAgent: route === "new", siteId: SITE, supervisor: second.id })
  expect(save.mock.calls[0][1]).not.toHaveProperty("supervisorOnly")
})

it("only saves the supervisor from Basic, using the last successful save to detect hierarchy-only edits", async () => {
  readRow.mockResolvedValueOnce({ data: { ...row, supervisor: first.id }, error: null })
  render(<AgentDetailPage />)
  await waitFor(() => expect(supervisorField()).toHaveTextContent(first.id))
  expect(query.select).toHaveBeenCalledWith(expect.stringContaining("supervisor"))
  expect(supervisors).toHaveBeenCalledWith(`/api/agents/supervisors?siteId=${SITE}&agentId=${ID}`, expect.anything())
  await chooseSupervisor(new RegExp(second.id))
  expect(save).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText("Agent Prompt"), { target: { value: "Updated prompt" } })
  fireEvent.click(screen.getByRole("button", { name: "Save Prompt" }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
  expect(save.mock.calls[0][1].prompt).toBe("Updated prompt")
  expect(save.mock.calls[0][1].section).toBe('prompt')
  expect(save.mock.calls[0][1]).not.toHaveProperty("supervisor")
  selectTab("Activities")
  fireEvent.click(screen.getByRole("button", { name: "Save Activities" }))
  await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2))
  expect(save.mock.calls[1][1]).not.toHaveProperty("supervisor")
  expect(save.mock.calls[1][1].section).toBe('activities')
  selectTab("Basic Information")
  await waitFor(() => expect(supervisorField()).toHaveTextContent(second.id))
  const basicSave = () => fireEvent.click(screen.getByRole("button", { name: "Save Basic Information" }))
  save.mockRejectedValueOnce(new Error("Supervisor no longer eligible"))
  basicSave()
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Supervisor no longer eligible")))
  basicSave()
  await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(3))
  for (const [, input] of save.mock.calls.slice(2)) expect(input).toMatchObject({ supervisor: second.id, supervisorOnly: true })
  basicSave()
  await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(4))
  expect(save.mock.calls[4][1]).not.toHaveProperty("supervisor")
  await chooseSupervisor(noSupervisor)
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Renamed agent" } })
  basicSave()
  await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(5))
  expect(save.mock.calls[5][1]).toMatchObject({ supervisor: null, name: "Renamed agent" })
  expect(save.mock.calls[5][1]).not.toHaveProperty("supervisorOnly")
})

it.each([
  ["an invisible parent", null],
  ["an ineligible parent", { ...first, name: "Former lead" }],
] as const)("does not remove %s on failed, missing, or display-only options; clearing is explicit", async (_case, current) => {
  readRow.mockResolvedValueOnce({ data: { ...row, supervisor: first.id }, error: null })
  supervisors.mockResolvedValueOnce(reply({}, false)).mockResolvedValueOnce(reply({ agents: [second], current }))
  render(<AgentDetailPage />)
  expect(await screen.findByRole("alert")).toHaveTextContent("agents.hierarchy.unavailableOptions")
  expect(supervisorField()).toHaveTextContent("agents.hierarchy.missingSupervisor")
  expect(supervisorField()).not.toHaveTextContent(noSupervisor)
  fireEvent.change(screen.getByLabelText("Name", { exact: true }), { target: { value: "Keep the existing supervisor" } })
  const basic = () => fireEvent.click(screen.getByRole("button", { name: "Save Basic Information" }))
  basic()
  await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
  expect(save.mock.calls[0][1]).not.toHaveProperty("supervisor")
  fireEvent.click(screen.getByRole("button", { name: "common.retry" }))
  await waitFor(() => expect(supervisorField()).toHaveTextContent("agents.hierarchy.missingSupervisor"))
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  if (current) expect(supervisorField()).toHaveTextContent(current.name)
  basic()
  await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2))
  expect(save.mock.calls[1][1]).not.toHaveProperty("supervisor")
  openSupervisor()
  expect(screen.getByRole("option", { name: /agents\.hierarchy\.missingSupervisor/ })).toHaveAttribute("aria-disabled", "true")
  fireEvent.click(screen.getByRole("option", { name: noSupervisor }))
  expect(supervisorField()).toHaveTextContent(noSupervisor)
  expect(save).toHaveBeenCalledTimes(2)
  basic()
  await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(3))
  expect(save.mock.calls[2][1]).toMatchObject({ supervisor: null, supervisorOnly: true })
})

it("aborts old-site supervisor reads and never publishes a late result into a new site's draft", async () => {
  mockRoute = "new"
  const oldRead = deferred<Response>()
  supervisors.mockReturnValueOnce(oldRead.promise).mockResolvedValueOnce(reply({ agents: [{ ...second, name: "Local lead" }] }))
  const view = render(<NewAgentPage />)
  openSupervisor()
  const signal = supervisors.mock.calls[0][1]?.signal
  expect(signal?.aborted).toBe(false)
  mockSite = "22222222-bbbb-4ccc-8ddd-eeeeeeeeeeee"
  view.rerender(<NewAgentPage />)
  expect(signal?.aborted).toBe(true)
  expect(supervisorField()).toHaveTextContent(noSupervisor)
  openSupervisor()
  expect(await screen.findByRole("option", { name: /Local lead/ })).toBeVisible()
  expect(supervisors.mock.calls[1][0]).toBe(`/api/agents/supervisors?siteId=${mockSite}`)
  await act(async () => oldRead.resolve(reply({ agents: [{ ...first, name: "Foreign lead" }] })))
  expect(screen.queryByRole("option", { name: /Foreign lead/ })).not.toBeInTheDocument()
  expect(screen.getByRole("option", { name: /Local lead/ })).toBeVisible()
  expect(save).not.toHaveBeenCalled()
})