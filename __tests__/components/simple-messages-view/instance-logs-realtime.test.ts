import { createClient } from "@/lib/supabase/client"
import { subscribeInstanceLogsRealtime } from "@/app/components/simple-messages-view/hooks/subscribeInstanceLogsRealtime"

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}))

describe("instance logs Realtime lifecycle", () => {
  it("refreshes without replacing a healthy channel and retries failed channels once", () => {
    jest.useFakeTimers()
    jest.spyOn(Math, "random").mockReturnValue(0.5)
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    })

    const statusCallbacks: Array<(status: string) => void> = []
    const channels: Array<{
      on: jest.Mock
      subscribe: jest.Mock
    }> = []
    const client = {
      channel: jest.fn(() => {
        const channel: { on: jest.Mock; subscribe: jest.Mock } = {
          on: jest.fn((): typeof channel => channel),
          subscribe: jest.fn((callback: (status: string) => void) => {
            statusCallbacks.push(callback)
            return channel
          }),
        }
        channels.push(channel)
        return channel
      }),
      removeChannel: jest.fn(),
    }
    jest.mocked(createClient).mockReturnValue(client as any)

    const loadInstanceLogs = jest.fn().mockResolvedValue(undefined)
    const dispose = subscribeInstanceLogsRealtime({
      instanceId: "instance-1",
      currentRobotInstanceIdRef: { current: "instance-1" },
      waitingForMessageIdRef: { current: null },
      onResponseReceivedRef: { current: undefined },
      loadInstanceLogsRef: { current: loadInstanceLogs },
      setLogs: jest.fn(),
      setCollapsedSystemMessages: jest.fn(),
      setCollapsedToolDetails: jest.fn(),
    })

    expect(client.channel).toHaveBeenCalledTimes(1)
    statusCallbacks[0]("SUBSCRIBED")

    document.dispatchEvent(new Event("visibilitychange"))
    jest.advanceTimersByTime(1000)
    expect(loadInstanceLogs).toHaveBeenCalledTimes(1)
    expect(client.channel).toHaveBeenCalledTimes(1)

    statusCallbacks[0]("CHANNEL_ERROR")
    jest.advanceTimersByTime(1000)
    expect(client.channel).toHaveBeenCalledTimes(2)
    expect(client.removeChannel).toHaveBeenCalledTimes(1)

    dispose()
    jest.runOnlyPendingTimers()
    jest.restoreAllMocks()
    jest.useRealTimers()
  })
})
