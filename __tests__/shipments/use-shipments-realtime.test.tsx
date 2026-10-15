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
})