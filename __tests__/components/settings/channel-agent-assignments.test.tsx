import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { FormProvider, useForm } from "react-hook-form"
import { toast } from "sonner"
import { ChannelsSection } from "@/app/components/settings/ChannelsSection"
import type { SiteFormValues } from "@/app/components/settings/form-schema"
import { LocalizationProvider, type SupportedLocale } from "@/app/context/LocalizationContext"
import { localeMessages } from "@/app/context/locale-catalog"


jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: null }) }))
jest.mock("@/app/context/BillingLimitContext", () => ({ useBillingLimit: () => ({}) }))
jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: () => null }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/app/components/settings/VoiceChannelSettings", () => ({ VoiceChannelSettings: () => null }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const site = "10000000-0000-4000-8000-000000000001"
const siteB = "10000000-0000-4000-8000-000000000002"
const endpoint = (siteId = site) => `/api/agent-channels/${siteId}/assignments`
const text = (key: string) => localeMessages.en[`settings.channelAgent.${key}`]
const support = { id: "20000000-0000-4000-8000-000000000001", name: "Alex", role: "Customer Support", status: "active" }
const sales = { id: "20000000-0000-4000-8000-000000000002", name: "Riley", role: "Sales", status: "active" }
const phone = { id: "20000000-0000-4000-8000-000000000003", name: "Morgan", role: "Reception", status: "active" }
const inactive = { id: "20000000-0000-4000-8000-000000000004", name: "Sam", role: "Customer Support", status: "inactive" }

const first = { id: "wa-east", type: "whatsapp", name: "WhatsApp", status: "connected" as const, metadata: { phone_number: "+14155550101" } }
const second = { ...first, id: "wa-west", metadata: { phone_number: "+14155550102" } }
const voice = { id: "voice-main", type: "voice", name: "Voice", status: "connected" as const }
const sms = { id: "sms-main", type: "sms", name: "SMS", status: "connected" as const }
const firstLabel = "WhatsApp · +1 (415) 555-0101"
const secondLabel = "WhatsApp · +1 (415) 555-0102"
const webLabel = "Storefront"
const assignment = (connectionId: string, agentId: string | null, revision: number) => ({ connectionId, agentId, revision })

// This is the local GET projection, not a provider directory or the site settings object.
const directory = {
  agents: [support, sales, phone, inactive],
  defaultAgentId: support.id,
  voiceDefaultAgentId: inactive.id,
  voiceAgentIdsByConnection: {},
  connectionIds: ["website", first.id, second.id],
  assignments: [assignment(first.id, null, 4), assignment(second.id, phone.id, 9)],
  canManage: true,
}
const fetchMock = jest.mocked(fetch)
const response = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response
const receipt = (connectionId: string, agentId: string | null, revision: number) => response({ assignment: assignment(connectionId, agentId, revision) })

function deferredResponse() {
  let resolve!: (value: Response) => void
  const promise = new Promise<Response>(done => { resolve = done })
  return { promise, resolve }
}

function writes() {
  return fetchMock.mock.calls.flatMap(([url, options]) => options?.method && options.method !== "GET"
    ? [{ url, method: options.method, body: options.body && JSON.parse(String(options.body)) }]
    : [])
}

function expectedPatch(connectionId: string, agentId: string | null, expectedRevision: number) {
  return { url: endpoint(), method: "PATCH", body: { connectionId, agentId, expectedRevision } }
}

type FormProps = {
  locale?: SupportedLocale
  siteId?: string
  connections?: SiteFormValues["channels"]["connections"]
  onSave?: (values: SiteFormValues) => void
}

function Form({ siteId = site, connections = [first, second], onSave, locale = "en" }: FormProps) {
  const form = useForm<SiteFormValues>({ defaultValues: {
    channels: { connections }, tracking: { enable_chat: false, track_visitors: false },
  } })
  return <LocalizationProvider preferredLocale={locale}><FormProvider {...form}>
    <form onSubmit={event => { event.preventDefault(); onSave?.(form.getValues()) }}>
      <ChannelsSection active siteId={siteId} siteName={webLabel} onSave={onSave} />
    </form>
  </FormProvider></LocalizationProvider>
}

