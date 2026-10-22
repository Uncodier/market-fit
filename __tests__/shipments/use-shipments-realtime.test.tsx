import { act, renderHook } from "@testing-library/react"
import { createClient } from "@/lib/supabase/client"
import { useShipmentsRealtime } from "@/app/shipments/hooks/useShipmentsRealtime"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))

describe("shipment realtime metadata refresh", () => {
  let notify: (payload: { new?: { id: string }; old?: { id: string } }) => void
  const removeChannel = jest.fn()
  type Channel = { on: jest.Mock; subscribe: jest.Mock }
  const channel: Channel = {
    on: jest.fn((_event, _config, handler): Channel => { notify = handler; return channel }),
    subscribe: jest.fn(() => channel),
  }
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
    jest.mocked(createClient).mockReturnValue({ channel: jest.fn(() => channel), removeChannel } as never)
  })
  afterEach(() => jest.useRealTimers())

  it("scopes events to the active site, filters details and debounces authoritative reloads", () => {
    const refresh = jest.fn()
    renderHook(() => useShipmentsRealtime("site-1", refresh, "shipment-1"))
    expect(channel.on).toHaveBeenCalledWith("postgres_changes", {
      event: "*", schema: "public", table: "shipments", filter: "site_id=eq.site-1",
    }, expect.any(Function))
    act(() => { notify({ new: { id: "other" } }); jest.advanceTimersByTime(400) })
    expect(refresh).not.toHaveBeenCalled()
    act(() => {
      notify({ new: { id: "shipment-1" } })
      notify({ old: { id: "shipment-1" } })
      jest.advanceTimersByTime(350)
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("uses the latest callback and cancels pending work on unmount", () => {
    const oldRefresh = jest.fn()
    const nextRefresh = jest.fn()
    const { rerender, unmount } = renderHook(({ refresh }) => useShipmentsRealtime("site-1", refresh), {
      initialProps: { refresh: oldRefresh },
    })
    rerender({ refresh: nextRefresh })
    act(() => { notify({ new: { id: "shipment-1" } }); jest.advanceTimersByTime(350) })
    expect(nextRefresh).toHaveBeenCalledTimes(1)
    expect(oldRefresh).not.toHaveBeenCalled()
    act(() => notify({ old: { id: "shipment-1" } }))
    unmount()
    act(() => jest.advanceTimersByTime(350))
    expect(nextRefresh).toHaveBeenCalledTimes(1)
    expect(removeChannel).toHaveBeenCalledWith(channel)
  })

  it("does not subscribe without a real site", () => {
    renderHook(() => useShipmentsRealtime(undefined, jest.fn()))
    renderHook(() => useShipmentsRealtime("demo-site", jest.fn()))
    expect(createClient).not.toHaveBeenCalled()
  })

  it("waits for query completion then performs at most one follow-up", async () => {
    let resolve!: () => void
    const query = new Promise<void>((done) => { resolve = done })
    const refresh = jest.fn().mockReturnValueOnce(query)
    renderHook(() => useShipmentsRealtime("site-1", refresh))
    act(() => { notify({ new: { id: "shipment-1" } }); jest.advanceTimersByTime(350) })
    act(() => { for (let i = 0; i < 20; i++) notify({ old: { id: "shipment-1" } }); jest.advanceTimersByTime(30_000) })
    expect(refresh).toHaveBeenCalledTimes(1)
    await act(async () => { resolve(); await query })
    act(() => jest.advanceTimersByTime(0))
    expect(refresh).toHaveBeenCalledTimes(2)
    act(() => jest.advanceTimersByTime(30_000))
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it("requires both visible and online before deferred events can refresh", () => {
    const refresh = jest.fn()
    renderHook(() => useShipmentsRealtime("site-1", refresh))
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
    act(() => { notify({ new: { id: "shipment-1" } }); jest.advanceTimersByTime(350) })
    expect(refresh).not.toHaveBeenCalled()
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
    act(() => { window.dispatchEvent(new Event("online")); jest.advanceTimersByTime(350) })
    expect(refresh).not.toHaveBeenCalled()
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    act(() => { document.dispatchEvent(new Event("visibilitychange")); jest.advanceTimersByTime(0) })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("handles rejection with queued-event backoff and releases the slot only at settlement", async () => {
    let reject!: () => void
    const query = new Promise<void>((_resolve, fail) => { reject = () => fail(new Error("offline query")) })
    const refresh = jest.fn().mockReturnValueOnce(query)
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined)
    renderHook(() => useShipmentsRealtime("site-1", refresh))
    act(() => { notify({ new: { id: "shipment-1" } }); jest.advanceTimersByTime(350); notify({ new: { id: "shipment-1" } }) })
    await act(async () => { reject(); await query.catch(() => undefined) })
    act(() => jest.advanceTimersByTime(999))
    expect(refresh).toHaveBeenCalledTimes(1)
    act(() => jest.advanceTimersByTime(1))
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it("suppresses pending follow-ups and retained handlers after unmount", async () => {
    let resolve!: () => void
    const query = new Promise<void>((done) => { resolve = done })
    const refresh = jest.fn(() => query)
    const { unmount } = renderHook(() => useShipmentsRealtime("site-1", refresh))
    act(() => { notify({ new: { id: "shipment-1" } }); jest.advanceTimersByTime(350); notify({ old: { id: "shipment-1" } }) })
    unmount()
    await act(async () => { resolve(); await query })
    act(() => { notify({ new: { id: "shipment-1" } }); window.dispatchEvent(new Event("online")); jest.advanceTimersByTime(1000) })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })
})