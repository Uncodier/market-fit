import { buildPerformanceSeries } from "@/lib/dashboard/performance-series"

const empty = { leads: [], conversations: [], engagement: [], tasks: [], meetings: [], sales: [] }
const date = (created_at: string) => ({ created_at })

describe("performance time series", () => {
  it("does not count a row in adjacent calendar buckets across UTC/site offsets", () => {
    const rows = buildPerformanceSeries({ ...empty,
      start: new Date("2026-09-01T00:00:00Z"), end: new Date("2026-09-02T23:59:59.999Z"),
      timeZone: "America/Los_Angeles",
      leads: [date("2026-09-01T04:00:00Z"), date("2026-09-01T20:00:00Z"), date("2026-09-02T20:00:00Z")],
    })
    expect(rows.map(row => [row.date, row.leadsCreated])).toEqual([
      ["2026-08-31", 1], ["2026-09-01", 1], ["2026-09-02", 1],
    ])
    expect(rows.reduce((sum, row) => sum + row.leadsCreated, 0)).toBe(3)
  })

  it("counts an engaged lead at most once each day across messages and conversations", () => {
    const rows = buildPerformanceSeries({ ...empty,
      start: new Date("2026-09-01T00:00:00Z"), end: new Date("2026-09-03T23:59:59.999Z"), timeZone: "UTC",
      engagement: [{ conversations: [
        { messages: [date("2026-09-01T10:00:00Z"), date("2026-09-01T11:00:00Z")] },
        { messages: [date("2026-09-01T12:00:00Z"), date("2026-09-02T10:00:00Z")] },
      ] }],
    })
    expect(rows.map(row => row.engagement)).toEqual([1, 1, 0])
  })

  it("keeps daylight-saving calendar days and ignores out-of-range or invalid rows", () => {
    const rows = buildPerformanceSeries({ ...empty,
      start: new Date("2026-03-07T05:00:00Z"), end: new Date("2026-03-10T03:59:59Z"), timeZone: "America/New_York",
      sales: [date("2026-03-08T06:59:59Z"), date("2026-03-08T07:00:00Z"), date("2026-03-11T00:00:00Z"), date("invalid")],
      meetings: [{ scheduled_date: "2026-03-09T12:00:00Z" }],
    })
    expect(rows.map(row => row.date)).toEqual(["2026-03-07", "2026-03-08", "2026-03-09"])
    expect(rows.map(row => row.sales)).toEqual([0, 2, 0])
    expect(rows.map(row => row.meetings)).toEqual([0, 0, 1])
  })
})