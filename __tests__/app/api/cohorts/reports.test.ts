/** @jest-environment node */
import { customerCohortReport, leadCohortReport } from "@/app/api/cohorts/lib/reports"
import { readCohortPages } from "@/app/api/cohorts/lib/queries"
import { CohortLimitError, CohortQueryError } from "@/app/api/cohorts/lib/types"
import { cohortTestClient } from "./cohort-test-client"

const scope = {
  siteId: "site-a", segmentId: "segment-a",
  startDate: "2025-01-06T00:00:00.000Z", endDate: "2025-02-02T23:59:59.999Z", observationEnd: "2025-02-02T23:59:59.999Z",
}
const sale = (id: string, lead: string | null, at: string, extra = {}) => ({ id, lead_id: lead, created_at: at, site_id: scope.siteId, segment_id: scope.segmentId, status: "completed", ...extra })
const lead = (id: string, at: string, extra = {}) => ({ id, created_at: at, site_id: scope.siteId, segment_id: scope.segmentId, ...extra })
const message = (id: string, leadId: string, at: string, extra = {}) => ({
  id, lead_id: leadId, created_at: at, role: "user", conversations: { site_id: scope.siteId, lead_id: leadId }, ...extra,
})

describe("cohort schema-backed report queries", () => {
  it("excludes anonymous, unconfirmed, out-of-window, foreign site and foreign segment sales", async () => {
    const { client, calls } = cohortTestClient({ sales: [
      sale("1", "a", "2025-01-07T00:00:00Z", { status: "pending" }),
      sale("2", "b", "2025-01-08T00:00:00Z"),
      sale("3", "a", "2025-01-14T00:00:00Z"),
      sale("4", null, "2025-01-09T00:00:00Z"),
      sale("5", null, "2025-01-15T00:00:00Z"),
      sale("6", "cancelled", "2025-01-07T00:00:00Z", { status: "cancelled" }),
      sale("7", "refunded", "2025-01-07T00:00:00Z", { status: "refunded" }),
      sale("8", "draft", "2025-01-07T00:00:00Z", { status: "draft" }),
      sale("9", "foreign", "2025-01-07T00:00:00Z", { site_id: "site-b" }),
      sale("10", "foreign-segment", "2025-01-07T00:00:00Z", { segment_id: "segment-b" }),
      sale("11", "before", "2024-12-01T00:00:00Z"),
      sale("12", "after", "2025-02-03T00:00:00Z"),
    ] })
    const report = await customerCohortReport(client, scope)
    expect(report.salesCohorts).toEqual([{ cohort: "W02 2025", cohortStart: scope.startDate, size: 2, weeks: [100, 50, 0, 0] }])
    expect(report.usageCohorts[0].weeks).toEqual([100, 0, 0, 0])
    expect(report.metadata.excludedAnonymousSales).toBe(2)
    expect(report.metadata.definition).toContain("not lifetime-first")
    expect(calls.filter(call => call.table === "sales").every(call => call.orders.join() === "created_at,id")).toBe(true)
  })

  it("observes real user/visitor activity in existing conversations, deduplicates and rejects conflicting attribution", async () => {
    const { client, calls } = cohortTestClient({
      leads: [lead("a", "2025-01-07T00:00:00Z"), lead("b", "2025-01-08T00:00:00Z"), lead("other", "2025-01-08T00:00:00Z", { segment_id: "segment-b" })],
      messages: [
        message("1", "a", "2025-01-14T00:00:00Z"),
        message("2", "a", "2025-01-15T00:00:00Z"),
        message("3", "b", "2025-01-21T00:00:00Z", { role: "visitor", lead_id: null }),
        message("4", "b", "2025-01-14T00:00:00Z", { role: "assistant" }),
        message("5", "b", "2025-01-14T00:00:00Z", { role: "team_member" }),
        message("6", "other", "2025-01-14T00:00:00Z"),
        message("7", "b", "2025-01-14T00:00:00Z", { conversations: { site_id: "site-b", lead_id: "b" } }),
        message("8", "b", "2025-01-14T00:00:00Z", { lead_id: "conflicting" }),
        message("9", "b", "2025-02-03T00:00:00Z"),
      ],
    })
    const report = await leadCohortReport(client, scope)
    expect(report.leadCohorts[0]).toMatchObject({ size: 2, weeks: [100, 50, 50, 0] })
    expect(report.metadata.activityAvailable).toBe(true)
    expect(calls.filter(call => call.table === "messages").every(call =>
      call.filters.some(filter => filter.column === "conversations.site_id" && filter.value === "site-a"))).toBe(true)
  })

  it("reads more than 100 sales and continues after server-shortened pages", async () => {
    const sales = Array.from({ length: 125 }, (_, i) => sale(String(i).padStart(3, "0"), `lead-${i}`, "2025-01-07T00:00:00Z"))
    const { client, calls } = cohortTestClient({ sales }, { pageSize: 50 })
    const report = await customerCohortReport(client, scope)
    expect(report.salesCohorts[0].size).toBe(125)
    expect(calls.filter(call => call.table === "sales").map(call => call.from)).toEqual([0, 50, 100, 125])
    expect(calls.filter(call => call.table === "messages")).toHaveLength(2)
  })

  it("reports unavailable schema as null activity with a reason, without copying sales retention", async () => {
    const { client } = cohortTestClient({ sales: [sale("1", "a", "2025-01-07T00:00:00Z"), sale("2", "a", "2025-01-14T00:00:00Z")] }, { errors: { messages: "42P01" } })
    const report = await customerCohortReport(client, scope)
    expect(report.salesCohorts[0].weeks).toEqual([100, 100, 0, 0])
    expect(report.usageCohorts[0].weeks).toEqual([100, null, null, null])
    expect(report.metadata).toMatchObject({ activityAvailable: false, activityUnavailableReason: expect.stringContaining("unavailable") })
  })

  it("fails rather than fabricating retention on permission/transient query failures", async () => {
    for (const code of ["42501", "57014", "XX000"]) {
      const { client } = cohortTestClient({ leads: [lead("a", "2025-01-07T00:00:00Z")] }, { errors: { messages: code } })
      await expect(leadCohortReport(client, scope)).rejects.toBeInstanceOf(CohortQueryError)
    }
  })

  it("returns truthful empty cohorts and metadata when no matching baseline exists", async () => {
    const { client } = cohortTestClient({ leads: [lead("old", "2024-01-07T00:00:00Z")] })
    expect(await leadCohortReport(client, scope)).toMatchObject({ leadCohorts: [], metadata: { startDate: scope.startDate } })
  })
})

describe("bounded cohort pagination", () => {
  it("probes beyond the cap instead of returning a partial report", async () => {
    const rows = [{ id: "1" }, { id: "2" }, { id: "3" }]
    const page = jest.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }))
    await expect(readCohortPages(page, 2)).rejects.toBeInstanceOf(CohortLimitError)
    await expect(readCohortPages(page, 3)).resolves.toEqual(rows)
    expect(page).toHaveBeenCalledWith(3, 3)
  })

  it("rejects nonadvancing pages and errors after a successful first page", async () => {
    await expect(readCohortPages(async () => ({ data: [{ id: "1" }], error: null }), 10)).rejects.toBeInstanceOf(CohortQueryError)
    const page = jest.fn().mockResolvedValueOnce({ data: [{ id: "1" }], error: null }).mockResolvedValueOnce({ data: null, error: { code: "timeout" } })
    await expect(readCohortPages(page)).rejects.toBeInstanceOf(CohortQueryError)
  })
})