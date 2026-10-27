import { act, fireEvent, render, screen } from "@testing-library/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { GuidedTour } from "@/app/components/onboarding/GuidedTour"
import { useAuth } from "@/app/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"

jest.mock("@/app/hooks/use-auth", () => ({ useAuth: jest.fn() }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))

const push = jest.fn()
const replace = jest.fn()
const updateUser = jest.fn().mockResolvedValue({ error: null })
const auth: ReturnType<typeof useAuth> = {
  user: {
    id: "synthetic-user", user_metadata: {}, app_metadata: {},
    aud: "authenticated", created_at: "2030-01-01T00:00:00Z",
  },
  isAuthenticated: true, isLoading: false,
  signInWithEmail: jest.fn(), signInWithOAuth: jest.fn(),
  signUpWithEmail: jest.fn(), signOut: jest.fn(),
}

function setRoute(path: string) {
  window.history.replaceState({}, "", path)
  jest.mocked(usePathname).mockReturnValue(window.location.pathname)
  jest.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(window.location.search) as ReturnType<typeof useSearchParams>,
  )
}

function mountWithTarget() {
  return render(<><div id="tour-onboarding-widget" /><GuidedTour /></>)
}

describe("guided tour navigation", () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    setRoute("/onboarding")
    jest.mocked(useRouter).mockReturnValue({
      push, replace, back: jest.fn(), forward: jest.fn(),
      refresh: jest.fn(), prefetch: jest.fn(), bfcacheId: "synthetic-route",
    })
    jest.mocked(useAuth).mockReturnValue(auth)
    jest.mocked(createClient).mockReturnValue({ auth: { updateUser } } as ReturnType<typeof createClient>)
    Element.prototype.scrollIntoView = jest.fn()
  })

  afterEach(() => { jest.useRealTimers() })

  it.each(["/content", "/leads", "/robots", "/projects", "/buyer/orders"])(
    "does not hijack an unfinished user's explicit %s destination",
    async path => {
      setRoute(path)
      mountWithTarget()
      await act(async () => { await jest.advanceTimersByTimeAsync(12_000) })
      expect(push).not.toHaveBeenCalled()
      expect(replace).not.toHaveBeenCalled()
      expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument()
      expect(updateUser).not.toHaveBeenCalled()
    },
  )

  it("automatically offers the tour on onboarding without another navigation", async () => {
    mountWithTarget()
    await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
    expect(screen.getByRole("button", { name: "Skip" })).toBeVisible()
    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it("offers the tour when the onboarding widget arrives after the initial check", async () => {
    render(<GuidedTour />)
    await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
    const target = document.createElement("div")
    target.id = "tour-onboarding-widget"
    await act(async () => { document.body.append(target) })
    expect(screen.getByRole("button", { name: "Skip" })).toBeVisible()
    expect(push).not.toHaveBeenCalled()
    target.remove()
  })

  it("cancels pending automatic checks when the user leaves onboarding", async () => {
    const view = mountWithTarget()
    await act(async () => { await jest.advanceTimersByTimeAsync(500) })
    setRoute("/content")
    view.rerender(<><div id="tour-onboarding-widget" /><GuidedTour /></>)
    await act(async () => { await jest.advanceTimersByTimeAsync(12_000) })
    expect(push).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument()
  })

  it("does not automatically offer a completed user's tour", async () => {
    jest.mocked(useAuth).mockReturnValue({
      ...auth, user: { ...auth.user!, user_metadata: { has_completed_tour: true } },
    })
    mountWithTarget()
    await act(async () => { await jest.advanceTimersByTimeAsync(12_000) })
    expect(push).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument()
  })

  it("disconnects the widget observer when leaving onboarding", async () => {
    const view = render(<GuidedTour />)
    await act(async () => { await jest.advanceTimersByTimeAsync(1000) })
    setRoute("/content")
    view.rerender(<GuidedTour />)
    const target = document.createElement("div")
    target.id = "tour-onboarding-widget"
    await act(async () => {
      document.body.append(target)
      await jest.advanceTimersByTimeAsync(12_000)
    })
    expect(push).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument()
    target.remove()
  })

  it("does not offer automatic guidance without an authenticated user", async () => {
    jest.mocked(useAuth).mockReturnValue({ ...auth, user: null, isAuthenticated: false })
    mountWithTarget()
    await act(async () => { await jest.advanceTimersByTimeAsync(12_000) })
    expect(push).not.toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument()
  })

  it("preserves explicitly requested tour navigation from Content", async () => {
    setRoute("/content?tour=start")
    mountWithTarget()
    expect(push).toHaveBeenCalledWith("/onboarding?showTour=true&step=0")
    await act(async () => { await jest.advanceTimersByTimeAsync(12_000) })
    expect(push).toHaveBeenCalledTimes(1)
  })

  it("does not restart a manually resumed step on onboarding", async () => {
    setRoute("/onboarding?showTour=true&step=2")
    mountWithTarget()
    await act(async () => { await jest.advanceTimersByTimeAsync(5000) })
    expect(screen.getByText("Ask Anything")).toBeVisible()
    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it("preserves the manual tour:start event outside onboarding", () => {
    setRoute("/leads")
    mountWithTarget()
    fireEvent(window, new CustomEvent("tour:start"))
    expect(push).toHaveBeenCalledWith("/onboarding?showTour=true&step=0")
  })
})