const row = (label: string) => screen.getByRole("group", { name: label })
const change = (label: string) => within(row(label)).getByRole("button", { name: text("change") })
const edit = (label: string) => within(row(label)).getByRole("link", { name: text("edit") })
const savedEdit = (label: string) => within(row(label)).queryByRole("link", { name: text("editSaved") })
async function openDialog(label = firstLabel) {
  await waitFor(() => expect(change(label)).toBeEnabled())
  fireEvent.click(change(label))
  const dialog = screen.getByRole("dialog")
  expect(dialog).toHaveAccessibleName(expect.stringContaining(label))
  const controls = within(dialog)
  return {
    controls,
    select: controls.getByRole("combobox", { name: text("choice") }),
    save: controls.getByRole("button", { name: "Save" }),
  }
}

// Radix switches measure their associated inputs when rendered inside a real form.
const originalObserver = global.ResizeObserver
beforeAll(() => { global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } })
afterAll(() => { global.ResizeObserver = originalObserver })

beforeEach(() => {
  jest.clearAllMocks()
  fetchMock.mockReset().mockResolvedValue(response(directory))
})

it("labels the two distinct actions in Spanish and identifies the connection in the editor", async () => {
  render(<Form locale="es" />)
  const group = within(row(secondLabel))
  expect(await group.findByRole("link", { name: "Editar agente" })).toHaveAttribute("href", `/agents/${support.id}`)
  fireEvent.click(group.getByRole("button", { name: "Cambiar agente" }))
  expect(screen.getByRole("dialog")).toHaveAccessibleName(`Cambiar el agente de ${secondLabel}`)
})

it("places serving agents and direct edit links in each connection card, including the website", async () => {
  render(<Form />)
  await within(row(firstLabel)).findByText(support.name)
  for (const [label, cardId] of [[firstLabel, "support-channel-0"], [secondLabel, "support-channel-1"], [webLabel, "website-channel"]]) {
    expect(document.getElementById(cardId)).toContainElement(row(label))
    expect(row(label)).toHaveTextContent(`${text("serving")}: ${support.name}`)
    expect(row(label)).toHaveTextContent(text("default"))
    expect(edit(label)).toHaveAttribute("href", `/agents/${support.id}`)
    expect(change(label)).toBeEnabled()
  }
  expect(savedEdit(firstLabel)).not.toBeInTheDocument()
  expect(row(secondLabel)).toHaveTextContent(`${text("planned")}: ${phone.name}`)
  expect(row(secondLabel)).toHaveTextContent(text("pending"))
  expect(savedEdit(secondLabel)).toHaveAttribute("href", `/agents/${phone.id}`)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(fetchMock).toHaveBeenCalledWith(endpoint(), expect.objectContaining({ cache: "no-store" }))
})

it("saves only the chosen account and revision, without submitting or resetting the dirty site form", async () => {
  const onSave = jest.fn()
  const pending = deferredResponse()
  fetchMock.mockResolvedValueOnce(response(directory)).mockReturnValueOnce(pending.promise)
  render(<Form onSave={onSave} />)
  const tracking = screen.getByRole("switch", { name: "Track Visitors" })
  fireEvent.click(tracking)
  const siteSave = screen.getByRole("button", { name: "Save" })
  expect(siteSave).toBeEnabled()

  const { select, save, controls } = await openDialog()
  expect(controls.getByText(text("notice"))).toBeVisible()
  expect(select).toHaveValue("")
  expect(save).toBeDisabled()
  expect(controls.getByRole("option", { name: /Sam/ })).toBeDisabled()
  fireEvent.change(select, { target: { value: sales.id } })
  expect(writes()).toEqual([])
  fireEvent.click(save)
  expect(controls.getByRole("button", { name: /Saving/i })).toBeDisabled()
  expect(toast.success).not.toHaveBeenCalled()
  expect(writes()).toEqual([expectedPatch(first.id, sales.id, 4)])
  await act(async () => pending.resolve(receipt(first.id, sales.id, 5)))

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(edit(firstLabel)).toHaveAttribute("href", `/agents/${support.id}`)
  expect(row(firstLabel)).toHaveTextContent(`${text("planned")}: ${sales.name}`)
  expect(row(firstLabel)).toHaveTextContent(text("pending"))
  expect(savedEdit(firstLabel)).toHaveAttribute("href", `/agents/${sales.id}`)
  expect(savedEdit(secondLabel)).toHaveAttribute("href", `/agents/${phone.id}`)
  expect(toast.success).toHaveBeenCalledWith(text("saved"))
  expect(tracking).toBeChecked()
  expect(siteSave).toBeEnabled()
  expect(onSave).not.toHaveBeenCalled()
  expect(writes()).toEqual([expectedPatch(first.id, sales.id, 4)])
})

