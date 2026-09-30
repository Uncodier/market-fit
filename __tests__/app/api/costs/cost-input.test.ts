import { costReportInput } from "@/app/api/costs/cost-input"
const SITE = "00000000-0000-4000-8000-000000000001"
const period = (startDate: string, endDate = startDate) => costReportInput(new URLSearchParams({ siteId: SITE, startDate, endDate }))

it.each([
  ["2026-08-31", "2026-08-31", 1, "2026-08-30", "2026-08-30", "2026-09-01"],
  ["2026-08-01", "2026-08-02", 2, "2026-07-30", "2026-07-31", "2026-08-03"],
  ["2024-02-01", "2024-02-29", 29, "2024-01-03", "2024-01-31", "2024-03-01"],
  ["2026-12-31", "2026-12-31", 1, "2026-12-30", "2026-12-30", "2027-01-01"],
  ["2026-03-07", "2026-03-09", 3, "2026-03-04", "2026-03-06", "2026-03-10"],
])("computes inclusive calendar periods from %s through %s", (start, end, days, previousStart, previousEnd, endExclusive) => {
  expect(period(start, end)).toMatchObject({ days, previousStart, previousEnd, endExclusive })
})

it("preserves calendar dates from legacy ISO timestamps independently of the server timezone", () => {
  expect(period("2026-08-31T00:00:00+14:00", "2026-08-31T23:59:59.999-07:00")).toMatchObject({
    start: "2026-08-31", end: "2026-08-31", days: 1, endExclusive: "2026-09-01",
  })
})

it("keeps optional date defaults with an equal 31-day previous period", () => {
  expect(costReportInput(new URLSearchParams({ siteId: SITE }), new Date("2026-08-31T12:30:00Z"))).toMatchObject({
    start: "2026-08-01", end: "2026-08-31", days: 31, previousStart: "2026-07-01", previousEnd: "2026-07-31",
  })
})