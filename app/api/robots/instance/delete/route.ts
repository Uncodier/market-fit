import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify session exists
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { instance_id } = body

    if (!instance_id) {
      return NextResponse.json(
        { success: false, error: { message: "Missing instance_id" } },
        { status: 400 }
      )
    }

    // Verify the instance exists and belongs to the user
    const { data: instance, error: fetchError } = await supabase
      .from('remote_instances')
      .select('id, site_id, user_id, name')
      .eq('id', instance_id)
      .single()

    if (fetchError || !instance) {
      console.error('Error fetching robot instance:', fetchError)
      return NextResponse.json(
        { success: false, error: { message: "Robot instance not found" } },
        { status: 404 }
      )
    }

    // Verify user has access to this instance
    if (instance.user_id !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { message: "Permission denied" } },
        { status: 403 }
      )
    }

    // Delete the instance
    const { error: deleteError } = await supabase
      .from('remote_instances')
      .delete()
      .eq('id', instance_id)

    if (deleteError) {
      console.error('Error deleting robot instance:', deleteError)
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: "Failed to delete robot instance",
            details: deleteError.message 
          } 
        },
        { status: 500 }
      )
    }

    console.log(`✅ Robot instance deleted successfully: ${instance_id}`)

    return NextResponse.json({
      success: true,
      message: "Robot instance deleted successfully"
    })

  } catch (error) {
    console.error('Error in delete robot instance API:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { message: "Internal server error" } 
      },
      { status: 500 }
    )
  }
}