it("clears the website selection using its reserved identity and keeps both support accounts intact", async () => {
  fetchMock.mockResolvedValueOnce(response({ ...directory, assignments: [
    ...directory.assignments, assignment("website", sales.id, 3),
  ] })).mockResolvedValueOnce(receipt("website", null, 4))
  const onSave = jest.fn()
  render(<Form onSave={onSave} />)
  const { select, save, controls } = await openDialog(webLabel)
  expect(select).toHaveValue(sales.id)
  const fallback = controls.getByRole("option", { name: text("default") }) as HTMLOptionElement
  fireEvent.change(select, { target: { value: fallback.value } })
  fireEvent.click(save)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(writes()).toEqual([expectedPatch("website", null, 3)])
  expect(edit(webLabel)).toHaveAttribute("href", `/agents/${support.id}`)
  expect(row(webLabel)).not.toHaveTextContent(text("planned"))
  expect(savedEdit(webLabel)).not.toBeInTheDocument()
  expect(savedEdit(secondLabel)).toHaveAttribute("href", `/agents/${phone.id}`)
  expect(onSave).not.toHaveBeenCalled()
})

it("uses the recorded Voice connection agent, never the sync candidate or an SMS responder", async () => {
  const unmatched = { ...voice, id: "voice-other", name: "Other line" }
  fetchMock.mockResolvedValue(response({ ...directory,
    connectionIds: [voice.id, unmatched.id, sms.id, "website"],
    voiceAgentIdsByConnection: { [voice.id]: phone.id, [unmatched.id]: null },
    assignments: [assignment(voice.id, sales.id, 1), assignment(sms.id, sales.id, 3)],
  }))
  render(<Form connections={[voice, unmatched, sms]} />)
  await within(row(voice.name)).findByText(phone.name)
  expect(row(voice.name)).toHaveTextContent(`${text("voice")}: ${phone.name}`)
  expect(edit(voice.name)).toHaveAttribute("href", `/agents/${phone.id}`)
  expect(savedEdit(voice.name)).toHaveAttribute("href", `/agents/${sales.id}`)
  expect(row(voice.name)).toHaveTextContent(text("pending"))
  expect(row(unmatched.name)).toHaveTextContent(text("unknown"))
  expect(row(sms.name)).toHaveTextContent(text("noReplies"))
  expect(savedEdit(sms.name)).toHaveAttribute("href", `/agents/${sales.id}`)
  for (const label of [sms.name, unmatched.name]) {
    expect(within(row(label)).queryByRole("link", { name: text("edit") })).not.toBeInTheDocument()
    expect(within(row(label)).getByRole("button", { name: text("edit") })).toBeDisabled()
    expect(row(label)).not.toHaveTextContent(support.name)
    expect(row(label)).not.toHaveTextContent(inactive.name)
  }
})

it.each([
  { reason: "non-manager", restrictions: { canManage: false } },
  { reason: "assignment storage unavailable", restrictions: { canManage: false, assignmentsAvailable: false, assignments: [] } },
  { reason: "unpersisted connection", restrictions: { connectionIds: ["website", second.id], assignments: [] } },
])("does not allow an assignment write for $reason", async ({ restrictions }) => {
  fetchMock.mockResolvedValue(response({ ...directory, ...restrictions }))
  render(<Form />)
  await within(row(firstLabel)).findByText(support.name)
  expect(change(firstLabel)).toBeDisabled()
  fireEvent.click(change(firstLabel))
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(writes()).toEqual([])
})

it("fails closed when the directory cannot be read and recovers with a read-only retry", async () => {
  fetchMock.mockResolvedValueOnce(response({ error: "Unavailable" }, 503))
  render(<Form />)
  const group = within(row(firstLabel))
  await group.findByText(text("failed"))
  expect(change(firstLabel)).toBeDisabled()
  expect(group.queryByRole("link")).not.toBeInTheDocument()
  fireEvent.click(group.getByRole("button", { name: "Retry" }))
  await group.findByText(support.name)
  expect(change(firstLabel)).toBeEnabled()
  expect(writes()).toEqual([])
})

