import { act, renderHook } from "@testing-library/react"
import { useSiteListRecovery } from "@/app/components/navigation/use-site-list-recovery"

beforeEach(() => { jest.useFakeTimers() })
afterEach(() => { jest.useRealTimers() })

it("bounds automatic retries and still permits manual and reconnect recovery", async () => {
  const refresh = jest.fn().mockResolvedValue(undefined)
  const { result } = renderHook(() => useSiteListRecovery("actor:site", refresh))
  for (const delay of [15_000, 30_000, 60_000, 120_000]) {
    await act(async () => jest.advanceTimersByTime(delay))
  }
  expect(refresh).toHaveBeenCalledTimes(3)
  await act(async () => result.current.retry())
  expect(refresh).toHaveBeenCalledTimes(4)
  await act(async () => window.dispatchEvent(new Event("online")))
  expect(refresh).toHaveBeenCalledTimes(5)
})

it("deduplicates pending attempts and cancels automatic recovery when scope disappears", async () => {
  let resolve!: () => void
  const refresh = jest.fn(() => new Promise<void>(done => { resolve = done }))
  const { result, rerender } = renderHook(({ scope }) => useSiteListRecovery(scope, refresh), {
    initialProps: { scope: "actor:site" as string | null },
  })
  act(() => { result.current.retry(); result.current.retry() })
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(result.current.isRefreshing).toBe(true)
  rerender({ scope: null })
  await act(async () => resolve())
  await act(async () => jest.advanceTimersByTime(120_000))
  await act(async () => window.dispatchEvent(new Event("online")))
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(result.current.isRefreshing).toBe(false)
})