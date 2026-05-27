import { NextResponse } from "next/server"
import { createClient as createMainClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  try {
    const { requirementIds } = await request.json()
    if (!requirementIds || !Array.isArray(requirementIds) || requirementIds.length === 0) {
      return NextResponse.json({ details: {} })
    }

    const mainSupabase = await createMainClient()
    const { data: { user } } = await mainSupabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    // Fetch requirement_status
    const { data: reqStatuses, error: reqStatusError } = await mainSupabase
      .from("requirement_status")
      .select("requirement_id, preview_url, instance_id, created_at")
      .in("requirement_id", requirementIds)
      .order("created_at", { ascending: false })

    const latestStatusByReqId = new Map<string, any>()
    const instanceIds = new Set<string>()
    if (!reqStatusError && reqStatuses) {
      for (const status of reqStatuses) {
        if (!latestStatusByReqId.has(status.requirement_id)) {
          latestStatusByReqId.set(status.requirement_id, status)
          if (status.instance_id) {
            instanceIds.add(status.instance_id)
          }
        }
      }
    }

    const latestLogByInstanceId = new Map<string, any>()
    if (instanceIds.size > 0) {
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

    const details: Record<string, any> = {}
    for (const reqId of requirementIds) {
      const status = latestStatusByReqId.get(reqId)
      const latestLog = status?.instance_id ? latestLogByInstanceId.get(status.instance_id) : null
      
      details[reqId] = {
        preview_url: status?.preview_url || null,
        instance_id: status?.instance_id || null,
        last_instance_log: latestLog ? { message: latestLog.message, created_at: latestLog.created_at } : null
      }
    }

    return NextResponse.json({ details })
  } catch (error) {
    console.error("Error in requirements-details API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
