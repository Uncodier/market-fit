import { NextRequest, NextResponse } from "next/server"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { createServiceClient } from "@/lib/supabase/server"
import { readThroughAnalyticsResponseCache } from "@/lib/redis/analytics-response-cache"
import { buildAttribution } from "@/lib/traffic/attribution"
import { ENTRY_FIELDS, loadTrafficSessions } from "@/lib/traffic/session-loader"
import { rejectTrafficSegmentFilter, trafficReportError } from "@/lib/traffic/report-response"

export async function GET(request: NextRequest) {
  const access = await requireAnalyticsAccess(request)
  if (access.error) return access.error
  const segmentError = rejectTrafficSegmentFilter(request)
  if (segmentError) return segmentError

  return readThroughAnalyticsResponseCache({
    request,
    namespace: "traffic:attribution:v1",
    siteId: access.siteId,
    lockTtlMs: 30_000,
    load: async () => {
      try {
        const database = await createServiceClient(true)
        const sessions = await loadTrafficSessions(database, access, ENTRY_FIELDS, true)
        return NextResponse.json(buildAttribution(sessions, access.siteId))
      } catch (error) {
        return trafficReportError(error, "attribution")
      }
    },
  })
}