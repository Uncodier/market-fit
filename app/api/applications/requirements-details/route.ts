import { NextResponse } from "next/server"
import { createClient as createMainClient, createServiceClient } from "@/lib/supabase/server"
import { getApiKeyFromRequest, isValidApiKey } from "@/app/lib/api-keys-config"
import { z } from "zod"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from "@/lib/http/read-limited-request-body"

const requestSchema = z.object({
  requirementIds: z.array(z.string().regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i)),
  includeLatestLog: z.boolean().default(true),
})

type RequirementStatus = {
  requirement_id: string; preview_url: string | null; instance_id: string | null;
  source_code: string | null; repo_url: string | null
}
type LatestLog = { message: string; created_at: string }

export async function POST(request: Request) {
  try {
    // 1. Authenticate (Dual Auth: API Key or User Cookie)
    const apiKey = getApiKeyFromRequest(request.headers)
    const isServerRequest = isValidApiKey(apiKey)

    let mainSupabase;
    if (!isServerRequest) {
      mainSupabase = await createMainClient()
      const { data: { user }, error } = await mainSupabase.auth.getUser()

      if (error || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    } else {
      mainSupabase = await createServiceClient()
    }
    
    let payload: z.infer<typeof requestSchema>
    try {
      payload = requestSchema.parse(JSON.parse(decodeRequestBody(await readLimitedRequestBody(request, 128_000))))
    } catch (error) {
      return NextResponse.json({ error: "Invalid requirement details request" }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400 })
    }
    const requirementIds = [...new Set(payload.requirementIds)]
    if (!requirementIds.length) return NextResponse.json({ details: {} })

    // The cookie path reads both statuses and logs under the user's RLS.
    const { data: reqStatuses, error: reqStatusError } = await mainSupabase
      .from("requirement_status")
      .select("requirement_id, preview_url, instance_id, source_code, repo_url, created_at")
      .in("requirement_id", requirementIds)
      .order("created_at", { ascending: false })

    const latestStatusByReqId = new Map<string, RequirementStatus>()
    const instanceIds = new Set<string>()
    if (!reqStatusError && reqStatuses) {
      for (const status of reqStatuses) {
        const existing = latestStatusByReqId.get(status.requirement_id)
        if (!existing) {
          // Keep a copy of the latest status
          latestStatusByReqId.set(status.requirement_id, { ...status })
          if (status.instance_id) {
            instanceIds.add(status.instance_id)
          }
        } else {
          // Merge missing fields from older statuses (so we keep the latest values if they exist, but fallback to older if missing)
          if (!existing.preview_url && status.preview_url) existing.preview_url = status.preview_url;
          if (!existing.source_code && status.source_code) existing.source_code = status.source_code;
          if (!existing.repo_url && status.repo_url) existing.repo_url = status.repo_url;
          if (!existing.instance_id && status.instance_id) {
            existing.instance_id = status.instance_id;
            instanceIds.add(status.instance_id);
          }
        }
      }
    }

    const latestLogByInstanceId = new Map<string, LatestLog>()
    if (payload.includeLatestLog && instanceIds.size > 0) {
      await Promise.all(Array.from(instanceIds).map(async (instanceId) => {
        const { data: logs } = await mainSupabase
          .from("instance_logs")
          .select("id, instance_id, message, created_at")
          .eq("instance_id", instanceId)
          .order("created_at", { ascending: false })
          .limit(1)
          
        if (logs && logs.length > 0) {
          latestLogByInstanceId.set(instanceId, logs[0])
        }
      }))
    }

    const details: Record<string, Omit<RequirementStatus, "requirement_id"> & { last_instance_log: LatestLog | null }> = {}
    for (const reqId of requirementIds) {
      const status = latestStatusByReqId.get(reqId)
      const latestLog = status?.instance_id ? latestLogByInstanceId.get(status.instance_id) : null
      
      details[reqId] = {
        preview_url: status?.preview_url || null,
        instance_id: status?.instance_id || null,
        source_code: status?.source_code || null,
        repo_url: status?.repo_url || null,
        last_instance_log: latestLog ? { message: latestLog.message, created_at: latestLog.created_at } : null
      }
    }

    return NextResponse.json({ details })
  } catch (error) {
    console.error("Error in requirements-details API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
