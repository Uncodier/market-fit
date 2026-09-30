import { createClient } from "@/lib/supabase/server"
import { requireAnalyticsAccess } from "@/lib/auth/api-analytics-access"
import { cachedCohortReport, cohortErrorResponse } from "./lib/cache"
import { prepareCohortRequest } from "./lib/period"
import { validateCohortSegment } from "./lib/queries"
import { customerCohortReport } from "./lib/reports"

export async function GET(request: Request) {
  try {
    const prepared = prepareCohortRequest(request)
    const access = await requireAnalyticsAccess(prepared.request)
    if (access.error) return access.error

    const client = await createClient(true)
    await validateCohortSegment(client, prepared.scope)
    return await cachedCohortReport(prepared.request, "cohorts", access.userId,
      () => customerCohortReport(client, prepared.scope))
  } catch (error) {
    return cohortErrorResponse(error)
  }
}