it.each([
  { reason: "failed PATCH", failure: response({ error: "Could not confirm assignment" }, 503) },
  { reason: "receipt for a different connection", failure: receipt(second.id, sales.id, 5) },
  { reason: "receipt with a skipped revision", failure: receipt(first.id, sales.id, 6) },
])("does not claim success or replay the write after a $reason", async ({ failure }) => {
  fetchMock.mockResolvedValueOnce(response(directory)).mockResolvedValueOnce(failure)
  render(<Form />)
  const { select, save, controls } = await openDialog()
  fireEvent.change(select, { target: { value: sales.id } })
  fireEvent.click(save)
  expect(await controls.findByRole("alert")).toHaveTextContent(text("saveError"))
  expect(save).toBeDisabled()
  expect(toast.success).not.toHaveBeenCalled()
  fireEvent.click(controls.getByRole("button", { name: "Cancel" }))
  expect(savedEdit(firstLabel)).not.toBeInTheDocument()
  expect(edit(firstLabel)).toHaveAttribute("href", `/agents/${support.id}`)
  expect(writes()).toEqual([expectedPatch(first.id, sales.id, 4)])
})

it("reconciles a 409 and requires explicit review of the winner before writing its revision", async () => {
  const winner = { ...directory, assignments: [assignment(first.id, phone.id, 5), directory.assignments[1]] }
  fetchMock.mockResolvedValueOnce(response(directory)).mockResolvedValueOnce(response({ error: "Assignment changed" }, 409))
    .mockResolvedValueOnce(response(winner)).mockResolvedValueOnce(receipt(first.id, sales.id, 6))
  render(<Form />)
  const { select, save, controls } = await openDialog()
  fireEvent.change(select, { target: { value: sales.id } })
  fireEvent.click(save)
  const alert = await controls.findByRole("alert")
  expect(alert).toHaveTextContent(text("conflict"))
  expect(save).toBeDisabled()
  expect(toast.success).not.toHaveBeenCalled()
  fireEvent.click(within(alert).getByRole("button", { name: "Retry" }))
  expect(select).toHaveValue(phone.id)
  expect(save).toBeDisabled()
  expect(writes()).toEqual([expectedPatch(first.id, sales.id, 4)])
  fireEvent.change(select, { target: { value: sales.id } })
  fireEvent.click(save)
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  expect(writes()).toEqual([expectedPatch(first.id, sales.id, 4), expectedPatch(first.id, sales.id, 5)])
})

it.each(["GET", "PATCH"])("discards the old site's open dialog and late %s after switching sites", async method => {
  const late = deferredResponse()
  const next = deferredResponse()
  const newAgent = { ...support, id: "30000000-0000-4000-8000-000000000001", name: "Taylor" }
  fetchMock.mockResolvedValueOnce(response(directory)).mockReturnValueOnce(late.promise).mockReturnValueOnce(next.promise)
  const view = render(<Form />)
  const { select, save } = await openDialog()
  fireEvent.change(select, { target: { value: sales.id } })
  if (method === "PATCH") fireEvent.click(save)
  else fireEvent.focus(window)
  expect(fetchMock).toHaveBeenCalledTimes(2)
  view.rerender(<Form siteId={siteB} />)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  expect(within(row(firstLabel)).getByRole("status")).toHaveAttribute("aria-busy", "true")
  expect(within(row(firstLabel)).queryByRole("button")).not.toBeInTheDocument()
  expect(within(row(firstLabel)).queryByRole("link")).not.toBeInTheDocument()
  await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(endpoint(siteB), expect.objectContaining({ cache: "no-store" })))

  // Intentionally resolve the old response last, even if the transport was aborted.
  await act(async () => next.resolve(response({ ...directory,
    agents: [newAgent], defaultAgentId: newAgent.id, voiceDefaultAgentId: null, assignments: [], canManage: false,
  })))
  await act(async () => late.resolve(method === "GET" ? response(directory) : receipt(first.id, sales.id, 5)))
  expect(edit(firstLabel)).toHaveAttribute("href", `/agents/${newAgent.id}`)
  expect(row(firstLabel)).toHaveTextContent(newAgent.name)
  expect(change(firstLabel)).toBeDisabled()
  expect(savedEdit(firstLabel)).not.toBeInTheDocument()
  expect(toast.success).not.toHaveBeenCalled()
  expect(writes()).toEqual(method === "PATCH" ? [expectedPatch(first.id, sales.id, 4)] : [])
})

