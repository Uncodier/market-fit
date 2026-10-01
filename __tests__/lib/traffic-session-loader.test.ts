/** @jest-environment node */

import {
  ENTRY_FIELDS, loadTrafficSessions, MAX_TRAFFIC_SESSIONS, TrafficSessionLimitError,
} from "@/lib/traffic/session-loader"
import { trafficDatabase, sessionId, scope } from "../api/traffic-database-fixture"

describe("complete traffic session loader", () => {
  it.each([2, 317, 1000])("continues every short page until empty (server cap %s)", async cap => {
    const rows = Array.from({ length: 1203 }, (_, i) => ({ id: sessionId(i + 1) }))
    const db = trafficDatabase(rows, { cap })
    expect(await loadTrafficSessions(db.client, scope, ENTRY_FIELDS)).toEqual(rows)
    expect(db.queries).toHaveLength(Math.ceil(rows.length / cap) + 1)
    for (const [index, query] of db.queries.entries()) {
      expect(query.order).toHaveBeenCalledWith("id", { ascending: true })
      expect(query.eq).toHaveBeenCalledWith("site_id", scope.siteId)
      expect(query.gte).toHaveBeenCalledWith("created_at", scope.startDate.toISOString())
      expect(query.lte).toHaveBeenCalledWith("created_at", scope.endDate.toISOString())
      if (index > 0) expect(query.gt).toHaveBeenCalledWith("id", rows[Math.min(index * cap, rows.length) - 1].id)
    }
  })

  it("uses id instead of mutable activity/timestamps and scopes every page", async () => {
    const rows = [
      { id: sessionId(5), created_at: scope.startDate.toISOString() },
      { id: sessionId(1), created_at: scope.endDate.toISOString() },
      { id: sessionId(2), site_id: "other-site" },
      { id: sessionId(3), created_at: "2026-08-31T23:59:59.999Z" },
      { id: sessionId(4), created_at: "2026-09-30T00:00:00.000Z" },
    ]
    const db = trafficDatabase(rows, { cap: 1 })
    expect((await loadTrafficSessions(db.client, scope, "device")).map(row => row.id))
      .toEqual([sessionId(1), sessionId(5)])
    expect(db.queries[1].gt).toHaveBeenCalledWith("id", sessionId(1))
  })

  it("scopes nullable to-one joins without filtering visitors on a nonexistent site_id", async () => {
    const db = trafficDatabase([{ id: sessionId(1) }])
    await loadTrafficSessions(db.client, scope, ENTRY_FIELDS, true)
    const query = db.queries[0]
    const fields = query.select.mock.calls[0][0] as string
    expect(fields).toContain("lead:leads!visitor_sessions_lead_id_fkey")
    expect(fields).toContain("segment:segments!leads_segment_id_fkey")
    expect(fields).toContain("segment:segments!visitors_segment_id_fkey")
    expect(fields).not.toContain("!inner")
    expect(fields).not.toContain("campaign_id")
    expect(query.eq).toHaveBeenCalledWith("lead.site_id", scope.siteId)
    expect(query.eq).toHaveBeenCalledWith("lead.segment.site_id", scope.siteId)
    expect(query.eq).toHaveBeenCalledWith("visitor.segment.site_id", scope.siteId)
    expect(query.eq).not.toHaveBeenCalledWith("visitor.site_id", expect.anything())
    expect(db.from).toHaveBeenCalledTimes(2)
    expect(db.from).toHaveBeenCalledWith("visitor_sessions")
  })

  it("accepts exactly 50k only after an empty lookahead and rejects 50k+1 explicitly", async () => {
    const rows = Array.from({ length: MAX_TRAFFIC_SESSIONS }, (_, i) => ({ id: sessionId(i + 1) }))
    const db = trafficDatabase(rows)
    expect(await loadTrafficSessions(db.client, scope, "device")).toHaveLength(MAX_TRAFFIC_SESSIONS)
    expect(db.queries).toHaveLength(51)
    expect(db.queries[50].limit).toHaveBeenCalledWith(1)

    rows.push({ id: sessionId(MAX_TRAFFIC_SESSIONS + 1) })
    await expect(loadTrafficSessions(trafficDatabase(rows).client, scope, "device"))
      .rejects.toBeInstanceOf(TrafficSessionLimitError)
  })

  it.each([{ errorAt: 1 }, { nullAt: 1 }])("fails rather than returning earlier pages on %j", async options => {
    const db = trafficDatabase([{ id: sessionId(1) }, { id: sessionId(2) }], { cap: 1, ...options })
    await expect(loadTrafficSessions(db.client, scope, "device")).rejects.toThrow("Unable to load traffic sessions")
  })

  it("rejects repeated/nonadvancing ids rather than looping or counting twice", async () => {
    const db = trafficDatabase([{ id: sessionId(1) }, { id: sessionId(1) }])
    await expect(loadTrafficSessions(db.client, scope, "device")).rejects.toThrow("Invalid traffic session cursor")
  })
})