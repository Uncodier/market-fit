import {
  initializeSiteBilling, prepareSiteBilling, BILLING_INITIALIZATION_WARNING,
  BILLING_UNAVAILABLE_WARNING, BILLING_REFRESH_WARNING, BILLING_REFRESH_WAIT_MS,
} from "@/app/services/initialize-site-billing"

const siteId = "11111111-1111-4111-8111-111111111111"
const fetchMock = jest.mocked(fetch)
const refresh = jest.fn()
const result = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response

beforeEach(() => {
  jest.clearAllMocks()
  fetchMock.mockResolvedValue(result({ success: true, outcome: "initialized" }))
  refresh.mockResolvedValue(undefined)
})

it("uses only a bounded same-origin authenticated request with a site ID", async () => {
  await initializeSiteBilling(siteId)
  expect(fetchMock).toHaveBeenCalledWith("/api/billing/initialize", expect.objectContaining({
    method: "POST", credentials: "same-origin", cache: "no-store",
    body: JSON.stringify({ site_id: siteId }), signal: expect.any(AbortSignal),
  }))
})

it.each(["initialized", "already_initialized"])("refreshes persisted credits only after confirmed %s", async outcome => {
  fetchMock.mockResolvedValue(result({ success: true, outcome }))
  expect(await prepareSiteBilling(siteId, refresh)).toBeNull()
  expect(refresh).toHaveBeenCalledWith(siteId)
  expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(refresh.mock.invocationCallOrder[0])
})

it.each([
  result({ success: false, error: { message: "Private SQL" } }, false),
  result({ success: false }), result({ success: true }), result({}),
])("does not refresh or display raw errors for failed/unconfirmed initialization", async response => {
  fetchMock.mockResolvedValue(response)
  expect(await prepareSiteBilling(siteId, refresh)).toBe(BILLING_INITIALIZATION_WARNING)
  expect(refresh).not.toHaveBeenCalled()
})

it("surfaces RPC availability explicitly without exposing raw database errors", async () => {
  fetchMock.mockResolvedValue(result({ success: false, error: { code: "BILLING_INITIALIZATION_UNAVAILABLE", message: "Private SQL" } }, false))
  expect(await prepareSiteBilling(siteId, refresh)).toBe(BILLING_UNAVAILABLE_WARNING)
})

it("does not automatically replay ambiguous timeouts/network failures", async () => {
  fetchMock.mockRejectedValue(new Error("Private network details"))
  expect(await prepareSiteBilling(siteId, refresh)).toBe(BILLING_INITIALIZATION_WARNING)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(refresh).not.toHaveBeenCalled()
})

it("bounds the request and clears its timer without automatically replaying", async () => {
  jest.useFakeTimers()
  try {
    let signal: AbortSignal | undefined
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      signal = init?.signal as AbortSignal
      signal.addEventListener("abort", () => reject(new Error("Timeout")))
    }))
    const pending = prepareSiteBilling(siteId, refresh)
    await jest.advanceTimersByTimeAsync(15_000)
    expect(await pending).toBe(BILLING_INITIALIZATION_WARNING)
    expect(signal?.aborted).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  } finally {
    jest.useRealTimers()
  }
})

it("distinguishes confirmed initialization from a stale UI balance", async () => {
  refresh.mockRejectedValue(new Error("RLS read failure"))
  expect(await prepareSiteBilling(siteId, refresh)).toBe(BILLING_REFRESH_WARNING)
})

it("does not let an unresponsive refresh block the saved project forever", async () => {
  jest.useFakeTimers()
  try {
    refresh.mockReturnValue(new Promise(() => {}))
    const pending = prepareSiteBilling(siteId, refresh)
    await jest.advanceTimersByTimeAsync(BILLING_REFRESH_WAIT_MS)
    expect(await pending).toBe(BILLING_REFRESH_WARNING)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  } finally {
    jest.useRealTimers()
  }
})