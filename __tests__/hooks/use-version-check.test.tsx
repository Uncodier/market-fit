import { act, renderHook } from "@testing-library/react"
import { toast, type Action } from "sonner"
import { useLocalization } from "@/app/context/LocalizationContext"

jest.mock("sonner", () => ({ toast: { info: jest.fn(), warning: jest.fn(), dismiss: jest.fn() } }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: jest.fn() }))

describe("explicit, non-destructive version updates", () => {
  let useVersionCheck: typeof import("@/app/hooks/use-version-check").useVersionCheck
  const originalLocation = window.location
  const originalBuildId = process.env.NEXT_PUBLIC_BUILD_ID
  const reload = jest.fn()
  let confirm: jest.SpyInstance<boolean, [message?: string]>

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_BUILD_ID = "client-build"
    ;({ useVersionCheck } = await import("@/app/hooks/use-version-check"))
  })

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    jest.mocked(useLocalization).mockReturnValue({ t: (key: string) => `translated:${key}` } as ReturnType<typeof useLocalization>)
    localStorage.clear()
    Object.defineProperty(window, "location", { configurable: true, value: {
      pathname: "/pos", hostname: "app.makinari.com", reload,
    } })
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
    jest.mocked(fetch).mockResolvedValue({ ok: true, status: 200, json: async () => ({ version: "new-build" }) } as Response)
    confirm = jest.spyOn(window, "confirm").mockReturnValue(true)
  })

  afterEach(() => {
    jest.useRealTimers()
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
    jest.restoreAllMocks()
  })

  afterAll(() => {
    if (originalBuildId === undefined) delete process.env.NEXT_PUBLIC_BUILD_ID
    else process.env.NEXT_PUBLIC_BUILD_ID = originalBuildId
    Reflect.deleteProperty(document, "visibilityState")
    Reflect.deleteProperty(navigator, "onLine")
  })

  async function mount() {
    const hook = renderHook(useVersionCheck)
    await act(async () => {})
    return hook
  }

  function updateAction() {
    return jest.mocked(toast.info).mock.calls[0][1]!.action as Action
  }

  function click(action = updateAction()) {
    const event = { preventDefault: jest.fn() }
    act(() => action.onClick(event as unknown as React.MouseEvent<HTMLButtonElement>))
    expect(event.preventDefault).toHaveBeenCalled()
  }

  it("only notifies on detection, polling, and visibility changes", async () => {
    const hook = await mount()
    expect(toast.info).toHaveBeenCalledTimes(1)
    expect(toast.info).toHaveBeenCalledWith("translated:version.newAvailable", expect.objectContaining({
      action: expect.objectContaining({ label: "translated:version.reload" }),
    }))
    expect(jest.mocked(toast.info).mock.calls[0][1]?.description).toContain("not reload")
    await act(async () => {
      jest.advanceTimersByTime(15 * 60_000)
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    hook.unmount()
  })

  it.each(["/pos", "/pos/", "/pos/check-in", "/pos/register"])("defers %s without inferring safety from persisted state", async (pathname) => {
    window.location.pathname = pathname
    const hook = await mount()
    click()
    expect(toast.warning).toHaveBeenCalledWith("Update deferred while POS is open", expect.anything())
    expect(confirm).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    hook.unmount()
  })

  it("checks the live route, not the route where the notification appeared", async () => {
    window.location.pathname = "/projects"
    const hook = await mount()
    window.location.pathname = "/pos"
    click()
    expect(reload).not.toHaveBeenCalled()
    window.location.pathname = "/projects"
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(false)
    click()
    expect(reload).not.toHaveBeenCalled()
    confirmSpy.mockReturnValue(true)
    click()
    expect(reload).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it("does not mistake another route prefix for POS and requires confirmation", async () => {
    window.location.pathname = "/positions"
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true)
    const hook = await mount()
    expect(reload).not.toHaveBeenCalled()
    click()
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining("Unsaved changes"))
    expect(reload).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it("defers an offline update outside POS without navigation", async () => {
    window.location.pathname = "/projects"
    const hook = await mount()
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
    click()
    expect(toast.warning).toHaveBeenCalledWith("Update deferred while offline", expect.anything())
    expect(reload).not.toHaveBeenCalled()
    hook.unmount()
  })

  it.each([null, "client-build", ""])("does not notify for version %s", async (version) => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ version }) } as Response)
    const hook = await mount()
    expect(toast.info).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    hook.unmount()
  })

  it("silently tolerates network failures", async () => {
    jest.mocked(fetch).mockRejectedValue(new Error("Network unavailable"))
    const hook = await mount()
    expect(toast.info).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    hook.unmount()
  })

  it("keeps checks single-flight and ignores a response after unmount", async () => {
    const setIntervalSpy = jest.spyOn(window, "setInterval")
    const clearIntervalSpy = jest.spyOn(window, "clearInterval")
    let resolve!: (response: Response) => void
    jest.mocked(fetch).mockReturnValue(new Promise<Response>((done) => { resolve = done }))
    const hook = await mount()
    await act(async () => {
      jest.advanceTimersByTime(5_000)
      document.dispatchEvent(new Event("visibilitychange"))
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    const signal = jest.mocked(fetch).mock.calls[0][1]!.signal!
    hook.unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => { resolve({ ok: true, json: async () => ({ version: "new-build" }) } as Response) })
    expect(toast.info).not.toHaveBeenCalled()
    expect(clearIntervalSpy).toHaveBeenCalledWith(setIntervalSpy.mock.results[0].value)
  })

  it.each(["headers", "body"])("bounds stalled %s, retries later, and ignores late results", async (stage) => {
    let resolve!: (value: Response & { version: string }) => void
    const stalled = new Promise<Response & { version: string }>((done) => { resolve = done })
    if (stage === "headers") jest.mocked(fetch).mockReturnValueOnce(stalled)
    else jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: () => stalled } as unknown as Response)
    const hook = await mount()
    const signal = jest.mocked(fetch).mock.calls[0][1]!.signal!
    await act(async () => { jest.advanceTimersByTime(10_000) })
    expect(signal.aborted).toBe(true)
    expect(toast.info).not.toHaveBeenCalled()
    expect(toast.warning).not.toHaveBeenCalled()
    await act(async () => {
      resolve({ ok: true, version: "late-build", json: async () => ({ version: "late-build" }) } as Response & { version: string })
    })
    expect(toast.info).not.toHaveBeenCalled()
    await act(async () => { jest.advanceTimersByTime(5 * 60_000 - 10_000) })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(toast.info).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
    hook.unmount()
  })

  it("uses the current translations when a pending check completes", async () => {
    let resolve!: (response: Response) => void
    jest.mocked(fetch).mockReturnValueOnce(new Promise<Response>((done) => { resolve = done }))
    const hook = await mount()
    jest.mocked(useLocalization).mockReturnValue({ t: (key: string) => `current:${key}` } as ReturnType<typeof useLocalization>)
    hook.rerender()
    await act(async () => { resolve({ ok: true, json: async () => ({ version: "new-build" }) } as Response) })
    expect(toast.info).toHaveBeenCalledWith("current:version.newAvailable", expect.objectContaining({
      action: expect.objectContaining({ label: "current:version.reload" }),
    }))
    expect(fetch).toHaveBeenCalledTimes(1)
    hook.unmount()
  })

  it("invalidates a notification's action after cleanup", async () => {
    const hook = await mount()
    const action = updateAction()
    hook.unmount()
    window.location.pathname = "/projects"
    click(action)
    expect(reload).not.toHaveBeenCalled()
    expect(toast.dismiss).toHaveBeenCalledWith("app-version-update")
  })

  it("still notifies when storage reads and writes are unavailable", async () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked") })
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Blocked") })
    const hook = await mount()
    expect(toast.info).toHaveBeenCalledTimes(1)
    expect(reload).not.toHaveBeenCalled()
    hook.unmount()
  })
})