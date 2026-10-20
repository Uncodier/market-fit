import {
  getStartupTrial, startStartupTrial, readStartupTrialActivation, waitForStartupTrial,
  STARTUP_TRIAL_REQUEST_TIMEOUT_MS,
} from "@/app/services/startup-trial"

const siteId = "11111111-1111-4111-8111-111111111111"
const eligible = {
  success: true, state: "eligible", started_at: null, ends_at: null,
  credits_remaining: 0, server_now: "2026-10-19T12:00:00.000Z",
}
const active = {
  ...eligible, state: "active", started_at: eligible.server_now,
  ends_at: "2026-11-03T12:00:00.000Z", credits_remaining: 50,
}
const originalFetch = global.fetch
const fetchMock = jest.fn()
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response

beforeEach(() => { fetchMock.mockReset(); global.fetch = fetchMock })
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers() })

it("reads without activation, with same-origin credentials and no cache", async () => {
  const controller = new AbortController()
  fetchMock.mockResolvedValue(response(eligible))
  await expect(getStartupTrial(siteId, controller)).resolves.toEqual(eligible)
  expect(fetchMock).toHaveBeenCalledWith(`/api/billing/startup-trial?site_id=${siteId}`, {
    method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
  })
})

it('preserves explicit offer validation while omitting private history details', async () => {
  fetchMock.mockResolvedValue(response({ ...eligible, offer_eligible: true, payment_history: ['private'] }))
  await expect(getStartupTrial(siteId, new AbortController())).resolves.toEqual({ ...eligible, offer_eligible: true })
})

it.each(["started", "already_started"])("activates with strict site-only JSON (%s)", async outcome => {
  fetchMock.mockResolvedValue(response({ ...active, outcome }))
  await expect(startStartupTrial(siteId, new AbortController())).resolves.toMatchObject({ state: "active", outcome })
  expect(fetchMock).toHaveBeenCalledWith("/api/billing/startup-trial", expect.objectContaining({
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site_id: siteId }),
    credentials: "same-origin", cache: "no-store",
  }))
})

it.each([
  {}, { success: false, error: { code: "UNAVAILABLE", message: "Private diagnostic" } },
  { ...eligible, state: "unknown" }, { ...eligible, credits_remaining: 50 },
  { ...active, ends_at: "2026-11-04T12:00:00.000Z" },
  { ...active, credits_remaining: 51 }, { ...active, credits_remaining: -1 },
  { ...active, server_now: active.ends_at }, { ...active, started_at: null },
  { ...eligible, server_now: "yesterday" },
])("fails closed for missing or invalid API/schema: %j", async body => {
  fetchMock.mockResolvedValue(response(body))
  await expect(getStartupTrial(siteId, new AbortController())).rejects.toThrow()
})

it("accepts unavailable with an optional reason without exposing it", async () => {
  fetchMock.mockResolvedValue(response({ ...eligible, state: "unavailable", reason: "Already paid" }))
  await expect(getStartupTrial(siteId, new AbortController())).resolves.toMatchObject({ state: "unavailable" })
})

it.each([undefined, "restarted"])("rejects an unconfirmed POST outcome %s", outcome => {
  expect(() => readStartupTrialActivation({ ...active, outcome })).toThrow()
})

it("rejects a successful POST that still reports eligible", () => {
  expect(() => readStartupTrialActivation({ ...eligible, outcome: "started" })).toThrow()
})

it("does not expose upstream messages or start automatically after an error", async () => {
  fetchMock.mockResolvedValue(response({ success: false, error: { code: "X", message: "Private database details" } }, false))
  await expect(startStartupTrial(siteId, new AbortController())).rejects.toThrow("Trial unavailable")
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each(["", "demo-site", "not-a-uuid"])("does not fetch invalid site %s", async invalid => {
  await expect(getStartupTrial(invalid, new AbortController())).rejects.toThrow()
  expect(fetchMock).not.toHaveBeenCalled()
})

it.each(["transport", "body"])("bounds a hanging %s even when fetch ignores abort", async stage => {
  jest.useFakeTimers()
  const never = new Promise<never>(() => {})
  fetchMock.mockReturnValue(stage === "transport" ? never : Promise.resolve({ ok: true, json: () => never }))
  const controller = new AbortController()
  const result = getStartupTrial(siteId, controller)
  const rejected = expect(result).rejects.toThrow("interrupted")
  await jest.advanceTimersByTimeAsync(STARTUP_TRIAL_REQUEST_TIMEOUT_MS)
  await rejected
  expect(controller.signal.aborted).toBe(true)
  expect(jest.getTimerCount()).toBe(0)
})

it("cancels immediately and cleans listeners/timers", async () => {
  jest.useFakeTimers()
  const controller = new AbortController()
  const remove = jest.spyOn(controller.signal, "removeEventListener")
  const result = waitForStartupTrial(() => new Promise<never>(() => {}), controller, 15_000)
  const rejected = expect(result).rejects.toThrow("interrupted")
  controller.abort()
  await rejected
  expect(remove).toHaveBeenCalledWith("abort", expect.any(Function))
  expect(jest.getTimerCount()).toBe(0)
})

it("never executes an already aborted request", async () => {
  const controller = new AbortController()
  controller.abort()
  await expect(getStartupTrial(siteId, controller)).rejects.toThrow("interrupted")
  expect(fetchMock).not.toHaveBeenCalled()
})