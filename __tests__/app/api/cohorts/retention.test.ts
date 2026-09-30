/** @jest-environment node */
import { cohortBaselines, retentionRows } from "@/app/api/cohorts/lib/retention"
import { isoWeekLabel, mondayUtc, prepareCohortRequest } from "@/app/api/cohorts/lib/period"

const window = {
  startDate: "2020-12-28T00:00:00.000Z",
  endDate: "2021-01-24T23:59:59.999Z",
  observationEnd: "2021-01-24T23:59:59.999Z",
}
const events = [
  { leadId: "a", at: "2021-01-05T01:00:00Z" },
  { leadId: "a", at: "2020-12-30T01:00:00Z" },
  { leadId: "b", at: "2021-01-03T23:59:59Z" },
  { leadId: "c", at: "2021-01-04T00:00:00Z" },
]

describe("real cohort retention", () => {
  it("anchors historical ISO weeks to data, including week-year rollover", () => {
    const rows = retentionRows(events, events, window)
    expect(rows).toEqual([
      { cohort: "W01 2021", cohortStart: "2021-01-04T00:00:00.000Z", size: 1, weeks: [100, 0, 0, null] },
      { cohort: "W53 2020", cohortStart: "2020-12-28T00:00:00.000Z", size: 2, weeks: [100, 50, 0, 0] },
    ])
    expect(cohortBaselines(events, window)).toHaveLength(3)
    expect(retentionRows([...events].reverse(), events, window)).toEqual(rows)
  })

  it("counts a member once per week and excludes nonmembers and pre-acquisition activity", () => {
    const activity = [
      { leadId: "a", at: "2021-01-05T00:00:00Z" },
      { leadId: "a", at: "2021-01-06T00:00:00Z" },
      { leadId: "outsider", at: "2021-01-07T00:00:00Z" },
      { leadId: "c", at: "2020-12-29T00:00:00Z" },
    ]
    expect(retentionRows(events, activity, window)[1].weeks).toEqual([100, 50, 0, 0])
  })

  it("has null incomplete/future weeks even when activity was recorded in the partial week", () => {
    const partial = { ...window, observationEnd: "2021-01-06T12:00:00.000Z" }
    expect(retentionRows(events, events, partial)[1].weeks).toEqual([100, null, null, null])
    expect(retentionRows(events, null, window)[1].weeks).toEqual([100, null, null, null])
    expect(retentionRows([], [], window)).toEqual([])
  })

  it("bounds baselines to the selected instants instead of calendar weeks or now", () => {
    const narrow = { ...window, startDate: "2021-01-01T00:00:00.000Z", observationEnd: "2021-01-04T12:00:00.000Z" }
    const rows = retentionRows(events, events, narrow)
    expect(rows.map(row => row.size)).toEqual([1, 1])
    expect(rows[1].cohortStart).toBe("2020-12-28T00:00:00.000Z")
  })

  it("uses UTC Monday regardless of event offset or DST", () => {
    expect(new Date(mondayUtc("2025-03-09T23:30:00-05:00")).toISOString()).toBe("2025-03-10T00:00:00.000Z")
    expect(isoWeekLabel(mondayUtc("2024-12-31T00:00:00Z"))).toBe("W01 2025")
  })
})

describe("cohort input and observation boundaries", () => {
  const siteId = "00000000-0000-4000-8000-000000000001"
  const prepare = (extra: Record<string, string>) => prepareCohortRequest(new Request(`http://localhost/api/cohorts?${new URLSearchParams({ siteId, ...extra })}`), new Date("2025-04-01T12:00:00Z"))

  it("includes date-only end days but preserves exact timestamp boundaries", () => {
    expect(prepare({ startDate: "2025-01-01", endDate: "2025-01-07" }).scope).toMatchObject({
      startDate: "2025-01-01T00:00:00.000Z", endDate: "2025-01-07T23:59:59.999Z",
      observationEnd: "2025-01-07T23:59:59.999Z",
    })
    expect(prepare({ startDate: "2025-04-01T01:00:00Z", endDate: "2025-04-08T01:00:00Z" }).scope.observationEnd).toBe("2025-04-01T12:00:00.000Z")
  })

  it("accepts 93 days, rejects excessive ranges and impossible dates", () => {
    expect(() => prepare({ startDate: "2025-01-01", endDate: "2025-04-03" })).not.toThrow()
    const invalid: Record<string, string>[] = [
      { startDate: "2025-01-01", endDate: "2025-04-04" },
      { startDate: "2025-02-30", endDate: "2025-03-10" },
      { startDate: "2025-02-02", endDate: "2025-02-01" },
      { siteId: "foreign-or-demo-site" },
      { segmentId: "bad" },
      { endDate: "" },
    ]
    for (const extra of invalid) expect(() => prepare(extra)).toThrow()
  })

  it("does not hard-truncate the selected period to eight weeks", () => {
    const { scope } = prepare({ startDate: "2025-01-01", endDate: "2025-04-03" })
    const rows = retentionRows([{ leadId: "a", at: scope.startDate }], [], scope)
    expect(rows[0].weeks.length).toBe(14)
  })
})