it.each(["GET first", "PATCH first"])("retains the higher same-site revision when focus and save overlap: %s", async order => {
  const read = deferredResponse(), write = deferredResponse()
  const winner = response({ ...directory, assignments: [assignment(first.id, phone.id, 6), directory.assignments[1]] })
  fetchMock.mockResolvedValueOnce(response(directory)).mockReturnValueOnce(write.promise).mockReturnValueOnce(read.promise)
  render(<Form />)
  const { select, save } = await openDialog()
  fireEvent.change(select, { target: { value: sales.id } })
  fireEvent.click(save)
  fireEvent.focus(window)
  expect(fetchMock).toHaveBeenCalledTimes(3)
  if (order === "GET first") {
    await act(async () => read.resolve(winner))
    await act(async () => write.resolve(receipt(first.id, sales.id, 5)))
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent(text("conflict"))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
  } else {
    await act(async () => write.resolve(receipt(first.id, sales.id, 5)))
    await act(async () => read.resolve(winner))
  }
  expect(savedEdit(firstLabel)).toHaveAttribute("href", `/agents/${phone.id}`)
  expect(writes()).toEqual([expectedPatch(first.id, sales.id, 4)])
})

it("does not roll back a confirmed write when a late focus read returns its pre-write snapshot", async () => {
  const read = deferredResponse(), write = deferredResponse()
  fetchMock.mockResolvedValueOnce(response(directory)).mockReturnValueOnce(write.promise).mockReturnValueOnce(read.promise)
  render(<Form />)
  const { select, save } = await openDialog()
  fireEvent.change(select, { target: { value: sales.id } })
  fireEvent.click(save)
  fireEvent.focus(window)
  await act(async () => write.resolve(receipt(first.id, sales.id, 5)))
  await act(async () => read.resolve(response({ ...directory, canManage: false })))
  expect(savedEdit(firstLabel)).toHaveAttribute("href", `/agents/${sales.id}`)
  expect(change(firstLabel)).toBeDisabled()
  expect(writes()).toHaveLength(1)
})

it("does not submit a draft selection when the selected agent has since become inactive", async () => {
  const read = deferredResponse()
  fetchMock.mockResolvedValueOnce(response(directory)).mockReturnValueOnce(read.promise)
  render(<Form />)
  const { select, save } = await openDialog()
  fireEvent.change(select, { target: { value: sales.id } })
  expect(save).toBeEnabled()
  fireEvent.focus(window)
  await act(async () => read.resolve(response({ ...directory,
    agents: directory.agents.map(a => a.id === sales.id ? { ...a, status: "inactive" } : a),
  })))
  expect(save).toBeDisabled()
  fireEvent.click(save)
  expect(writes()).toEqual([])
})

it("does not attribute an unrecognized persisted transport to Customer Support", async () => {
  const future = { ...first, id: "future-a", name: "Future account", type: "future_transport" }
  fetchMock.mockResolvedValue(response({ ...directory, connectionIds: [future.id, "website"], assignments: [] }))
  render(<Form connections={[future]} />)
  const group = within(row(future.name))
  await group.findByRole("button", { name: text("change") })
  await waitFor(() => expect(change(future.name)).toBeEnabled())
  expect(group.queryByRole("link", { name: text("edit") })).toBeNull()
  expect(group.queryByText(support.name)).toBeNull()
})

it("does not offer a write for a stale Settings card whose persisted ID now has a different transport", async () => {
  fetchMock.mockResolvedValue(response({ ...directory, connections: [
    { id: first.id, type: 'sms', label: 'Updated account', account: '', status: 'active' },
  ] }))
  render(<Form />)
  await waitFor(() => expect(within(row(firstLabel)).queryByRole('status')).toBeNull())
  expect(change(firstLabel)).toBeDisabled()
  fireEvent.click(change(firstLabel))
  expect(writes()).toHaveLength(0)
})