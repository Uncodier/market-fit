import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { FormProvider, useForm, useWatch } from "react-hook-form"
import { useAgentChannelActivation } from "@/app/components/settings/use-agent-channel-activation"
import { SupportChannelHeader } from "@/app/components/settings/support-channel-card-parts"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import type { SiteFormValues } from "@/app/components/settings/form-schema"
import { channelsSchema } from "@/app/components/settings/channel-form-schema"

jest.mock("@/app/context/PermissionContext", () => ({ useOptionalPermissions: jest.fn() }))
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: null }) }))
const mockLimit = jest.fn()
jest.mock("@/app/context/BillingLimitContext", () => ({ useBillingLimit: () => ({ showBillingLimitFromError: mockLimit }) }))
const mockNotify = jest.fn()
jest.mock("@/app/context/site-resource-sync", () => ({ notifySiteResourcesUpdated: (...args: unknown[]) => mockNotify(...args) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
const connection = { id: "channel-1", type: "whatsapp", name: "Support", status: "connected" as const, zavu_sender_id: "sender-1" }
const disabled = { ...connection, status: "disabled", enabled: false, _license: { order: 1, manually_disabled: true } }

function Controls({ siteId }: { siteId: string }) {
  const activation = useAgentChannelActivation(siteId)
  return <SupportChannelHeader label="Support" onRemove={() => undefined} activation={{
    active: true, busy: activation.updatingId !== null, canManage: activation.canManage,
    onChange: enabled => { void activation.setEnabled(connection.id, enabled) },
  }} />
}
function Form({ siteId = "site-1" }: { siteId?: string }) {
  const form = useForm<SiteFormValues>({ defaultValues: { name: "Unsaved name", channels: { connections: [
    connection, { id: "draft", status: "pending", name: "Unsaved draft" },
  ] } } as SiteFormValues })
  const values = useWatch({ control: form.control })
  return <FormProvider {...form}><Controls siteId={siteId} /><output data-testid="values">{JSON.stringify(values)}</output></FormProvider>
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useOptionalPermissions).mockReturnValue({ siteId: "site-1", capabilities: { role: "owner", is_owner: true }, can: () => true } as never)
  jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ success: true, channels: { connections: [disabled] } }) } as Response)
  mockLimit.mockReturnValue(false)
})

it("immediately persists a pause, preserves drafts/other fields and publishes canonical state", async () => {
  render(<Form />)
  fireEvent.click(screen.getByRole("switch", { name: "Activate Support" }))
  await waitFor(() => expect(mockNotify).toHaveBeenCalledWith("site-1"))
  expect(fetch).toHaveBeenCalledWith("/api/agent-channels/site-1/enabled", expect.objectContaining({
    method: "POST", body: JSON.stringify({ connectionId: "channel-1", enabled: false }),
  }))
  expect(screen.getByTestId("values")).toHaveTextContent('"manually_disabled":true')
  expect(screen.getByTestId("values")).toHaveTextContent("Unsaved draft")
  expect(screen.getByTestId("values")).toHaveTextContent("Unsaved name")
})
it.each([null, { siteId: "foreign", capabilities: { role: "owner" } }, { siteId: "site-1", capabilities: { role: "collaborator" } }])(
  "disables the control for absent/mismatched/non-manager permissions %j", permissions => {
    jest.mocked(useOptionalPermissions).mockReturnValue(permissions as never)
    render(<Form />)
    expect(screen.getByRole("switch")).toBeDisabled()
    fireEvent.click(screen.getByRole("switch"))
    expect(fetch).not.toHaveBeenCalled()
  },
)
it("opens the upgrade dialog without changing state on a server quota rejection", async () => {
  const result = { success: false, error: { code: "ACCOUNT_LIMIT" } }
  jest.mocked(fetch).mockResolvedValue({ ok: false, json: async () => result } as Response)
  mockLimit.mockReturnValue(true)
  render(<Form />)
  fireEvent.click(screen.getByRole("switch"))
  await waitFor(() => expect(mockLimit).toHaveBeenCalledWith(result))
  expect(screen.getByTestId("values")).not.toHaveTextContent("manually_disabled")
  expect(mockNotify).not.toHaveBeenCalled()
})
it("ignores a late response after switching sites", async () => {
  let resolve!: (value: Response) => void
  jest.mocked(fetch).mockReturnValue(new Promise(done => { resolve = done }))
  const view = render(<Form />)
  fireEvent.click(screen.getByRole("switch"))
  view.rerender(<Form siteId="site-2" />)
  resolve({ ok: true, json: async () => ({ success: true, channels: { connections: [disabled] } }) } as Response)
  await waitFor(() => expect(screen.getByRole("switch")).toBeDisabled())
  expect(mockNotify).not.toHaveBeenCalled()
})
it("keeps protected license metadata and supported states through form parsing", () => {
  const schema = channelsSchema.removeDefault().unwrap().shape.connections
  expect(schema.parse([disabled])[0]).toMatchObject(disabled)
  expect(schema.parse([{ ...connection, status: "license_suspended", license_suspended: true }])[0]).toMatchObject({ license_suspended: true })
  expect(schema.parse([{ ...connection, type: "voice", status: "synced" }])[0].status).toBe("synced")
})