import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"
import { TelegramChannelSetup } from "@/app/components/settings/TelegramChannelSetup"
import { PartnerSupportChannelSetup } from "@/app/components/settings/PartnerSupportChannelSetup"
import { ZavuChannelActivationRecovery, canRecoverZavuActivation } from "@/app/components/settings/ZavuChannelActivationRecovery"

const post = jest.fn()
jest.mock("@/app/services/api-client-service", () => ({ apiClient: { post: (...args: unknown[]) => post(...args) } }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock("@/app/context/BillingLimitContext", () => ({ useBillingLimit: () => ({ showBillingLimitFromError: () => false }) }))

beforeEach(() => { jest.clearAllMocks() })

it("keeps Telegram unconnected after activation fails and retries the same channel", async () => {
  post.mockResolvedValueOnce({ success: false, status: 502, error: { message: "Activation failed" } })
    .mockResolvedValueOnce({ success: true, data: { senderId: "sender-existing", telegram: { botUsername: "sample_bot" } } })
  const onConnected = jest.fn()
  render(<TelegramChannelSetup siteId="site-1" channel={{ id: "telegram-1", name: "Telegram" }} onConnected={onConnected} />)
  expect(screen.getByText("Connecting this bot activates the channel and may incur Zavu channel fees.")).toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText("123456789:ABCdefGHIjklMNOpqrsTUVwxyz"), { target: { value: "test-token" } })
  fireEvent.click(screen.getByRole("button", { name: "Connect Telegram" }))
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Activation failed"))
  expect(onConnected).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Connect Telegram" }))
  await waitFor(() => expect(onConnected).toHaveBeenCalledWith(expect.objectContaining({ senderId: "sender-existing" })))
  expect(post.mock.calls[0]).toEqual(post.mock.calls[1])
  expect(post).toHaveBeenCalledWith("/api/integrations/zavu/channels/telegram", {
    siteId: "site-1", channelId: "telegram-1", name: "Telegram", botToken: "test-token", active: true,
  })
})

it("does not offer unsupported Instagram partner invitations", () => {
  render(<PartnerSupportChannelSetup type="instagram" status="pending" connecting={false} checking={false}
    onConnect={jest.fn()} onCheck={jest.fn()} />)
  expect(screen.getByText("Partner invitation setup is not available for this channel.")).toBeInTheDocument()
  expect(screen.queryByRole("button", { name: "Connect Account" })).not.toBeInTheDocument()
})

it("shows activation pending rather than waiting for authorization", () => {
  render(<PartnerSupportChannelSetup type="whatsapp" status="in_progress" activationPending
    invitationUrl="https://example.test/invite" connecting={false} checking={false}
    onConnect={jest.fn()} onCheck={jest.fn()} />)
  expect(screen.getByText("Authorization received. Channel activation is still pending.")).toBeInTheDocument()
  expect(screen.getByText("Connecting this account activates the channel and may incur Zavu channel fees.")).toBeInTheDocument()
})

const channel = { id: "ch-1", type: "instagram", status: "pending", zavu_sender_id: "sender/1" }

it.each([
  { success: false, status: 502, error: { message: "Activation failed" } },
  { success: true, data: { status: "connected", activationPending: true } },
  { success: true, data: { activationPending: false } },
])("does not connect recovery before confirmed activation (%#)", async (response) => {
  post.mockResolvedValue(response)
  const onActivated = jest.fn()
  render(<ZavuChannelActivationRecovery siteId="site-1" channel={channel} onActivated={onActivated} />)
  fireEvent.click(screen.getByRole("button", { name: "Activate channel" }))
  fireEvent.click(screen.getByRole("button", { name: "Confirm activation" }))
  await waitFor(() => expect(toast.error).toHaveBeenCalled())
  expect(onActivated).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
})

it("activates an existing Instagram sender without a partner invitation", async () => {
  post.mockResolvedValue({ success: true, data: { status: "connected", activationPending: false } })
  const onActivated = jest.fn()
  render(<ZavuChannelActivationRecovery siteId="site-1" channel={channel} onActivated={onActivated} />)
  fireEvent.click(screen.getByRole("button", { name: "Activate channel" }))
  fireEvent.click(screen.getByRole("button", { name: "Confirm activation" }))
  await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
  expect(post).toHaveBeenCalledWith("/api/integrations/zavu/senders/sender%2F1/channels/instagram/activate", { siteId: "site-1", channelId: "ch-1" })
})

it("only recovers linked, unfinished supported channels", () => {
  expect(canRecoverZavuActivation(channel)).toBe(true)
  expect(canRecoverZavuActivation({ ...channel, zavu_sender_id: undefined })).toBe(false)
  expect(canRecoverZavuActivation({ ...channel, type: "email" })).toBe(false)
  expect(canRecoverZavuActivation({ ...channel, status: "disabled" })).toBe(false)
  expect(canRecoverZavuActivation({ ...channel, status: "license_suspended" })).toBe(false)
  expect(canRecoverZavuActivation({ ...channel, status: "connected" })).toBe(true)
  expect(canRecoverZavuActivation({ ...channel, status: "connected", metadata: { provider_channel_active: true } })).toBe(false)
})

it.each([
  { enabled: false }, { license_suspended: true }, { _license: { manually_disabled: true } },
])("does not offer legacy activation for projected inactive flags (%#)", (flags) => {
  expect(canRecoverZavuActivation({ ...channel, status: "connected", ...flags })).toBe(false)
  expect(canRecoverZavuActivation({ ...channel, status: "pending", ...flags })).toBe(false)
})

it("requires explicit fee confirmation before verifying a legacy connected channel", async () => {
  post.mockResolvedValue({ success: true, data: { status: "connected", activationPending: false } })
  render(<ZavuChannelActivationRecovery siteId="site-1" channel={{ ...channel, status: "connected" }} onActivated={jest.fn()} />)
  expect(post).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Verify activation" }))
  expect(post).not.toHaveBeenCalled()
  expect(screen.getByText("Activation may incur Zavu channel fees. Continue only if you want to activate this linked channel.")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Confirm activation" }))
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
})