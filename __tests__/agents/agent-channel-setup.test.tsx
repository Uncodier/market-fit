import "@testing-library/jest-dom"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { AgentChannelSetup } from "@/app/components/agents/agent-channel-setup"
import { useChannelAgentAssignments } from "@/app/components/settings/channel-agent-assignments-provider"
import { useSite } from "@/app/context/SiteContext"
import { apiClient } from "@/app/services/api-client-service"
import { createClient } from "@/lib/supabase/client"
import type { ApiResponse } from "@/app/services/api-client-response"

jest.mock("@/app/context/SiteContext", () => ({ useSite: jest.fn() }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/app/components/settings/channel-agent-assignments-provider", () => ({ useChannelAgentAssignments: jest.fn() }))
jest.mock("@/app/services/api-client-service", () => ({ apiClient: { post: jest.fn(), get: jest.fn() } }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn(() => { throw new Error("Unexpected settings query") }) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() } }))

type Model = NonNullable<ReturnType<typeof useChannelAgentAssignments>>
type Directory = NonNullable<Model["data"]>
const siteId = "18762e75-1293-4cf7-a91f-1dff31f265b2"
const agentId = "37deb68c-875d-4046-95da-a7cdf89b4e39"
const existing = { id: "other", label: "Existing bot", type: "telegram", account: "@old", status: "active" as const }
const site = { id: siteId, billing: { plan: "enterprise" }, settings: { channels: { connections: [
  { id: "other", name: "Existing bot", type: "telegram", status: "connected", zavu_sender_id: "old-sender" },
] } } }
const directory: Directory = { connections: [existing], connectionIds: [existing.id], assignments: [],
  defaultAgentId: null, voiceDefaultAgentId: null, voiceAgentIdsByConnection: {}, agents: [
    { id: agentId, name: "Sales", role: "Customer Support", status: "active" },
  ], canManage: true }
const reload = jest.fn<ReturnType<Model["reload"]>, []>()
const save = jest.fn<ReturnType<Model["save"]>, Parameters<Model["save"]>>()
const post = jest.mocked(apiClient.post)
const get = jest.mocked(apiClient.get)
const saved = "settings.channelAgent.saved"
const openSetup = () => fireEvent.click(screen.getByRole("button", { name: "settings.agentChannels.setupAction" }))
const finish = () => screen.getByRole("button", { name: "settings.agentChannels.setupFinish" })
const setup = () => render(<AgentChannelSetup siteId={siteId} agentId={agentId} />)
const setDirectory = (data: Directory) => jest.mocked(useChannelAgentAssignments).mockReturnValue({ data, save, reload, failed: false })
const setSite = (value = site) => jest.mocked(useSite).mockReturnValue({ currentSite: value } as unknown as ReturnType<typeof useSite>)
const withDraft = (id: string, type = "telegram"): Directory => ({ ...directory,
  connections: [existing, { id, type, label: "New channel", account: "", status: "active" }], connectionIds: ["other", id] })

beforeEach(() => {
  jest.clearAllMocks()
  post.mockReset(); get.mockReset()
  save.mockReset().mockResolvedValue("saved")
  reload.mockReset().mockResolvedValue(directory)
  setSite(); setDirectory(directory)
})

function choose(type: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name: "Channel" }))
  fireEvent.click(screen.getByRole("button", { name: type }))
}

async function connectTelegram(returnedId?: string) {
  let draftId = ""
  post.mockImplementationOnce(async (_path, body) => {
    draftId = body.channelId
    return { success: true, data: { channelId: returnedId || draftId, senderId: "sender", telegram: { botUsername: "new" } } }
  })
  openSetup(); choose("Telegram")
  fireEvent.change(screen.getByPlaceholderText(/ABCdef/), { target: { value: "test-token" } })
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect Telegram" })) })
  if (!returnedId) await waitFor(() => expect(finish()).toBeEnabled())
  expect(post).toHaveBeenCalledWith("/api/integrations/zavu/channels/telegram", {
    siteId, name: "Telegram", botToken: "test-token", active: true, channelId: expect.stringMatching(/^[a-f0-9-]{36}$/),
  })
  return draftId
}

it("opens only a new draft: no existing cards, fetch, billing, settings save, or assignment", () => {
  setup(); openSetup(); choose("Telegram")
  expect(screen.getByText(/may incur channel fees/)).toBeVisible()
  expect(screen.queryByText("Existing bot")).not.toBeInTheDocument()
  expect(screen.queryByTitle("Remove Channel")).not.toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Add Channel" })).not.toBeInTheDocument()
  expect(finish()).toBeDisabled()
  expect(get).not.toHaveBeenCalled(); expect(post).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled()
})

