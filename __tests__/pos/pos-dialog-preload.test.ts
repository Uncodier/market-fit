import { scheduleDialogChunkWarming } from "@/app/pos/components/pos-dialog-preload"

jest.mock("@/app/pos/local/reservation-slots", () => ({ getReservationSlotsLocalFirst: jest.fn() }))

describe("POS dialog chunk warming", () => {
  const originalIdle = window.requestIdleCallback
  const originalCancelIdle = window.cancelIdleCallback

  beforeEach(() => {
    jest.useFakeTimers()
    Reflect.deleteProperty(window, "requestIdleCallback")
    Reflect.deleteProperty(window, "cancelIdleCallback")
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
    window.requestIdleCallback = originalIdle
    window.cancelIdleCallback = originalCancelIdle
  })

  it("defers to idle and loads one chunk per idle turn", () => {
    const callbacks: IdleRequestCallback[] = []
    window.requestIdleCallback = jest.fn((callback) => callbacks.push(callback))
    window.cancelIdleCallback = jest.fn()
    const loaders = [jest.fn().mockResolvedValue({}), jest.fn().mockResolvedValue({})]

    const cancel = scheduleDialogChunkWarming(loaders)
    expect(loaders[0]).not.toHaveBeenCalled()
    expect(window.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 2000 })
    callbacks[0]({ didTimeout: false, timeRemaining: () => 10 })
    expect(loaders[0]).toHaveBeenCalledTimes(1)
    expect(loaders[1]).not.toHaveBeenCalled()
    callbacks[1]({ didTimeout: false, timeRemaining: () => 10 })
    expect(loaders[1]).toHaveBeenCalledTimes(1)
    expect(callbacks).toHaveLength(2)
    cancel()
  })

  it("cancels an idle request and guards against a late callback", () => {
    let callback: IdleRequestCallback | undefined
    window.requestIdleCallback = jest.fn((next) => { callback = next; return 12 })
    window.cancelIdleCallback = jest.fn()
    const load = jest.fn().mockResolvedValue({})
    const cancel = scheduleDialogChunkWarming([load])

    cancel()
    expect(window.cancelIdleCallback).toHaveBeenCalledWith(12)
    callback?.({ didTimeout: true, timeRemaining: () => 0 })
    expect(load).not.toHaveBeenCalled()
  })

  it("uses a delayed timer when idle callbacks are unavailable", () => {
    const loaders = [jest.fn().mockResolvedValue({}), jest.fn().mockResolvedValue({})]
    const cancel = scheduleDialogChunkWarming(loaders)

    jest.advanceTimersByTime(299)
    expect(loaders[0]).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(loaders[0]).toHaveBeenCalledTimes(1)
    expect(loaders[1]).not.toHaveBeenCalled()
    cancel()
    jest.runAllTimers()
    expect(loaders[1]).not.toHaveBeenCalled()
  })

  it("cancels before the fallback timer starts", () => {
    const load = jest.fn().mockResolvedValue({})
    scheduleDialogChunkWarming([load])()
    jest.runAllTimers()
    expect(load).not.toHaveBeenCalled()
  })

  it("catches rejected and throwing loaders without stopping later chunks", async () => {
    const rejected = jest.fn().mockRejectedValue(new Error("Chunk unavailable"))
    const throwing = jest.fn(() => { throw new Error("Loader failed") })
    const last = jest.fn().mockResolvedValue({})

    scheduleDialogChunkWarming([rejected, throwing, last])
    jest.runAllTimers()
    await Promise.resolve()
    expect(rejected).toHaveBeenCalledTimes(1)
    expect(throwing).toHaveBeenCalledTimes(1)
    expect(last).toHaveBeenCalledTimes(1)
  })

  it("does not schedule anything for an empty list", () => {
    scheduleDialogChunkWarming([])()
    expect(jest.getTimerCount()).toBe(0)
  })
})