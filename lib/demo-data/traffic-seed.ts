import type { DemoReportRow } from "./report-types"

/** Recorded sessions and pageviews, not precomputed report responses. */
export function attachDemoTraffic(input: Record<string, unknown>, now = new Date()) {
  const data = input as Record<string, DemoReportRow[]>
  const site = data.sites?.[0]
  if (!site || !data.segments?.length) return data
  const prefix = `${site.id}-traffic-`
  const result = { ...data }
  for (const table of ["visitors", "visitor_sessions", "session_events"]) {
    result[table] = (data[table] || []).filter(row => !row.id.startsWith(prefix))
  }
  const origin = typeof site.url === "string" ? site.url.replace(/\/$/, "") : "https://sample.example.com"
  const stamp = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString()
  const devices = [
    { type: "desktop", os: { name: "Mac OS" } },
    { type: "mobile", os: { name: "iOS" } },
    { type: "tablet", os: { name: "iPadOS" } },
    {},
  ]
  const browsers = [{ name: "Chrome" }, { name: "Safari" }, { name: "Firefox" }, {}]
  const locations = [{ country: "US" }, { country: "ES" }, { country: "MX" }, {}]
  data.segments.forEach((segment, segmentIndex) => {
    const leads = (data.leads || []).filter(row => row.site_id === site.id && row.segment_id === segment.id)
    const campaign = (data.campaigns || []).find(row => row.site_id === site.id && row.segment_id === segment.id)
    for (let visitorIndex = 0; visitorIndex < 4; visitorIndex++) {
      result.visitors.push({
        id: `${prefix}visitor-${segmentIndex}-${visitorIndex}`, site_id: site.id,
        segment_id: visitorIndex === 3 ? undefined : segment.id,
        lead_id: visitorIndex < 2 ? leads[visitorIndex]?.id : undefined,
        created_at: stamp(60), updated_at: stamp(0),
      })
    }
    for (const [index, daysAgo] of [0, 1, 3, 6, 10, 15, 22, 29, 32, 36, 43, 50, 57, 60].entries()) {
      // Current/prior windows contain repeated visitors, missing metadata, and untagged entry traffic.
      const count = daysAgo < 30 ? 4 : 3
      for (let visit = 0; visit < count; visit++) {
        const variant = (index + visit) % 4
        const id = `${prefix}session-${segmentIndex}-${index}-${visit}`
        const visitorId = `${prefix}visitor-${segmentIndex}-${variant}`
        const visitor = result.visitors.find(row => row.id === visitorId)!
        const created = stamp(daysAgo)
        const started = Date.parse(created)
        const duration = 75 + segmentIndex * 20 + variant * 45 + (daysAgo < 30 ? 30 : 0)
        const referrer = ["https://www.google.com/search?q=sample", "https://www.linkedin.com/feed", "", `${origin}/account`][variant]
        const tagged = variant < 2
        const campaignName = tagged ? campaign?.title || `${segment.name} launch` : undefined
        const landing = `${origin}/${["", "pricing", "products", "contact"][variant]}`
        result.visitor_sessions.push({
          id, site_id: site.id, visitor_id: visitorId, lead_id: visitor.lead_id,
          segment_id: visitor.segment_id, campaign_id: tagged ? campaign?.id : undefined,
          created_at: created, updated_at: created, started_at: started,
          last_activity_at: started + duration * 1000, duration,
          referrer, landing_url: landing, current_url: `${origin}/checkout`,
          utm_source: tagged ? ["google", "linkedin"][variant] : undefined,
          utm_medium: tagged ? ["cpc", "social"][variant] : undefined,
          utm_campaign: campaignName, device: devices[variant], browser: browsers[variant], location: locations[variant],
        })
        for (let event = 0; event < 4; event++) {
          result.session_events.push({
            id: `${id}-event-${event}`, site_id: site.id, session_id: id, visitor_id: visitorId,
            lead_id: visitor.lead_id, segment_id: visitor.segment_id,
            event_type: event === 3 ? "click" : "pageview",
            created_at: new Date(Math.min(now.getTime(), started + event * 15_000)).toISOString(),
            referrer: event === 0 ? referrer : landing,
            page_url: event === 0 ? landing : `${origin}/checkout`,
          })
        }
      }
    }
  })
  return result
}