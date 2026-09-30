import { defaultReportRange, reportRangeError } from "@/app/dashboard/report-range"
import { analyticsMaxRangeDays, reportDateLimits } from "@/lib/dashboard/report-date-limits"

it("uses an inclusive 30-day default and preserves valid historical ranges without a two-year cutoff", () => {
  const range = defaultReportRange(new Date(2026, 8, 29))
  expect(range.startDate).toEqual(new Date(2026, 7, 31))
  expect(reportRangeError(range.startDate, range.endDate, 30)).toBeNull()
  const historical = { start: new Date(2020, 0, 1), end: new Date(2020, 0, 20) }
  expect(reportRangeError(historical.start, historical.end, 30)).toBeNull()
  expect(historical.start.getFullYear()).toBe(2020)
})

it("reports unsupported, invalid and reversed dates instead of replacing them", () => {
  expect(reportRangeError(new Date(2000, 0, 1), new Date(2026, 8, 29), 93)).toContain("up to 93 days")
  expect(reportRangeError(new Date(NaN), new Date(), 93)).toBe("Select a valid date range.")
  expect(reportRangeError(new Date(2026, 8, 29), new Date(2026, 8, 1), 93)).toBe("Select a valid date range.")
})

it("uses server-configured analytics limits without weakening stricter section constraints", () => {
  expect(analyticsMaxRangeDays("30")).toBe(30)
  expect(analyticsMaxRangeDays("invalid")).toBe(93)
  const limits = reportDateLimits(30)
  expect(limits.overview.economics).toBe(30)
  expect(limits.sales.channels).toBe(30)
  expect(limits.costs.summary).toBe(30)
  expect(limits.costs.categories).toBe(366)
  expect(limits.analytics.customers).toBe(30)
  expect(reportDateLimits(366).analytics.customers).toBe(93)
  expect(limits.social.summary).toBe(366)
})