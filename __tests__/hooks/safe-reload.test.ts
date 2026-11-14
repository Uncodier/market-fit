import { safeDataRefresh, safeReload } from "@/app/utils/safe-reload"

const originalLocation = window.location
const reload = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  Object.defineProperty(window, "location", { configurable: true, value: { pathname: "/pos", reload } })
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  jest.spyOn(console, "log").mockImplementation(() => {})
  jest.spyOn(console, "warn").mockImplementation(() => {})
  jest.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
  Reflect.deleteProperty(navigator, "onLine")
})

it.each(["/pos", "/pos/", "/pos/check-in"])("protects %s even from forced global reloads", (pathname) => {
  window.location.pathname = pathname
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage unavailable") })
  expect(safeReload(false)).toBe(false)
  expect(safeReload(true)).toBe(false)
  expect(reload).not.toHaveBeenCalled()
})

it("checks the live route when another feature's asynchronous refresh fails", async () => {
  window.location.pathname = "/leads"
  const refreshed = safeDataRefresh(async () => {
    window.location.pathname = "/pos"
    throw new Error("Network request failed")
  }, true, "Global creation callback")
  expect(await refreshed).toBe(false)
  expect(reload).not.toHaveBeenCalled()
})

it("keeps data refresh available inside POS without replacing the document", async () => {
  const refresh = jest.fn()
  expect(await safeDataRefresh(refresh, true)).toBe(true)
  expect(refresh).toHaveBeenCalledTimes(1)
  expect(reload).not.toHaveBeenCalled()
})

it("blocks offline reloads outside POS too", () => {
  window.location.pathname = "/leads"
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
  expect(safeReload(true)).toBe(false)
  expect(reload).not.toHaveBeenCalled()
})

it("does not mistake other prefixes for POS and retains edit-page protection", () => {
  window.location.pathname = "/positions"
  sessionStorage.setItem("preventAutoRefresh", "true")
  expect(safeReload()).toBe(false)
  expect(safeReload(true)).toBe(true)
  expect(reload).toHaveBeenCalledTimes(1)
})