it("assigns only the explicitly completed, uniquely confirmed new account after provider authorization", async () => {
  setup()
  const id = await connectTelegram()
  expect(save).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalledWith(saved)
  reload.mockResolvedValue(withDraft(id))
  fireEvent.click(finish())
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(save.mock.calls).toEqual([[{ connectionId: id, expectedRevision: 0, agentId }]])
  expect(toast.success).toHaveBeenCalledWith(saved)
  expect(post).toHaveBeenCalledTimes(1); expect(fetch).not.toHaveBeenCalled()
})

it.each(["missing", "pending", "inactive", "different type", "ambiguous", "no write access", "inactive agent", "foreign assignment", "cleared assignment"])(
  "never assigns a %s connection after fresh verification", async reason => {
    setup(); const id = await connectTelegram()
    const fresh = withDraft(id)
    if (reason === "missing") fresh.connections = [existing]
    if (reason === "pending" || reason === "inactive") fresh.connections![1].status = reason
    if (reason === "different type") fresh.connections![1].type = "sms"
    if (reason === "ambiguous") fresh.connections!.push(fresh.connections![1])
    if (reason === "no write access") fresh.canManage = false
    if (reason === "inactive agent") fresh.agents = [{ ...directory.agents[0], status: "inactive" }]
    if (reason.endsWith("assignment")) fresh.assignments = [{ connectionId: id, agentId: reason.startsWith("cleared") ? null : "another-agent", revision: 1 }]
    reload.mockResolvedValue(fresh)
    fireEvent.click(finish()); await screen.findByRole("alert")
    expect(save).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalledWith(saved)
  },
)

it.each(["conflict", "error"] as const)("does not announce a save or retry on %s", async outcome => {
  setup(); const id = await connectTelegram()
  reload.mockResolvedValue(withDraft(id)); save.mockResolvedValue(outcome)
  fireEvent.click(finish())
  expect(await screen.findByRole("alert")).toHaveTextContent(outcome === "conflict" ? "channelAgent.conflict" : "channelAgent.saveError")
  expect(save).toHaveBeenCalledTimes(1); expect(toast.success).not.toHaveBeenCalledWith(saved)
})

it("rejects a different provider receipt before showing completion", async () => {
  setup(); await connectTelegram(existing.id)
  await waitFor(() => expect(toast.error).toHaveBeenCalled())
  expect(finish()).toBeDisabled(); expect(save).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled()
})

it("does not write after a site/agent switch during verification", async () => {
  const view = setup(); const id = await connectTelegram()
  let done!: (snapshot: Directory) => void
  reload.mockReturnValue(new Promise(resolve => { done = resolve }))
  fireEvent.click(finish())
  view.rerender(<AgentChannelSetup siteId={siteId} agentId="another-agent" />)
  await act(async () => { done(withDraft(id)) })
  expect(save).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalledWith(saved)
})

it("preserves partner authorization and fee confirmation before a WhatsApp assignment", async () => {
  const popup = { closed: false, location: { replace: jest.fn() }, close: jest.fn() }
  const open = jest.spyOn(window, "open").mockReturnValue(popup as unknown as Window)
  const url = "https://example.test/authorize"
  const inv = "/api/integrations/zavu/invitations/invite?siteId=" + siteId
  let id = ""
  post.mockImplementationOnce(async (_path, body) => {
    id = body.channelId
    return { success: true, data: { channelId: id, invitation: { id: "invite", url } } }
  })
  get.mockResolvedValueOnce({ success: true, data: { invitation: { id: "invite", status: "pending" } } })
  try {
    setup(); openSetup(); choose(/WhatsApp/)
    expect(screen.getByText(/may incur channel fees/)).toBeVisible()
    expect(post).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Connect Account" }))
    await screen.findByRole("link", { name: "Continue Setup" })
    await waitFor(() => expect(get).toHaveBeenCalledWith(inv))
    expect(popup.location.replace).toHaveBeenCalledWith(url)
    expect(post.mock.calls).toEqual([["/api/integrations/zavu/invitations", { siteId, channelId: id, connectionType: "whatsapp_waba", name: "WhatsApp" }]])
    expect(finish()).toBeDisabled(); expect(save).not.toHaveBeenCalled()
    get.mockResolvedValue({ success: true, data: { invitation: { id: "invite", status: "completed", senderId: "sender",
      connectedAccount: { phoneNumber: "+14155550111" }, activationPending: false } } })
    fireEvent.click(screen.getByRole("button", { name: "Check setup status" }))
    await waitFor(() => expect(finish()).toBeEnabled())
    reload.mockResolvedValue(withDraft(id, "whatsapp")); fireEvent.click(finish())
    await waitFor(() => expect(save.mock.calls).toEqual([[{ connectionId: id, expectedRevision: 0, agentId }]]))
    expect(fetch).not.toHaveBeenCalled(); expect(post).toHaveBeenCalledTimes(1)
  } finally { open.mockRestore() }
})

