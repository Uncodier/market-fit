import { act, fireEvent, render, screen } from "@testing-library/react"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { dispatchNavigateAction } from "next/dist/client/components/app-router-instance"
import { useRouter, useSearchParams } from "next/navigation"
import { NavigationLink } from "@/app/components/navigation/NavigationLink"
import { useArtifactRouterPatch } from "@/app/hooks/use-artifact-router-patch"
import { cancelNavigationWatchdog, getNavigationFeedback, NAVIGATION_SLOW_MS } from "@/lib/navigation/stale-router"

// Use the installed Next Link click behavior; isolate its browser RSC transport.
jest.mock("next/link", () => jest.requireActual("next/dist/client/app-dir/link"))
jest.mock("next/dist/client/components/app-router-instance", () => ({ dispatchNavigateAction: jest.fn() }))
jest.mock("next/dist/client/components/links", () => ({
  mountLinkInstance: jest.fn(), unmountLinkForCurrentNavigation: jest.fn(),
  unmountPrefetchableInstance: jest.fn(), onNavigationIntent: jest.fn(),
}))

describe("NavigationLink", () => {
  const router = { push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), refresh: jest.fn(), back: jest.fn(), forward: jest.fn(), bfcacheId: "test" }
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks() })
  afterEach(() => {
    cancelNavigationWatchdog()
    delete (window as Window & { _isArtifactSession?: boolean })._isArtifactSession
    jest.useRealTimers()
  })

  function link(props: Partial<React.ComponentProps<typeof NavigationLink>> = {}) {
    render(<AppRouterContext.Provider value={router}><NavigationLink href="/leads" {...props}>Leads</NavigationLink></AppRouterContext.Provider>)
    return screen.getByRole("link", { name: "Leads" })
  }

  it("keeps Next client routing and reports a slow navigation without reloading", () => {
    fireEvent.click(link())
    expect(dispatchNavigateAction).toHaveBeenCalledWith("/leads", "push", 0, undefined, undefined, "none")
    act(() => { jest.advanceTimersByTime(NAVIGATION_SLOW_MS) })
    expect(getNavigationFeedback()?.status).toBe("slow")
  })

  it.each(["onClick", "onNavigate"] as const)("respects a navigation cancelled by %s", (handler) => {
    fireEvent.click(link({ [handler]: (event: { preventDefault: () => void }) => event.preventDefault() }))
    act(() => { jest.advanceTimersByTime(NAVIGATION_SLOW_MS) })
    expect(dispatchNavigateAction).not.toHaveBeenCalled()
    expect(getNavigationFeedback()).toBeNull()
  })

  it.each([
    [{ target: "_blank" }, {}],
    [{ download: true }, {}],
    [{}, { ctrlKey: true }],
    [{}, { metaKey: true }],
    [{ href: "https://external.example/" }, {}],
  ])("does not attach recovery to native browser navigation %j", (props, event) => {
    const anchor = link(props)
    // Let Next handle the event, then prevent jsdom's unsupported native navigation.
    document.addEventListener("click", (click) => click.preventDefault(), { once: true })
    fireEvent.click(anchor, event)
    act(() => { jest.advanceTimersByTime(NAVIGATION_SLOW_MS) })
    expect(dispatchNavigateAction).not.toHaveBeenCalled()
    expect(getNavigationFeedback()).toBeNull()
  })

  it("preserves replace and scroll options", () => {
    fireEvent.click(link({ replace: true, scroll: false }))
    expect(dispatchNavigateAction).toHaveBeenCalledWith("/leads", "replace", 1, undefined, undefined, "none")
  })

  it("tracks the effective as destination instead of the internal href", () => {
    fireEvent.click(link({ href: "/internal", as: "/", replace: true }))
    expect(dispatchNavigateAction).toHaveBeenCalledWith("/", "replace", 0, undefined, undefined, "none")
    act(() => { jest.advanceTimersByTime(NAVIGATION_SLOW_MS) })
    // Already on the displayed URL: no false pending indicator for /internal.
    expect(getNavigationFeedback()).toBeNull()
  })

  it.each(["onClick", "onNavigate", "replace"] as const)("retains %s with the artifact capture hook mounted", (mode) => {
    ;(window as Window & { _isArtifactSession?: boolean })._isArtifactSession = true
    const originalPush = jest.fn()
    const artifactRouter = { ...router, push: originalPush, replace: jest.fn(), prefetch: jest.fn() }
    jest.mocked(useRouter).mockReturnValue(artifactRouter)
    jest.mocked(useSearchParams).mockReturnValue(new URLSearchParams("artifact=true") as ReturnType<typeof useSearchParams>)
    function ArtifactHook() { useArtifactRouterPatch(); return null }
    render(<ArtifactHook />)
    const props = mode === "replace" ? { replace: true } : { [mode]: (event: { preventDefault: () => void }) => event.preventDefault() }
    fireEvent.click(link(props))
    expect(originalPush).not.toHaveBeenCalled()
    if (mode === "replace") {
      expect(dispatchNavigateAction).toHaveBeenCalledWith("/leads?artifact=true", "replace", 0, undefined, undefined, "none")
    } else {
      expect(dispatchNavigateAction).not.toHaveBeenCalled()
      expect(getNavigationFeedback()).toBeNull()
    }
  })
})