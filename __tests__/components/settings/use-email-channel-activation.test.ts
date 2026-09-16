import { act, renderHook } from "@testing-library/react"
import { useEmailChannelActivation } from "@/app/components/settings/use-email-channel-activation"

const postMock = jest.fn()
const successMock = jest.fn()

jest.mock("@/app/services/api-client-service", () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
  },
}))

jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => successMock(...args),
    error: jest.fn(),
  },
}))

describe("useEmailChannelActivation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("activates the Zavu email channel and persists its status", async () => {
    postMock.mockResolvedValue({
      success: true,
      data: { activated: true, chargedCents: 0 },
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
      await result.current.activateEmailChannel()
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
})
