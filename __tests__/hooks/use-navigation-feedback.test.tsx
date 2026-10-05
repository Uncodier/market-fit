import { act, renderHook } from "@testing-library/react"
import { usePathname, useSearchParams } from "next/navigation"
import { toast, type Action } from "sonner"
import { useNavigationFeedback } from "@/app/hooks/use-navigation-feedback"
import { startNavigationWatchdog, getNavigationFeedback, NAVIGATION_SLOW_MS } from "@/lib/navigation/stale-router"

jest.mock("sonner", () => ({ toast: { loading: jest.fn(), warning: jest.fn(), dismiss: jest.fn() } }))

describe("navigation progress and opt-in recovery", () => {
  const originalLocation = window.location
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    jest.mocked(usePathname).mockReturnValue("/robots")
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as ReturnType<typeof useSearchParams>)
    Object.defineProperty(window, "location", { configurable: true, value: {
      pathname: "/robots", search: "", origin: "http://localhost", href: "http://localhost/robots", assign: jest.fn(), reload: jest.fn(),
    } })
  })
  afterEach(() => {
    jest.useRealTimers()
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
  })

  it("shows progress, warns about unsaved changes and navigates only on consent", () => {
    const hook = renderHook(useNavigationFeedback)
    act(() => { startNavigationWatchdog("/leads"); jest.advanceTimersByTime(500) })
    expect(toast.loading).toHaveBeenCalledWith("Opening page…", expect.anything())
    act(() => { jest.advanceTimersByTime(NAVIGATION_SLOW_MS) })
    const options = jest.mocked(toast.warning).mock.calls[0][1]!
    expect(options.description).toContain("unsaved changes")
    expect(window.location.assign).not.toHaveBeenCalled()
    act(() => { (options.action as Action).onClick({} as React.MouseEvent<HTMLButtonElement>) })
    expect(window.location.reload).toHaveBeenCalledTimes(1)
    expect(window.location.assign).not.toHaveBeenCalled()
    hook.unmount()
  })

  it("dismisses on a search-only route commit and disables the old recovery action", () => {
    const hook = renderHook(useNavigationFeedback)
    act(() => { startNavigationWatchdog("/robots?mode=workflow"); jest.advanceTimersByTime(NAVIGATION_SLOW_MS) })
    const options = jest.mocked(toast.warning).mock.calls[0][1]!
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("mode=workflow") as ReturnType<typeof useSearchParams>)
    hook.rerender()
    expect(getNavigationFeedback()).toBeNull()
    expect(toast.dismiss).toHaveBeenCalledWith("navigation-progress")
    act(() => { (options.action as Action).onClick({} as React.MouseEvent<HTMLButtonElement>) })
    expect(window.location.assign).not.toHaveBeenCalled()
    expect(window.location.reload).not.toHaveBeenCalled()
    hook.unmount()
  })

  it("cleans up timers and notifications on unmount", () => {
    const hook = renderHook(useNavigationFeedback)
    act(() => { startNavigationWatchdog("/leads"); jest.advanceTimersByTime(500) })
    hook.unmount()
    expect(getNavigationFeedback()).toBeNull()
    expect(jest.getTimerCount()).toBe(0)
    act(() => { jest.advanceTimersByTime(NAVIGATION_SLOW_MS) })
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("clears a previous warning action when Sonner merges the next pending toast", () => {
    const actual = jest.requireActual<typeof import("sonner")>("sonner").toast
    jest.mocked(toast.loading).mockImplementation(actual.loading)
    jest.mocked(toast.warning).mockImplementation(actual.warning)
    jest.mocked(toast.dismiss).mockImplementation(actual.dismiss)
    const hook = renderHook(useNavigationFeedback)
    act(() => { startNavigationWatchdog("/leads"); jest.advanceTimersByTime(NAVIGATION_SLOW_MS) })
    expect(actual.getToasts().find((item) => item.id === "navigation-progress")).toHaveProperty("action")
    act(() => { startNavigationWatchdog("/sales"); jest.advanceTimersByTime(500) })
    const pending = actual.getToasts().find((item) => item.id === "navigation-progress")
    expect(pending).toMatchObject({ type: "loading", action: undefined, description: undefined })
    hook.unmount()
    jest.mocked(toast.loading).mockReset()
    jest.mocked(toast.warning).mockReset()
    jest.mocked(toast.dismiss).mockReset()
  })
})