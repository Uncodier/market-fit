import { act, renderHook } from "@testing-library/react"

const putMock = jest.fn()
const postMock = jest.fn()
jest.mock("@/app/services/api-client-service", () => ({
  apiClient: {
    post: (...args: unknown[]) => postMock(...args),
    put: (...args: unknown[]) => putMock(...args),
  },
}))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

import { useEmailReceivingUpdate } from "@/app/components/settings/use-email-receiving-update"
import { useEmailChannelActivation } from "@/app/components/settings/use-email-channel-activation"

const options = (activateChannel: jest.Mock, onUpdated = jest.fn()) => ({
  siteId: "site_1",
  channel: { id: "channel_1", zavu_sender_id: "sender_1" },
  metadata: { emailReceivingEnabled: false, emailChannelActive: false },
  channelActive: false,
  activateChannel,
  onUpdated,
})

describe("useEmailReceivingUpdate", () => {
  beforeEach(() => jest.clearAllMocks())

  it("activates the channel before enabling receiving and persists confirmed state", async () => {
    const calls: string[] = []
    const activateChannel = jest.fn(async () => {
      calls.push("activate")
      return true
    })
    putMock.mockImplementation(async () => {
      calls.push("receiving")
      return { success: true, data: { sender: { emailReceivingEnabled: true } } }
    })
    const onUpdated = jest.fn()
    const { result } = renderHook(() => useEmailReceivingUpdate(options(activateChannel, onUpdated)))

    act(() => result.current.setReceivingEnabled(true))
    await act(async () => result.current.saveReceiving())

    expect(calls).toEqual(["activate", "receiving"])
    expect(onUpdated).toHaveBeenCalledWith({ metadata: {
      emailChannelActive: true,
      emailReceivingEnabled: true,
    } })
  })

  it("continues to receiving when activation reports that the channel was already active", async () => {
    const calls: string[] = []
    postMock.mockImplementation(async () => {
      calls.push("activate")
      return {
        success: true,
        data: {
          activated: false,
          sender: { channels: ["email"] },
        },
      }
    })
    putMock.mockImplementation(async () => {
      calls.push("receiving")
      return { success: true, data: { sender: { emailReceivingEnabled: true } } }
    })
    const onUpdated = jest.fn()
    const channel = { id: "channel_1", zavu_sender_id: "sender_1" }
    const metadata = { emailReceivingEnabled: false, emailChannelActive: false }
    const { result } = renderHook(() => {
      const activation = useEmailChannelActivation({
        siteId: "site_1",
        channel,
        metadata,
        onUpdated,
      })
      return useEmailReceivingUpdate({
        siteId: "site_1",
        channel,
        metadata,
        channelActive: activation.isEmailChannelActive,
        activateChannel: activation.activateEmailChannel,
        onUpdated,
      })
    })

    act(() => result.current.setReceivingEnabled(true))
    await act(async () => result.current.saveReceiving())

    expect(calls).toEqual(["activate", "receiving"])
    expect(putMock).toHaveBeenCalledWith(
      "/api/integrations/zavu/channels/email",
      expect.objectContaining({ emailReceivingEnabled: true })
    )
  })

  it("does not request receiving when activation fails", async () => {
    const { result } = renderHook(() => useEmailReceivingUpdate(options(jest.fn().mockResolvedValue(false))))
    act(() => result.current.setReceivingEnabled(true))
    await act(async () => result.current.saveReceiving())
    expect(putMock).not.toHaveBeenCalled()
  })

  it("does not persist an unconfirmed receiving response", async () => {
    putMock.mockResolvedValue({ success: true, data: { message: "updated" } })
    const onUpdated = jest.fn()
    const { result } = renderHook(() => useEmailReceivingUpdate({
      ...options(jest.fn(), onUpdated),
      channelActive: true,
    }))
    act(() => result.current.setReceivingEnabled(true))
    await act(async () => result.current.saveReceiving())
    expect(onUpdated).not.toHaveBeenCalled()
  })

  it("resets the toggle when Zavu returns receiving as disabled", async () => {
    putMock.mockResolvedValue({
      success: true,
      data: { sender: { emailReceivingEnabled: false } },
    })
    const { result } = renderHook(() => useEmailReceivingUpdate({
      ...options(jest.fn()),
      channelActive: true,
    }))

    act(() => result.current.setReceivingEnabled(true))
    await act(async () => result.current.saveReceiving())

    expect(result.current.receivingEnabled).toBe(false)
  })
})