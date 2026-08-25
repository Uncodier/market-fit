import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
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
    const { instance_id } = body

    if (!instance_id) {
      return NextResponse.json(
        { success: false, error: { message: "Missing instance_id" } },
        { status: 400 }
      )
    }

    const { data: instance, error: fetchError } = await supabase
      .from("remote_instances")
      .select("id, site_id, user_id, name")
      .eq("id", instance_id)
      .single()

    if (fetchError || !instance) {
      console.error("Error fetching robot instance:", fetchError)
      return NextResponse.json(
        { success: false, error: { message: "Robot instance not found" } },
        { status: 404 }
      )
    }

    const canDeleteSite = await userCanOnSite(supabase, instance.site_id, "delete")
    const isCreator = instance.user_id === user.id
    if (!canDeleteSite && !isCreator) {
      return NextResponse.json(
        { success: false, error: { message: "Permission denied" } },
        { status: 403 }
      )
    }

    const { error: deleteError } = await supabase
      .from("remote_instances")
      .delete()
      .eq("id", instance_id)

    if (deleteError) {
      console.error("Error deleting robot instance:", deleteError)
      return NextResponse.json(
        {
          success: false,
          error: {
            message: "Failed to delete robot instance",
            details: deleteError.message,
          },
        },
        { status: 500 }
      )
    }

    console.log(`Robot instance deleted successfully: ${instance_id}`)

    return NextResponse.json({
      success: true,
      message: "Robot instance deleted successfully",
    })
  } catch (error) {
    console.error("Error in delete robot instance API:", error)
    return NextResponse.json(
      {
        success: false,
        error: { message: "Internal server error" },
      },
      { status: 500 }
    )
  }
}