it("keeps an approved domain separate from an activated inbox and never submits other email settings", async () => {
  const domain = "support.example.com"
  let id = ""
  const metadata = { email_domain_id: "test-domain", domain, domain_status: "verified" }
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), abortSignal: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(async () => ({ data: { channels: { connections: [site.settings.channels.connections[0],
      { id, name: "Email", type: "email", status: "pending", metadata },
    ] } } })) }
  jest.mocked(createClient).mockReturnValueOnce({ from: () => query } as unknown as ReturnType<typeof createClient>)
  post.mockImplementationOnce(async (_path, body) => {
    id = body.channelId
    return { success: true, data: { domain: { id: "test-domain", domain, status: "verified" } } }
  })
  setup(); openSetup(); choose("Email")
  fireEvent.change(screen.getByRole("textbox"), { target: { value: domain } })
  fireEvent.click(screen.getByRole("button", { name: "Add Domain" }))
  await screen.findByText("Configure Email Address")
  expect(query.select).toHaveBeenCalledWith("channels"); expect(query.eq).toHaveBeenCalledWith("site_id", siteId)
  expect(post.mock.calls).toEqual([["/api/integrations/zavu/email-domains", { siteId, channelId: id, name: "Email", domain }]])
  expect(screen.queryByText("Existing bot")).not.toBeInTheDocument()
  expect(finish()).toBeDisabled(); expect(save).not.toHaveBeenCalled()
})

it("keeps an explicitly pending SMS activation unassigned", async () => {
  get.mockResolvedValue({ success: true, data: { items: [{ phoneNumber: "+14155550222", name: "Spare SMS number", status: "active" }] } })
  post.mockImplementationOnce(async (_path, body) => ({ success: true, data: { channelId: body.channelId,
    senderId: "sender", status: "in_progress", activationPending: true } }))
  setup(); openSetup(); choose("SMS")
  fireEvent.click(await screen.findByText("Spare SMS number"))
  fireEvent.click(screen.getByRole("button", { name: "Activate SMS Channel" }))
  await waitFor(() => expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("Activation and regulatory approval must finish")))
  expect(finish()).toBeDisabled(); expect(save).not.toHaveBeenCalled(); expect(post).toHaveBeenCalledTimes(1)
})

it("filters multi-connection Voice receipts and never edits the default site's voice preferences", async () => {
  let id = ""
  const numbers = [
    { phoneNumber: "+14155550111", senderId: "existing-sender", status: "active" },
    { phoneNumber: "+14155550222", name: "Spare number", status: "active" },
  ]
  get.mockResolvedValue({ success: true, data: { items: numbers } })
  post.mockImplementationOnce(async (_path, body): Promise<ApiResponse> => {
    id = body.channelId
    const draft = { id, type: "voice", name: "Voice", status: "connected", zavu_sender_id: "new-sender", metadata: { phone_number: numbers[1].phoneNumber } }
    return { success: true, data: { channelId: id, senderId: "new-sender", agentEnabled: true, regulatoryStatus: "approved", connections: [
      { ...draft, id: "other-voice", name: "Existing voice" }, draft,
    ] } }
  })
  setup(); openSetup(); choose("Voice / Audio Agent")
  fireEvent.click(await screen.findByText("Spare number"))
  expect(screen.queryByText("+1 (415) 555-0111")).not.toBeInTheDocument()
  expect(screen.queryByText("Call language")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Activate Voice Agent" }))
  await waitFor(() => expect(finish()).toBeEnabled())
  expect(post).toHaveBeenCalledWith("/api/integrations/zavu/voice", { siteId, channelId: id, name: "Voice / Audio Agent", phoneNumber: numbers[1].phoneNumber, active: true })
  expect(screen.queryByText("Existing voice")).not.toBeInTheDocument()
  expect(screen.queryByText("Call language")).not.toBeInTheDocument()
  reload.mockResolvedValue(withDraft(id, "voice")); fireEvent.click(finish())
  await waitFor(() => expect(save.mock.calls).toEqual([[{ connectionId: id, expectedRevision: 0, agentId }]]))
  expect(post).toHaveBeenCalledTimes(1)
})