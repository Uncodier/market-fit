import { createClient } from "@/lib/supabase/client"
import { subscribeToInstanceNodeChildren } from "@/app/components/simple-messages-view/hooks/instance-node-children-realtime"

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(),
}))

const node = (id: string, parentLogId: string) => ({
  id,
  instance_id: "instance-1",
  parent_node_id: null,
  original_node_id: null,
  parent_instance_log_id: parentLogId,
  type: "prompt",
  status: "pending",
  result: {},
  settings: {},
  prompt: { text: id },
  site_id: "site-1",
  user_id: "user-1",
  created_at: "2026-09-22T12:00:00.000Z",
  updated_at: "2026-09-22T12:00:00.000Z",
})

describe("shared instance-node children Realtime subscription", () => {
  it("shares one channel and one initial query across mounted messages", async () => {
    jest.useFakeTimers()
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    })

    let onPayload: ((payload: any) => void) | undefined
    let onStatus: ((status: string) => void) | undefined
    const channel: { on: jest.Mock; subscribe: jest.Mock } = {
      on: jest.fn((_event, _filter, callback): typeof channel => {
        onPayload = callback
        return channel
      }),
      subscribe: jest.fn((callback: (status: string) => void) => {
        onStatus = callback
        return channel
      }),
    }
    const query: {
      select: jest.Mock
      eq: jest.Mock
      not: jest.Mock
    } = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      not: jest.fn().mockResolvedValue({
        data: [node("node-1", "log-1"), node("node-2", "log-2")],
        error: null,
      }),
    }
    const client = {
      channel: jest.fn(() => channel),
      from: jest.fn(() => query),
      removeChannel: jest.fn().mockResolvedValue(undefined),
    }
    jest.mocked(createClient).mockReturnValue(client as any)

    const firstListener = jest.fn()
    const secondListener = jest.fn()
    const unsubscribeFirst = subscribeToInstanceNodeChildren(
      "instance-1",
      "log-1",
      firstListener
    )
    const unsubscribeSecond = subscribeToInstanceNodeChildren(
      "instance-1",
      "log-2",
      secondListener
    )

    await Promise.resolve()
    await Promise.resolve()

    expect(client.channel).toHaveBeenCalledTimes(1)
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(firstListener).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "node-1" }),
    ])
    expect(secondListener).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "node-2" }),
    ])

    onStatus?.("SUBSCRIBED")
    document.dispatchEvent(new Event("visibilitychange"))
    jest.advanceTimersByTime(250)
    await Promise.resolve()
    await Promise.resolve()
    expect(client.from).toHaveBeenCalledTimes(2)

    onStatus?.("SUBSCRIBED")
    jest.advanceTimersByTime(250)
    await Promise.resolve()
    await Promise.resolve()
    expect(client.from).toHaveBeenCalledTimes(3)

    const secondListenerCalls = secondListener.mock.calls.length
    onPayload?.({
      eventType: "INSERT",
      new: node("node-3", "log-1"),
    })
    expect(firstListener).toHaveBeenLastCalledWith([
      expect.objectContaining({ id: "node-1" }),
      expect.objectContaining({ id: "node-3" }),
    ])
    expect(secondListener).toHaveBeenCalledTimes(secondListenerCalls)

    unsubscribeFirst()
    unsubscribeSecond()
    jest.advanceTimersByTime(250)
    await Promise.resolve()

    expect(client.removeChannel).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })
})
