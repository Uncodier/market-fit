import { StrictMode } from "react"
import { act, renderHook } from "@testing-library/react"
import { enUS, es } from "date-fns/locale"
import { endOfDay, startOfDay } from "date-fns"
import { usePersistentDateRange } from "@/app/hooks/use-persistent-date-range"
import { cacheDateRange, readDateRange } from "@/lib/dates/date-range-cache"
import { resolveDateRangePreset } from "@/lib/dates/date-range-presets"

const key = "orders-date-range:site-1"
const today = () => ({ ...resolveDateRangePreset("today"), preset: "today" as const })

describe("persistent date ranges", () => {
  beforeEach(() => {
    window.localStorage.clear()
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 8, 30, 23, 59, 59))
  })
  afterEach(() => jest.useRealTimers())

  it("recalculates a cached preset before making the range ready on a later mount", () => {
    cacheDateRange(key, today())
    jest.setSystemTime(new Date(2026, 9, 5, 12))
    const { result } = renderHook(() => usePersistentDateRange(key))
    expect(result.current.isDateRangeReady).toBe(true)
    expect(result.current.dateRange).toEqual(today())
  })

  it("updates the range and cache at midnight without reloading", () => {
    cacheDateRange(key, today())
    const { result, unmount } = renderHook(() => usePersistentDateRange(key))
    act(() => jest.advanceTimersByTime(1000))
    expect(result.current.dateRange).toEqual({
      startDate: new Date(2026, 9, 1), endDate: endOfDay(new Date(2026, 9, 1)), preset: "today",
    })
    expect(readDateRange(key)).toEqual(result.current.dateRange)
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })

  it.each(["focus", "visibilitychange"])("refreshes after a suspended tab returns via %s", (event) => {
    cacheDateRange(key, today())
    const { result } = renderHook(() => usePersistentDateRange(key))
    jest.setSystemTime(new Date(2026, 9, 3, 12))
    act(() => (event === "focus" ? window : document).dispatchEvent(new Event(event)))
    expect(result.current.dateRange).toEqual(today())
  })

  it("does not re-publish unchanged bounds on focus", () => {
    cacheDateRange(key, today())
    const { result } = renderHook(() => usePersistentDateRange(key))
    const previous = result.current.dateRange
    act(() => window.dispatchEvent(new Event("focus")))
    expect(result.current.dateRange).toBe(previous)
  })

  it("keeps custom dates fixed and cancels the relative timer", () => {
    cacheDateRange(key, today())
    const { result } = renderHook(() => usePersistentDateRange(key))
    const custom = { ...today(), preset: "custom" as const }
    act(() => result.current.setDateRange(custom))
    act(() => jest.advanceTimersByTime(1000))
    act(() => window.dispatchEvent(new Event("focus")))
    expect(result.current.dateRange).toEqual(custom)
    expect(readDateRange(key)).toEqual(custom)
    expect(jest.getTimerCount()).toBe(0)
  })

  it("clears dates and preset together, including after remount", () => {
    cacheDateRange(key, today())
    const { result, unmount } = renderHook(() => usePersistentDateRange(key))
    act(() => result.current.setDateRange(null))
    act(() => jest.advanceTimersByTime(1000))
    expect(result.current.dateRange).toBeNull()
    unmount()
    const reloaded = renderHook(() => usePersistentDateRange(key))
    expect(reloaded.result.current.dateRange).toBeNull()
    expect(jest.getTimerCount()).toBe(0)
  })

  it("isolates site caches and only exposes readiness for the restored site", () => {
    const otherKey = "orders-date-range:site-2"
    cacheDateRange(key, today())
    cacheDateRange(otherKey, null)
    const renders: { storageKey: string | null; ready: boolean }[] = []
    const { result, rerender } = renderHook(({ storageKey }: { storageKey: string | null }) => {
      const state = usePersistentDateRange(storageKey)
      renders.push({ storageKey, ready: state.isDateRangeReady })
      return state
    }, { initialProps: { storageKey: key as string | null } })
    rerender({ storageKey: otherKey })
    expect(renders.find((render) => render.storageKey === otherKey)?.ready).toBe(false)
    expect(result.current.dateRange).toBeNull()
    act(() => jest.advanceTimersByTime(1000))
    expect(readDateRange(otherKey)).toBeNull()
    rerender({ storageKey: key })
    expect(result.current.dateRange).toEqual(today())
    rerender({ storageKey: null })
    expect(result.current.isDateRangeReady).toBe(false)
    expect(jest.getTimerCount()).toBe(0)
  })

  it("uses a rolling 30-day default for a missing or corrupt cache", () => {
    window.localStorage.setItem(key, "broken")
    const { result } = renderHook(() => usePersistentDateRange(key))
    expect(result.current.dateRange).toEqual({ ...resolveDateRangePreset("last30Days"), preset: "last30Days" })
    act(() => jest.advanceTimersByTime(1000))
    expect(result.current.dateRange).toEqual({ ...resolveDateRangePreset("last30Days"), preset: "last30Days" })
  })

  it("uses the active locale's week boundary when restoring This week", () => {
    cacheDateRange(key, { ...resolveDateRangePreset("thisWeek"), preset: "thisWeek" })
    const { result, rerender } = renderHook(({ locale }) => usePersistentDateRange(key, locale), {
      initialProps: { locale: enUS },
    })
    expect(result.current.dateRange?.startDate).toEqual(startOfDay(new Date(2026, 8, 27)))
    rerender({ locale: es })
    expect(result.current.dateRange?.startDate).toEqual(startOfDay(new Date(2026, 8, 28)))
  })

  it.each([new Date(2026, 2, 8), new Date(2026, 10, 1)])("schedules the next local midnight across DST (%s)", (now) => {
    jest.setSystemTime(now)
    cacheDateRange(key, today())
    const { result } = renderHook(() => usePersistentDateRange(key))
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    act(() => jest.advanceTimersByTime(nextDay.getTime() - now.getTime() - 1))
    expect(result.current.dateRange?.startDate).toEqual(now)
    act(() => jest.advanceTimersByTime(1))
    expect(result.current.dateRange?.startDate).toEqual(nextDay)
  })

  it("cleans up strict-mode subscriptions without duplicating timers", () => {
    cacheDateRange(key, today())
    const { result, unmount } = renderHook(() => usePersistentDateRange(key), { wrapper: StrictMode })
    expect(jest.getTimerCount()).toBe(1)
    act(() => jest.advanceTimersByTime(1000))
    expect(result.current.dateRange).toEqual(today())
    expect(jest.getTimerCount()).toBe(1)
    unmount()
    expect(jest.getTimerCount()).toBe(0)
  })
})