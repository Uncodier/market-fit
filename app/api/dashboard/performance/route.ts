import { NextRequest } from "next/server"
import { GET as leadsContacted } from "@/app/api/performance/leads-contacted/route"
import { GET as leadsInConversation } from "@/app/api/performance/leads-in-conversation/route"
import { GET as meetings } from "@/app/api/performance/meetings/route"
import { GET as sales } from "@/app/api/performance/sales/route"
import { GET as tasks } from "@/app/api/performance/tasks/route"
import { GET as conversations } from "@/app/api/performance/conversations/route"
import { GET as contentsApproved } from "@/app/api/performance/contents-approved/route"
import { GET as requirementsCompleted } from "@/app/api/performance/requirements-completed/route"
import { GET as tokens } from "@/app/api/performance/tokens/route"
import { GET as videoMinutes } from "@/app/api/performance/video-minutes/route"
import { GET as imagesGenerated } from "@/app/api/performance/images-generated/route"
import { GET as metricsOverview } from "@/app/api/performance/metrics-overview/route"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { dashboardBatchResponse } from "@/lib/dashboard/batch-response"
import { normalizeBatchDates } from "@/lib/dashboard/batch-dates"

type Handler = (request: NextRequest) => Promise<Response>

const HANDLERS: Record<string, Handler> = {
  "leads-contacted": leadsContacted,
  "leads-in-conversation": leadsInConversation,
  meetings,
  sales,
  tasks,
  conversations,
  "contents-approved": contentsApproved,
  "requirements-completed": requirementsCompleted,
  tokens,
  "video-minutes": videoMinutes,
  "images-generated": imagesGenerated,
  "metrics-overview": metricsOverview,
}

export async function GET(request: NextRequest) {
  request = normalizeBatchDates(request)
  const access = await requireAnalyticsAccess(request)
  if (access.error) return access.error

  return dashboardBatchResponse({
    request,
    kind: "performance",
    handlers: HANDLERS,
    userId: access.userId,
  })
}
