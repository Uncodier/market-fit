import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { userCanOnSite } from "@/lib/permissions/site-access"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      )
    }

    const body = await request.json()
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : []

    if (ids.length === 0) {
      return NextResponse.json({ success: true })
    }

    const { data: rows, error: fetchError } = await supabase
      .from("instance_artifacts")
      .select("id, user_id, site_id, instance_id")
      .in("id", ids)

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: { message: fetchError.message } },
        { status: 500 }
      )
    }

    if (!rows?.length) {
      return NextResponse.json({ success: true })
    }

    const siteIds = [...new Set(rows.map((row) => row.site_id).filter(Boolean))] as string[]
    for (const siteId of siteIds) {
      const canDismiss = await userCanOnSite(supabase, siteId, "update")
      const ownsRows = rows
        .filter((row) => row.site_id === siteId)
        .every((row) => row.user_id === user.id)
      if (!canDismiss && !ownsRows) {
        return NextResponse.json(
          { success: false, error: { message: "Permission denied" } },
          { status: 403 }
        )
      }
    }

    const { data: deleted, error: deleteError } = await supabase
      .from("instance_artifacts")
      .delete()
      .in("id", ids)
      .select("id")

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: { message: deleteError.message } },
        { status: 500 }
      )
    }

    const deletedIds = new Set((deleted ?? []).map((row) => row.id))
    const remaining = rows.map((row) => row.id).filter((id) => !deletedIds.has(id))

    if (remaining.length > 0) {
      const service = await createServiceClient()
      const { error: serviceError } = await service
        .from("instance_artifacts")
        .delete()
        .in("id", remaining)

      if (serviceError) {
        return NextResponse.json(
          { success: false, error: { message: serviceError.message } },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting instance artifacts:", error)
    return NextResponse.json(
      { success: false, error: { message: "Internal server error" } },
      { status: 500 }
    )
  }
}
