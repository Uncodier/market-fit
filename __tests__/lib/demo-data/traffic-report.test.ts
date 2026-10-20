import { availableDemos, getDemoData } from "@/lib/demo-data"
import { attachDemoTraffic } from "@/lib/demo-data/traffic-seed"
import { buildDemoSessionEvents, loadDemoTrafficReport } from "@/lib/demo-data/traffic-report"
import { demoReportContext } from "@/lib/demo-data/report-context"
import { distributionData } from "@/app/components/dashboard/report-query"
import { parseTrafficAttribution } from "@/app/components/dashboard/traffic/attribution-data"
import { parseSessionEvents } from "@/app/components/dashboard/traffic/session-events-data"
import { shiftDay } from "@/lib/sales/report-period"

const end = new Date().toISOString().slice(0, 10)
const start = shiftDay(end, -29)
const params = (siteId: string, extra: Record<string, string> = {}) => new URLSearchParams({
  siteId, startDate: start, endDate: end, segmentId: "all", ...extra,
})
const fetchMock = jest.mocked(fetch)
beforeEach(() => fetchMock.mockReset())

describe.each(availableDemos)("local Traffic records: $id", ({ id }) => {
  it("seeds linked sessions, repeated visitors and pageviews in current and previous periods without mutation", async () => {
    const data = await getDemoData(id)
    expect(data).not.toBeNull()
    const context = await demoReportContext(params(id))
    const sessions = context.rows("visitor_sessions")
    const visitors = new Map(context.rows("visitors").map(row => [row.id, row]))
    const sessionIds = new Set(sessions.map(row => row.id))
    expect(sessions.some(row => context.inRange(row.created_at))).toBe(true)
    expect(sessions.some(row => context.inRange(row.created_at, true))).toBe(true)
    for (const row of sessions) {
      expect(visitors.has(String(row.visitor_id))).toBe(true)
      if (row.lead_id) expect(context.leadMap.has(row.lead_id)).toBe(true)
      if (row.campaign_id) expect(context.rows("campaigns").some(campaign => campaign.id === row.campaign_id)).toBe(true)
    }
    for (const event of context.rows("session_events")) {
      expect(sessionIds.has(String(event.session_id))).toBe(true)
      expect(visitors.has(String(event.visitor_id))).toBe(true)
    }
    const input = { sites: context.data.sites, segments: context.data.segments, leads: context.data.leads,
      campaigns: context.data.campaigns, visitors: [], visitor_sessions: [], session_events: [] }
    const now = new Date("2026-10-20T12:00:00Z")
    const first = attachDemoTraffic(input, now)
    expect(attachDemoTraffic(first, now)).toEqual(first)
    expect(input.visitor_sessions).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("calculates all metrics from records with equal, non-overlapping current/prior dates", async () => {
    const context = await demoReportContext(params(id))
    const current = context.rows("visitor_sessions").filter(row => context.inRange(row.created_at))
    const previous = context.rows("visitor_sessions").filter(row => context.inRange(row.created_at, true))
    const visits = await loadDemoTrafficReport("traffic/visits", params(id))
    expect(visits).toMatchObject({ actual: current.length, previous: previous.length, periodType: "custom" })
    expect(current.every(row => !previous.includes(row))).toBe(true)
    for (const endpoint of ["session-time", "lead-conversion", "client-conversion"]) {
      expect(await loadDemoTrafficReport(`traffic/${endpoint}`, params(id))).toEqual(expect.objectContaining({
        actual: expect.any(Number), previous: expect.any(Number), periodType: "custom",
      }))
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("adapts attribution and all distribution dimensions with full missing-data coverage", async () => {
    const context = await demoReportContext(params(id))
    const count = context.rows("visitor_sessions").filter(row => context.inRange(row.created_at)).length
    const attribution = parseTrafficAttribution(await loadDemoTrafficReport("/api/traffic/attribution", params(id)))
    expect(attribution.coverage.totalSessions).toBe(count)
    expect(attribution.segments.some(row => row.name === "Unassigned segment")).toBe(true)
    expect(attribution.campaigns.some(row => row.name === "No campaign")).toBe(true)
    for (const endpoint of ["referrals", "devices", "browsers", "regions", "traffic-by-segment", "traffic-by-campaign"]) {
      const path = endpoint.startsWith("traffic-by-") ? endpoint : `traffic/${endpoint}`
      const rows = distributionData(await loadDemoTrafficReport(path, params(id)))
      expect(rows.reduce((sum, row) => sum + row.value, 0)).toBe(count)
    }
    const pages = distributionData(await loadDemoTrafficReport("traffic/pages", params(id)))
    expect(pages.reduce((sum, row) => sum + row.value, 0)).toBe(count * 2)
    expect(distributionData(await loadDemoTrafficReport("segments/distribution", params(id, { metric: "sessions" }))))
      .toEqual(attribution.segments)
    expect(distributionData(await loadDemoTrafficReport("campaigns/distribution", params(id, { metric: "sessions" }))))
      .toEqual(attribution.campaigns)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("counts pageviews, deduplicates visitors across days, and excludes internal referrals", async () => {
    const context = await demoReportContext(params(id))
    const events = context.rows("session_events").filter(row => row.event_type === "pageview" && context.inRange(row.created_at))
    const report = parseSessionEvents(await loadDemoTrafficReport("traffic/session-events-combined", params(id)))
    expect(report.chartData).toHaveLength(30)
    expect(report.totals.pageVisits).toBe(events.length)
    expect(report.totals.uniqueVisitors).toBe(new Set(events.map(row => row.visitor_id)).size)
    expect(report.chartData.reduce((sum, row) => sum + row.pageVisits, 0)).toBe(events.length)
    expect(report.totals.referralVisits).toBeGreaterThan(0)
    expect(report.totals.referralVisits).toBeLessThan(report.totals.pageVisits)
    expect(report.referrersData.map(row => row.referrer)).toEqual(expect.arrayContaining(["google.com", "linkedin.com", "Direct"]))
    expect(report.referrersData.some(row => row.fullUrl.includes("/account"))).toBe(false)
    expect(await loadDemoTrafficReport("traffic/session-events", params(id))).toMatchObject({ data: expect.any(Array) })
    expect(await loadDemoTrafficReport("traffic/session-events-referrers", params(id))).toMatchObject({ data: expect.any(Array) })
    expect(buildDemoSessionEvents(context, 1).referrersData).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("keeps empty dates empty and rejects unsupported segment filters rather than fabricating data", async () => {
    const empty = params(id, { startDate: "2000-01-01", endDate: "2000-01-30" })
    expect(await loadDemoTrafficReport("traffic/visits", empty)).toMatchObject({ actual: 0, previous: 0, percentChange: 0 })
    expect(distributionData(await loadDemoTrafficReport("traffic/devices", empty))).toEqual([])
    const report = parseSessionEvents(await loadDemoTrafficReport("traffic/session-events-combined", empty))
    expect(report.totals).toEqual({ pageVisits: 0, uniqueVisitors: 0, referralVisits: 0 })
    expect(report.chartData.every(row => row.pageVisits === 0)).toBe(true)
    expect(report.referrersData).toEqual([])
    for (const endpoint of ["visits", "attribution", "devices", "session-events-combined"]) {
      await expect(loadDemoTrafficReport(`traffic/${endpoint}`, params(id, { segmentId: "unknown-segment" }))).rejects.toThrow("all segments")
    }
    await expect(loadDemoTrafficReport("traffic/visits", params(id, { startDate: "2026-02-30" }))).rejects.toThrow()
    await expect(loadDemoTrafficReport("traffic/session-events-combined", params(id, { referrersLimit: "0" }))).rejects.toThrow("limit")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

it.each(["demo-unknown", "real-site-id", "", "demo-saas-en-123-extra"])("never selects local fixtures for %s", async id => {
  expect(await loadDemoTrafficReport("traffic/visits", params(id))).toBeNull()
  expect(fetchMock).not.toHaveBeenCalled()
})

it("does not claim unsupported endpoints or non-session distribution metrics", async () => {
  expect(await loadDemoTrafficReport("traffic/unknown", params(availableDemos[0].id))).toBeNull()
  expect(await loadDemoTrafficReport("segments/distribution", params(availableDemos[0].id, { metric: "revenue" }))).toBeNull()
})