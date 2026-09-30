import { fetchSessionEvents } from "@/app/components/dashboard/traffic/session-events-data"

const fetchMock = fetch as jest.Mock
const key: [string, string] = ["/api/traffic/session-events-combined?siteId=site-a", "member"]
const payload = { chartData: [], referrersData: [], totals: { pageVisits: 0, uniqueVisitors: 0 } }
const busy = (retryAfter: string | null = "2") => ({ ok: false, status: 503, headers: { get: () => retryAfter } })

beforeEach(() => { jest.useFakeTimers(); fetchMock.mockReset() })
afterEach(() => { jest.useRealTimers() })

it("keeps the request pending through a server-directed cache refresh, then accepts success", async () => {
  fetchMock.mockResolvedValueOnce(busy()).mockResolvedValueOnce({ ok: true, status: 200, json: async () => payload })
  let settled = false
  const promise = fetchSessionEvents(key).then(value => { settled = true; return value })
  await jest.advanceTimersByTimeAsync(1999)
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(settled).toBe(false)
  await jest.advanceTimersByTimeAsync(1)
  expect(await promise).toEqual(payload)
  expect(fetchMock).toHaveBeenCalledTimes(2)
})

it("caps cache-busy retries instead of keeping an endless skeleton", async () => {
  fetchMock.mockResolvedValue(busy())
  const result = fetchSessionEvents(key).catch(error => error)
  await jest.advanceTimersByTimeAsync(6000)
  expect((await result).status).toBe(503)
  expect(fetchMock).toHaveBeenCalledTimes(4)
  expect(jest.getTimerCount()).toBe(0)
})

it.each([401, 403, 429, 500])("never automatically retries status %s", async status => {
  fetchMock.mockResolvedValue({ ...busy(), status })
  await expect(fetchSessionEvents(key)).rejects.toMatchObject({ status })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})

it.each([null, "bad", "-1", "3600"])("does not accept an unbounded or invalid Retry-After: %s", async header => {
  fetchMock.mockResolvedValue(busy(header))
  await expect(fetchSessionEvents(key)).rejects.toMatchObject({ status: 503 })
  expect(fetchMock).toHaveBeenCalledTimes(1)
})