import { requestWebUsbPrinter, warmWebUsbPrinter, writeWebUsbBytes } from "@/lib/printer/transports/web-usb"
import { withUsbSession } from "@/lib/printer/transports/usb-session"

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

// Separate browser handles share one exclusive physical interface, as tabs do.
function installHardware() {
  let owner: object | null = null
  function createHandle() {
    const iface = { claimed: false, interfaceNumber: 0,
      alternates: [{ endpoints: [{ direction: "out", type: "bulk", endpointNumber: 1 }] }] }
    const device = {
      vendorId: 1, productId: 2, serialNumber: "session-printer", opened: false,
      configuration: { interfaces: [iface] },
      open: jest.fn(async () => { device.opened = true }),
      close: jest.fn(async () => {
        if (owner === device) owner = null
        iface.claimed = false
        device.opened = false
      }),
      selectConfiguration: jest.fn(),
      claimInterface: jest.fn(async () => {
        if (owner && owner !== device) throw new Error("Unable to claim interface")
        owner = device
        iface.claimed = true
      }),
      transferOut: jest.fn(async (_endpoint: number, data: Uint8Array) => {
        if (owner !== device) throw new Error("Interface not claimed")
        return { status: "ok", bytesWritten: data.length }
      }),
    }
    return device
  }
  let current = createHandle()
  const usb = { getDevices: jest.fn(async () => [current]), requestDevice: jest.fn(async () => current) }
  Object.defineProperty(navigator, "usb", { configurable: true, value: usb })
  return { usb, device: current, nextHandle: () => { current = createHandle(); return current } }
}

const binding = { usbVendorId: 1, usbProductId: 2, usbSerialNumber: "session-printer" }
const write = (bytes = new Uint8Array([1, 2])) => writeWebUsbBytes(bytes, 1, 2, "session-printer", { allowPrompt: false })
const probe = () => warmWebUsbPrinter(1, 2, "session-printer")

afterEach(() => {
  delete (navigator as Navigator & { usb?: unknown }).usb
  Reflect.deleteProperty(navigator, "locks")
  jest.restoreAllMocks()
  jest.useRealTimers()
})

it("releases a status probe's interface so another handle can reconnect without a chooser", async () => {
  const hw = installHardware()
  await expect(probe()).resolves.toBe(true)
  expect(hw.device.close).toHaveBeenCalledTimes(1)
  const next = hw.nextHandle()
  await expect(requestWebUsbPrinter(binding)).resolves.toMatchObject({ kind: "webusb" })
  expect(hw.usb.requestDevice).not.toHaveBeenCalled()
  expect(hw.device.opened).toBe(false)
  expect(next.opened).toBe(false)
  expect(hw.device.transferOut).not.toHaveBeenCalled()
})

it("queues a reconnect behind a pending probe instead of competing for the interface", async () => {
  const hw = installHardware()
  const claimed = deferred()
  const resume = deferred()
  const claim = hw.device.claimInterface.getMockImplementation()!
  hw.device.claimInterface.mockImplementation(async () => {
    await claim()
    claimed.resolve()
    await resume.promise
  })
  const checking = probe()
  await claimed.promise
  const next = hw.nextHandle()
  const reconnecting = requestWebUsbPrinter(binding)
  // Attach assertions before releasing the gate to catch early rejections.
  const result = expect(reconnecting).resolves.toMatchObject({ kind: "webusb" })
  await Promise.resolve()
  resume.resolve()
  await expect(checking).resolves.toBe(true)
  await result
  expect(next.close).toHaveBeenCalledTimes(1)
})

