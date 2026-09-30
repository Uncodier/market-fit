import { createClient } from "@/lib/supabase/server"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { cachedCohortReport, cohortErrorResponse } from "../cohorts/lib/cache"
import { prepareCohortRequest } from "../cohorts/lib/period"
import { validateCohortSegment } from "../cohorts/lib/queries"
import { leadCohortReport } from "../cohorts/lib/reports"

export async function GET(request: Request) {
  try {
    const prepared = prepareCohortRequest(request)
    const access = await requireAnalyticsAccess(prepared.request)
    if (access.error) return access.error

    const client = await createClient(true)
    await validateCohortSegment(client, prepared.scope)
    return await cachedCohortReport(prepared.request, "leads-cohorts", access.userId,
      () => leadCohortReport(client, prepared.scope))
  } catch (error) {
    return cohortErrorResponse(error)
  }
}