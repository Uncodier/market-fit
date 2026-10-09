import { act, renderHook } from "@testing-library/react"
import { createClient } from "@/lib/supabase/client"
import { playNewOrderAlarm } from "@/lib/audio"
import { useOrdersRealtime } from "@/app/orders/hooks/useOrdersRealtime"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
jest.mock("@/lib/audio", () => ({
  ensureAudioUnlockListeners: jest.fn(() => jest.fn()),
  unlockAudio: jest.fn(),
  playNewOrderAlarm: jest.fn(),
}))

type Payload = {
  table: string
  eventType: string
  new?: { id?: string; sale_order_id?: string; status?: string }
  old?: { id?: string; sale_order_id?: string }
}

describe("order realtime invalidation", () => {
  const handlers = new Map<string, (payload: Payload) => void>()
  const removeChannel = jest.fn()
  type Channel = { on: jest.Mock; subscribe: jest.Mock }
  const channel: Channel = {
    on: jest.fn((_event: string, config: { table: string }, handler: (payload: Payload) => void): Channel => {
      handlers.set(config.table, handler)
      return channel
    }),
    subscribe: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    handlers.clear()
    jest.mocked(createClient).mockReturnValue({ channel: jest.fn(() => channel), removeChannel } as never)
  })
  afterEach(() => jest.useRealTimers())

  it("debounces a removed line and ignores changes belonging to another order", () => {
    const refresh = jest.fn()
    renderHook(() => useOrdersRealtime("site-1", refresh, { orderId: "order-1", playAlarm: false }))
    act(() => {
      handlers.get("sale_order_items")!({ table: "sale_order_items", eventType: "UPDATE", new: { sale_order_id: "other", status: "cancelled" } })
      jest.advanceTimersByTime(500)
    })
    expect(refresh).not.toHaveBeenCalled()
    act(() => {
      handlers.get("sale_order_items")!({ table: "sale_order_items", eventType: "UPDATE", new: { sale_order_id: "order-1", status: "cancelled" } })
      handlers.get("sale_order_items")!({ table: "sale_order_items", eventType: "DELETE", old: { id: "draft-line" } })
      jest.advanceTimersByTime(500)
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("preserves new order alarms for lists but disables them for details", () => {
    const { unmount } = renderHook(() => useOrdersRealtime("site-1", jest.fn()))
    act(() => handlers.get("sale_orders")!({ table: "sale_orders", eventType: "INSERT", new: { id: "order-1" } }))
    expect(playNewOrderAlarm).toHaveBeenCalledTimes(1)
    unmount()
    renderHook(() => useOrdersRealtime("site-1", jest.fn(), { orderId: "order-1", playAlarm: false }))
    act(() => handlers.get("sale_orders")!({ table: "sale_orders", eventType: "INSERT", new: { id: "order-1" } }))
    expect(playNewOrderAlarm).toHaveBeenCalledTimes(1)
  })

  it("cancels a pending refresh on unmount", () => {
    const refresh = jest.fn()
    const { unmount } = renderHook(() => useOrdersRealtime("site-1", refresh))
    act(() => handlers.get("sale_order_items")!({ table: "sale_order_items", eventType: "DELETE", old: { id: "draft-line" } }))
    unmount()
    act(() => jest.advanceTimersByTime(500))
    expect(refresh).not.toHaveBeenCalled()
    expect(removeChannel).toHaveBeenCalledWith(channel)
  })
})