import { NextRequest } from "next/server"
import { GET as revenue } from "@/app/api/revenue/route"
import { GET as ltv } from "@/app/api/ltv/route"
import { GET as cac } from "@/app/api/cac/route"
import { GET as cpl } from "@/app/api/cpl/route"
import { GET as roi } from "@/app/api/roi/route"
import { GET as activeUsers } from "@/app/api/active-users/route"
import { GET as activeSegments } from "@/app/api/active-segments/route"
import { GET as activeCampaigns } from "@/app/api/active-campaigns/route"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { dashboardBatchResponse } from "@/lib/dashboard/batch-response"
import { normalizeBatchDates } from "@/lib/dashboard/batch-dates"

type Handler = (request: NextRequest) => Promise<Response>

const HANDLERS: Record<string, Handler> = {
  revenue,
  ltv,
  cac,
  cpl,
  roi,
  "active-users": activeUsers,
  "active-segments": activeSegments,
  "active-campaigns": activeCampaigns,
}

export async function GET(request: NextRequest) {
  request = normalizeBatchDates(request)
  const access = await requireAnalyticsAccess(request)
  if (access.error) return access.error

  return dashboardBatchResponse({
    request,
    kind: "overview",
    handlers: HANDLERS,
    userId: access.userId,
  })
}
