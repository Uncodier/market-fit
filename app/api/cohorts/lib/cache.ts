import { NextResponse } from "next/server"
import { normalizedRequestCacheKey, readThroughJsonCache } from "@/lib/redis/json-cache"
import { CohortInputError, CohortLimitError } from "./types"

/** Access and segment validation must precede even a cache hit. Never share RLS views. */
export async function cachedCohortReport(
  request: Request,
  namespace: "cohorts" | "leads-cohorts",
  userId: string,
  load: () => Promise<unknown>,
): Promise<Response> {
  const url = new URL(request.url)
  // Overwrite any caller-supplied value; normalizedRequestCacheKey hashes all parameters.
  url.searchParams.set("_cohortViewer", userId)
  const key = await normalizedRequestCacheKey(`${namespace}:observed-v2`, new Request(url))
  const result = await readThroughJsonCache({ key, ttlSeconds: 45, compute: load })
  if (result.status === "busy") {
    return NextResponse.json({ error: "Analytics are being refreshed" }, {
      status: 503, headers: { "Retry-After": "2", "Cache-Control": "private, no-store" },
    })
  }
  return NextResponse.json(result.value, {
    headers: { "X-Cache": result.status.toUpperCase(), "Cache-Control": "private, no-store" },
  })
}

export function cohortErrorResponse(error: unknown) {
  const input = error instanceof CohortInputError
  const limit = error instanceof CohortLimitError
  return NextResponse.json({
    error: input || limit ? error.message : "Failed to load cohort report",
    ...(limit ? { code: "COHORT_ROW_LIMIT" } : {}),
  }, {
    status: input ? 400 : limit ? 422 : 500,
    headers: { "Cache-Control": "private, no-store" },
  })
}