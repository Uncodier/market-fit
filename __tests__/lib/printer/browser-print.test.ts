import { printHtml } from "@/lib/printer/transports/browser-print"

jest.mock("@/lib/printer/core/inject-qr", () => ({ injectQrIntoDocument: jest.fn(async () => undefined) }))

describe("system print document lifetime (no real print calls)", () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => {
    jest.useRealTimers()
    document.querySelectorAll("iframe").forEach((frame) => frame.remove())
  })

  async function start(fail = false) {
    const pending = printHtml("<!doctype html><html><body>Audit report</body></html>")
    const frame = document.querySelector("iframe")!
    const win = frame.contentWindow!
    const print = jest.spyOn(win, "print").mockImplementation(() => {
      if (fail) throw new Error("Print unavailable")
    })
    jest.spyOn(win, "focus").mockImplementation(() => undefined)
    frame.dispatchEvent(new Event("load"))
    await Promise.resolve()
    await Promise.resolve()
    return { pending, frame, win, print }
  }

  it("retains the iframe when print returns before Safari closes its dialog", async () => {
    const { pending, frame, win, print } = await start()
    await jest.advanceTimersByTimeAsync(1500)
    await expect(pending).resolves.toBeUndefined()
    expect(print).toHaveBeenCalledTimes(1)
    expect(frame.isConnected).toBe(true)
    expect(frame.contentDocument?.body.textContent).toBe("Audit report")
    win.dispatchEvent(new Event("afterprint"))
    expect(frame.isConnected).toBe(false)
  })

  it("cleans up on afterprint without waiting for the dispatch timeout", async () => {
    const { pending, frame, win } = await start()
    win.dispatchEvent(new Event("afterprint"))
    await expect(pending).resolves.toBeUndefined()
    expect(frame.isConnected).toBe(false)
    expect(jest.getTimerCount()).toBe(0)
  })

  it("surfaces print exceptions and removes the frame", async () => {
    const { pending, frame } = await start(true)
    await expect(pending).rejects.toThrow("Print unavailable")
    expect(frame.isConnected).toBe(false)
    expect(jest.getTimerCount()).toBe(0)
  })
})