it("keeps the interface until the entire ticket completes, then lets a probe use it", async () => {
  const hw = installHardware()
  const started = deferred()
  const resume = deferred()
  const transfer = hw.device.transferOut.getMockImplementation()!
  hw.device.transferOut.mockImplementationOnce(async (endpoint, data) => {
    started.resolve()
    await resume.promise
    return transfer(endpoint, data)
  })
  const printing = write(new Uint8Array(130))
  await started.promise
  hw.nextHandle()
  const checking = probe()
  const checked = expect(checking).resolves.toBe(true)
  expect(hw.device.close).not.toHaveBeenCalled()
  resume.resolve()
  await printing
  await checked
  expect(hw.device.transferOut).toHaveBeenCalledTimes(3)
  expect(hw.device.close).toHaveBeenCalledTimes(1)
  expect(hw.usb.requestDevice).not.toHaveBeenCalled()
})

it("closes a failed preparation instead of leaving an open handle", async () => {
  const hw = installHardware()
  hw.device.claimInterface.mockRejectedValue(new Error("Unable to claim interface"))
  await expect(probe()).resolves.toBe(false)
  expect(hw.device.close).toHaveBeenCalledTimes(1)
  expect(hw.device.opened).toBe(false)
})

it("releases a partial write without replaying it and allows the next explicit job", async () => {
  const hw = installHardware()
  hw.device.transferOut.mockResolvedValueOnce({ status: "ok", bytesWritten: 1 })
  await expect(write()).rejects.toThrow("incomplete")
  expect(hw.device.transferOut).toHaveBeenCalledTimes(1)
  expect(hw.device.close).toHaveBeenCalledTimes(1)
  hw.nextHandle()
  await expect(write()).resolves.toBeUndefined()
  expect(hw.usb.requestDevice).not.toHaveBeenCalled()
})

it("coordinates independent module instances through Web Locks and closes before releasing the lock", async () => {
  let otherTab!: typeof withUsbSession
  await jest.isolateModulesAsync(async () => {
    otherTab = (await import("@/lib/printer/transports/usb-session")).withUsbSession
  })
  let tail = Promise.resolve()
  const request = jest.fn((_name: string, _options: object, callback: () => Promise<void>) => {
    const next = tail.then(callback)
    tail = next.catch(() => {})
    return next
  })
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request } })
  const hw = installHardware()
  const other = hw.nextHandle()
  const started = deferred()
  const finish = deferred()
  const first = withUsbSession(hw.device, async () => {
    await hw.device.open()
    await hw.device.claimInterface()
    started.resolve()
    await finish.promise
  })
  await started.promise
  const second = otherTab(other, async () => {
    expect(hw.device.opened).toBe(false)
    await other.open()
    await other.claimInterface()
  })
  await Promise.resolve()
  expect(other.open).not.toHaveBeenCalled()
  finish.resolve()
  await Promise.all([first, second])
  expect(request).toHaveBeenCalledTimes(2)
  expect(request.mock.calls.map(([name]) => name)).toEqual(["printer-usb:1:2", "printer-usb:1:2"])
  expect(other.opened).toBe(false)
})

it("does not report completed output as failed if closing the handle fails", async () => {
  const hw = installHardware()
  const warning = jest.spyOn(console, "warn").mockImplementation(() => {})
  hw.device.close.mockRejectedValueOnce(new Error("Device disconnected during close"))
  await expect(write()).resolves.toBeUndefined()
  expect(hw.device.transferOut).toHaveBeenCalledTimes(1)
  expect(warning).toHaveBeenCalledTimes(1)
})

it("times out waiting for another tab without touching hardware or prompting", async () => {
  jest.useFakeTimers()
  const hw = installHardware()
  const waiting = deferred()
  const request = jest.fn((_name: string, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new DOMException("Lock wait expired", "AbortError")))
    waiting.resolve()
  }))
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request } })
  const result = expect(write()).rejects.toThrow("Lock wait expired")
  await waiting.promise
  await jest.advanceTimersByTimeAsync(10000)
  await result
  expect(hw.device.open).not.toHaveBeenCalled()
  expect(hw.device.close).not.toHaveBeenCalled()
  expect(hw.device.transferOut).not.toHaveBeenCalled()
  expect(hw.usb.requestDevice).not.toHaveBeenCalled()
})