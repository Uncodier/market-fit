import { NextRequest, NextResponse } from "next/server"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { createServiceClient } from "@/lib/supabase/server"
import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache"
import { buildBreakdown } from "@/lib/traffic/breakdowns"
import { loadTrafficSessions } from "@/lib/traffic/session-loader"
import { rejectTrafficSegmentFilter, trafficReportError } from "@/lib/traffic/report-response"

export async function GET(request: NextRequest) {
  const access = await requireAnalyticsAccess(request)
  if (access.error) return access.error
  const segmentError = rejectTrafficSegmentFilter(request)
  if (segmentError) return segmentError

  return readThroughAnalyticsResponseCache({
    request,
    namespace: "traffic:pages:v3",
    siteId: access.siteId,
    lockTtlMs: 30_000,
    load: async () => {
      try {
        const database = await createServiceClient(true)
        const sessions = await loadTrafficSessions(database, access, "landing_url,current_url,custom_data")
        return NextResponse.json({ data: buildBreakdown(sessions, "pages") })
      } catch (error) {
        return trafficReportError(error, "pages")
      }
    },
  })
}