import { distributionData, distributionTotal, fetchReport, reportPeriod, reportQueryKey } from "@/app/components/dashboard/report-query"

it("uses stable inclusive calendar boundaries without mutating selected dates", () => {
  const start = new Date(2026, 8, 1, 14, 35)
  const end = new Date(2026, 8, 29, 9, 42)
  const period = reportPeriod(start, end)!
  expect(period.startDate.getHours()).toBe(0)
  expect(period.endDate.getHours()).toBe(23)
  expect(period.endDate.getMilliseconds()).toBe(999)
  expect(start.getHours()).toBe(14)
  expect(end.getHours()).toBe(9)
  expect(reportPeriod(new Date("invalid"), end)).toBeNull()
  expect(reportPeriod(end, start)).toBeNull()
})

it("gates incomplete auth and keeps identity out of the request URL", () => {
  const input = { endpoint: "traffic/pages", siteId: "site-a", period: reportPeriod(), userId: "user-a" }
  const key = reportQueryKey(input)!
  expect(key[0]).not.toContain("user-a")
  expect(key[1]).toBe("user-a")
  expect(reportQueryKey({ ...input, enabled: false })).toBeNull()
  expect(reportQueryKey({ ...input, userId: undefined })).toBeNull()
  expect(reportQueryKey({ ...input, siteId: "default" })).toBeNull()
})

it("sums numeric values rather than concatenating them", () => {
  expect(distributionTotal(distributionData({ data: [{ name: "A", value: "3.5" }, { name: "B", value: 1.5 }] }))).toBe(5)
  for (const value of [null, -1, Infinity, "", "invalid"]) {
    expect(() => distributionData({ data: [{ name: "A", value }] })).toThrow("invalid response")
  }
})

it("distinguishes oversized traffic reports from unsupported segment filters without exposing server messages", async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: false, status: 422, json: async () => ({ code: "TRAFFIC_SESSION_LIMIT_EXCEEDED", error: "private detail" }) } as Response)
  await expect(fetchReport(["/api/traffic/attribution", "user-a"])).rejects.toThrow("Select a shorter date range")
  jest.mocked(fetch).mockResolvedValue({ ok: false, status: 422, json: async () => ({ error: "private detail" }) } as Response)
  await expect(fetchReport(["/api/traffic/attribution", "user-a"])).rejects.toThrow("Select all segments")
})