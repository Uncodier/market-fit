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
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
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

  it("retains the query slot and coalesces rapid events into one latest-callback follow-up", async () => {
    let resolve!: () => void
    const query = new Promise<void>((done) => { resolve = done })
    const first = jest.fn(() => query)
    const latest = jest.fn(() => undefined)
    const { rerender } = renderHook(({ refresh }) => useOrdersRealtime("site-1", refresh, { includeUnits: true }), {
      initialProps: { refresh: first as () => unknown },
    })
    expect(channel.on).toHaveBeenCalledWith("postgres_changes", {
      event: "*", schema: "public", table: "sale_order_item_units", filter: "site_id=eq.site-1",
    }, expect.any(Function))
    const event = () => handlers.get("sale_order_item_units")!({ table: "sale_order_item_units", eventType: "UPDATE" })
    act(() => { event(); jest.advanceTimersByTime(500) })
    expect(first).toHaveBeenCalledTimes(1)
    act(() => { for (let i = 0; i < 20; i++) event(); jest.advanceTimersByTime(30_000) })
    expect(first).toHaveBeenCalledTimes(1)
    rerender({ refresh: latest })
    await act(async () => { resolve(); await query })
    act(() => jest.advanceTimersByTime(0))
    expect(latest).toHaveBeenCalledTimes(1)
    act(() => jest.advanceTimersByTime(30_000))
    expect(latest).toHaveBeenCalledTimes(1)
  })

  it("defers hidden refreshes without gating printer events or alarms", () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
    const refresh = jest.fn(() => 42)
    const printer = jest.fn()
    window.addEventListener("printer:order-event", printer)
    const { unmount } = renderHook(() => useOrdersRealtime("site-1", refresh))
    act(() => {
      handlers.get("sale_orders")!({ table: "sale_orders", eventType: "INSERT", new: { id: "order-1" } })
      jest.advanceTimersByTime(300)
    })
    expect(refresh).not.toHaveBeenCalled()
    expect(printer).toHaveBeenCalledTimes(1)
    expect(playNewOrderAlarm).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    act(() => { document.dispatchEvent(new Event("visibilitychange")); jest.advanceTimersByTime(0) })
    expect(refresh).toHaveBeenCalledTimes(1)
    unmount()
    window.removeEventListener("printer:order-event", printer)
  })

  it("does not replay old-site pending work or dispatch events after cleanup", async () => {
    let resolve!: () => void
    const query = new Promise<void>((done) => { resolve = done })
    const refresh = jest.fn(() => query)
    const { rerender, unmount } = renderHook(({ site }) => useOrdersRealtime(site, refresh), { initialProps: { site: "site-1" } })
    const oldHandler = handlers.get("sale_orders")!
    act(() => { oldHandler({ table: "sale_orders", eventType: "UPDATE" }); jest.advanceTimersByTime(500); oldHandler({ table: "sale_orders", eventType: "UPDATE" }) })
    rerender({ site: "site-2" })
    await act(async () => { resolve(); await query })
    act(() => { oldHandler({ table: "sale_orders", eventType: "INSERT" }); jest.advanceTimersByTime(500) })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(playNewOrderAlarm).not.toHaveBeenCalled()
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })
})