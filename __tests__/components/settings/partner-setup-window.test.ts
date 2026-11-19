import { closePartnerSetupWindow, getPartnerSetupUrl, navigatePartnerSetupWindow, reservePartnerSetupWindow } from "@/app/components/settings/partner-setup-window"

afterEach(() => jest.restoreAllMocks())

function setupWindow() {
  return { opener: window, closed: false, location: { replace: jest.fn() }, close: jest.fn() }
}

it("reserves a blank tab synchronously and severs its opener before external navigation", () => {
  const popup = setupWindow()
  const open = jest.spyOn(window, "open").mockReturnValue(popup as unknown as Window)
  expect(reservePartnerSetupWindow()).toBe(popup)
  expect(open).toHaveBeenCalledWith("about:blank", "_blank")
  expect(popup.opener).toBeNull()
  expect(navigatePartnerSetupWindow(popup as unknown as Window, "https://example.test/invite")).toBe(true)
  expect(popup.location.replace).toHaveBeenCalledWith("https://example.test/invite")
})

it("leaves a blocked popup retryable without requesting another popup", () => {
  const open = jest.spyOn(window, "open").mockReturnValue(null)
  expect(reservePartnerSetupWindow()).toBeNull()
  expect(navigatePartnerSetupWindow(null, "https://example.test/invite")).toBe(false)
  expect(open).toHaveBeenCalledTimes(1)
})

it("does not let browser exceptions fail invitation creation", () => {
  jest.spyOn(window, "open").mockImplementation(() => { throw new Error("Blocked") })
  expect(reservePartnerSetupWindow()).toBeNull()
})

it("closes an unused tab if opener isolation fails", () => {
  const popup = setupWindow()
  Object.defineProperty(popup, "opener", { set: () => { throw new Error("Blocked") } })
  jest.spyOn(window, "open").mockReturnValue(popup as unknown as Window)
  expect(reservePartnerSetupWindow()).toBeNull()
  expect(popup.close).toHaveBeenCalledTimes(1)
})

it.each(["closed", "navigation error"])("preserves link recovery after %s", mode => {
  const popup = setupWindow()
  popup.closed = mode === "closed"
  if (mode === "navigation error") popup.location.replace.mockImplementation(() => { throw new Error("Blocked") })
  expect(navigatePartnerSetupWindow(popup as unknown as Window, "https://example.test/invite")).toBe(false)
  expect(popup.close).toHaveBeenCalledTimes(1)
})

it("ignores close failures", () => {
  const popup = setupWindow()
  popup.close.mockImplementation(() => { throw new Error("Already closed") })
  expect(() => closePartnerSetupWindow(popup as unknown as Window)).not.toThrow()
})

it.each([undefined, null, {}, "", "/invite", "javascript:alert(1)", "data:text/html,test", "http://example.test/invite", "https://user:pass@example.test/invite"])(
  "rejects unsafe setup link (%#)", value => {
    expect(getPartnerSetupUrl(value)).toBeUndefined()
    const popup = setupWindow()
    expect(navigatePartnerSetupWindow(popup as unknown as Window, value)).toBe(false)
    expect(popup.location.replace).not.toHaveBeenCalled()
    expect(popup.close).toHaveBeenCalledTimes(1)
  },
)