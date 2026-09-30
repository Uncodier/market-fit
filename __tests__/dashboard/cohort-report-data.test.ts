import { parseCohortReport } from "@/app/components/dashboard/cohort-report-data"

describe("cohort response contract", () => {
  it("preserves real zeroes and unobserved weeks as different values", () => {
    const data = parseCohortReport({ leadCohorts: [{ cohort: "2026-W36", size: 12, weeks: [100, 0, null] }] }, "leads")
    expect(data.leadCohorts[0]).toMatchObject({ size: 12, weeks: [100, 0, null] })
  })

  it.each([
    {}, { error: "failed", leadCohorts: [] },
    { leadCohorts: [{ cohort: "A", weeks: [100, NaN] }] },
    { leadCohorts: [{ cohort: "A", weeks: [100, -1] }] },
    { leadCohorts: [{ cohort: "A", weeks: [100, 101] }] },
    { leadCohorts: [{ cohort: "A", weeks: ["100"] }] },
    { leadCohorts: [{ cohort: "A", size: 0, weeks: [100] }] },
    { leadCohorts: [{ cohort: "A", weeks: [100] }, { cohort: "A", weeks: [100] }] },
  ])("rejects malformed or ambiguous cohort data instead of treating it as empty", payload => {
    expect(() => parseCohortReport(payload, "leads")).toThrow()
  })

  it("accepts empty results but requires both customer measures", () => {
    expect(parseCohortReport({ leadCohorts: [] }, "leads").leadCohorts).toEqual([])
    expect(() => parseCohortReport({ salesCohorts: [] }, "customers")).toThrow()
    expect(parseCohortReport({ salesCohorts: [], usageCohorts: [] }, "customers").salesCohorts).toEqual([])
  })

  it("allows additive metadata without exposing unrelated provider fields", () => {
    const data = parseCohortReport({ leadCohorts: [], metadata: {
      definition: "Recorded engagement", observationEnd: "2026-09-29", excludedAnonymousSales: 2, privateDebug: "not UI data",
    } }, "leads")
    expect(data.metadata).toEqual({ definition: "Recorded engagement", observationEnd: "2026-09-29", excludedAnonymousSales: 2 })
  })
})