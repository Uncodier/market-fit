import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"
import { stopRemoteAssistantWorkflow } from "../stop-remote-workflow"

function isOptimisticLogId(id: unknown): boolean {
  return typeof id === "string" && id.startsWith("optimistic-")
}

function isRunningLog(log: { details?: { status?: string } | null }): boolean {
  return log.details?.status === "running"
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { user_log_id, instance_id } = body

    if (!instance_id) {
      return NextResponse.json(
        { success: false, error: { message: "Missing required field: instance_id" } },
        { status: 400 }
      )
    }

    const { data: instance, error: fetchError } = await supabase
      .from("remote_instances")
      .select("id, user_id, created_by, site_id")
      .eq("id", instance_id)
      .single()

    if (fetchError || !instance) {
      return NextResponse.json(
        { success: false, error: { message: "Robot instance not found" } },
        { status: 404 }
      )
    }

    const isOwner = instance.user_id === user.id || instance.created_by === user.id
    const canEditSite = instance.site_id
      ? await userCanOnSite(supabase, instance.site_id, "update")
      : false

    if (!isOwner && !canEditSite) {
      return NextResponse.json(
        { success: false, error: { message: "Permission denied" } },
        { status: 403 }
      )
    }

    let userLog: { id: string; details?: Record<string, unknown> | null } | null = null

    if (user_log_id && !isOptimisticLogId(user_log_id)) {
      const { data, error: logError } = await supabase
        .from("instance_logs")
        .select("id, details")
        .eq("id", user_log_id)
        .eq("instance_id", instance_id)
        .maybeSingle()

      if (!logError && data) {
        userLog = data
      }
    }

    if (!userLog) {
      const { data: recentLogs, error: recentError } = await supabase
        .from("instance_logs")
        .select("id, details")
        .eq("instance_id", instance_id)
        .eq("log_type", "user_action")
        .order("created_at", { ascending: false })
        .limit(20)

      if (recentError) {
        console.error("Error looking up running workflow logs:", recentError)
      }

      userLog = (recentLogs || []).find(isRunningLog) || null
    }

    if (!userLog) {
      return NextResponse.json({
        success: true,
        message: "No running workflow to cancel",
        data: { cancelled_log_id: null },
      })
    }

    const { error: updateError } = await supabase
      .from("instance_logs")
      .update({
        details: {
          ...(userLog.details || {}),
          status: "cancelled",
        },
      })
      .eq("id", userLog.id)

    if (updateError) {
      console.error("Error updating log status for cancellation:", updateError)
      return NextResponse.json(
        { success: false, error: { message: "Failed to cancel workflow" } },
        { status: 500 }
      )
    }

    const details = (userLog.details || {}) as Record<string, unknown>
    const nodeId = typeof details.instance_node_id === "string" ? details.instance_node_id : null
    if (nodeId) {
      await supabase.from("instance_nodes").update({ status: "stopped" }).eq("id", nodeId)
    } else {
      await supabase
        .from("instance_nodes")
        .update({ status: "stopped" })
        .eq("instance_id", instance_id)
        .eq("status", "running")
    }

    const { data: plans } = await supabase
      .from("instance_plans")
      .select("id")
      .eq("instance_id", instance_id)
      .in("status", ["in_progress", "pending"])

    if (plans && plans.length > 0) {
      await supabase
        .from("instance_plans")
        .update({ status: "paused", updated_at: new Date().toISOString() })
        .in("id", plans.map((plan) => plan.id))
    }

    const requestId = typeof details.request_id === "string" ? details.request_id : null
    const remote = session?.access_token
      ? await stopRemoteAssistantWorkflow({
          accessToken: session.access_token,
          instanceId: instance_id,
          userLogId: userLog.id,
          requestId,
        })
      : { attempted: false, ok: false }

    if (remote.attempted && !remote.ok) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Failed to stop the remote workflow" },
          data: { cancelled_log_id: userLog.id, remote },
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Workflow cancelled successfully",
      data: { cancelled_log_id: userLog.id, remote },
    })
  } catch (error) {
    console.error("Error in workflow cancellation API:", error)
    return NextResponse.json(
      { success: false, error: { message: "Internal server error" } },
      { status: 500 }
    )
  }
}
