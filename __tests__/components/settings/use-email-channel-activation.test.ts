import { act, renderHook } from "@testing-library/react"
import { useEmailChannelActivation } from "@/app/components/settings/use-email-channel-activation"

const postMock = jest.fn()
const successMock = jest.fn()
const errorMock = jest.fn()

jest.mock("@/app/services/api-client-service", () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
  },
}))

jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => successMock(...args),
    error: (...args: unknown[]) => errorMock(...args),
  },
}))

describe("useEmailChannelActivation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("activates the Zavu email channel and persists its status", async () => {
    postMock.mockResolvedValue({
      success: true,
      data: {
        activated: true,
        chargedCents: 0,
        sender: { channels: ["email"] },
      },
    })
    const onUpdated = jest.fn()
    const { result } = renderHook(() =>
      useEmailChannelActivation({
        siteId: "site_1",
        channel: {
          id: "channel_1",
          status: "in_progress",
          zavu_sender_id: "sender/1",
        },
        metadata: { domain: "mail.example.com" },
        onUpdated,
      })
    )

    await act(async () => {
      expect(await result.current.activateEmailChannel()).toBe(true)
    })

    expect(postMock).toHaveBeenCalledWith(
      "/api/integrations/zavu/senders/sender%2F1/channels/email/activate",
      { siteId: "site_1", channelId: "channel_1" }
    )
    expect(onUpdated).toHaveBeenCalledWith({
      status: "connected",
      metadata: {
        domain: "mail.example.com",
        emailChannelActive: true,
      },
    })
    expect(successMock).toHaveBeenCalledWith("Email channel activated")
  })

  it("accepts an already-active channel when Zavu confirms it on the sender", async () => {
    postMock.mockResolvedValue({
      success: true,
      data: {
        activated: false,
        chargedCents: 0,
        sender: { channels: ["email"] },
      },
    })
    const onUpdated = jest.fn()
    const { result } = renderHook(() => useEmailChannelActivation({
      siteId: "site_1",
      channel: { id: "channel_1", zavu_sender_id: "sender_1" },
      metadata: {},
      onUpdated,
    }))

    await act(async () => {
      expect(await result.current.activateEmailChannel()).toBe(true)
    })

    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { emailChannelActive: true },
    }))
  })

  it("does not persist activation unless Zavu confirms it", async () => {
    postMock.mockResolvedValue({ success: true, data: { chargedCents: 0 } })
    const onUpdated = jest.fn()
    const { result } = renderHook(() => useEmailChannelActivation({
      siteId: "site_1",
      channel: { id: "channel_1", zavu_sender_id: "sender_1" },
      metadata: {},
      onUpdated,
    }))

    await act(async () => {
      expect(await result.current.activateEmailChannel()).toBe(false)
    })

    expect(onUpdated).not.toHaveBeenCalled()
    expect(errorMock).toHaveBeenCalledWith("Zavu did not confirm email channel activation")
  })
})
