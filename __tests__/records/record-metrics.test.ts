import { metricNumber, metricDate, metricSeries, metricComparison, savedMetricRecords } from "@/app/records/[id]/components/record-metrics"
import { insightRecord } from "./insights-test-fixtures"

describe("generic record measurements", () => {
  it.each([null, undefined, "", " ", "bad", true, [], {}, Infinity, NaN, "Infinity", "1,200", "0x10"])(
    "does not turn %p into zero", value => expect(metricNumber(value)).toBeNull(),
  )
  it.each([[0, 0], ["0", 0], ["-2.5", -2.5], ["1e3", 1000], [0.000001, 0.000001]])(
    "preserves valid number %p", (input, expected) => expect(metricNumber(input)).toBe(expected),
  )
  it("keeps date-only values on their calendar day and rejects invalid dates", () => {
    expect(new Date(metricDate("2026-01-03")!).getDate()).toBe(3)
    expect(metricDate("2026-02-30")).toBeNull()
    expect(metricDate(null)).toBeNull()
  })
  it("uses selected dates without substituting creation dates for missing measurements", () => {
    const records = [
      insightRecord({ id: "first", data: { Date: "2026-02-01", Count: 0 } }),
      insightRecord({ id: "second", data: { Date: "2026-01-01", Count: null } }),
      insightRecord({ id: "undated", data: { Count: 20 } }),
    ]
    const result = metricSeries(records, "Count", "Date")
    expect(result.omittedDates).toBe(1)
    expect(result.points.map(point => [point.id, point.value])).toEqual([["second", null], ["first", 0]])
  })
  it("counts fallback dates separately from observations with no usable date", () => {
    const records = [
      insightRecord({ id: "primary", created_at: "invalid", data: { Day: "2026-01-01", Count: 1 } }),
      insightRecord({ id: "created", data: { Day: "2026-02-30", Count: 2 } }),
      insightRecord({ id: "omitted", created_at: "invalid", data: { Count: 3 } }),
    ]
    const result = metricSeries(records, "Count", "Day", true)
    expect(result.points.map(point => point.id)).toEqual(["primary", "created"])
    expect(result).toMatchObject({ fallbackDates: 1, omittedDates: 1 })
  })
  it("compares an older open record with its predecessor, not a later observation", () => {
    const points = [0, -5, 10].map((value, i) => ({ id: String(i), title: "Measurement", timestamp: i + 1, value }))
    expect(metricComparison(points, "1")).toMatchObject({ delta: -5, previous: { id: "0" } })
    expect(metricComparison(points, "0")).toBeNull()
    expect(metricComparison([{ ...points[0], value: null }, points[1]], "1")).toBeNull()
    expect(metricComparison([points[0], { ...points[0], id: "duplicate" }, points[1]], "1")).toBeNull()
  })
  it("deduplicates the saved snapshot and excludes foreign collections and tenants", () => {
    const current = insightRecord({ data: { Count: 4 }, relations: { Subject: "one" } })
    const result = savedMetricRecords([
      insightRecord({ data: { Count: 3 } }),
      insightRecord({ id: "foreign-site", site_id: "other" }),
      insightRecord({ id: "foreign-category", category_id: "other" }),
    ], current, "Subject", "one")
    expect(result).toEqual([current])
    expect(savedMetricRecords([], current, "Subject", "unsaved-subject")).toEqual([])
  })
  it("keeps metric names separate from point metadata", () => {
    expect(metricSeries([insightRecord({ data: { timestamp: 25 } })], "timestamp").points[0]).toMatchObject({ value: 25 })
  })
})