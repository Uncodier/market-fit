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
    const { plan_id, instance_id } = body

    // Validate required fields
    if (!plan_id) {
      return NextResponse.json(
        { success: false, error: { message: "Plan ID is required" } },
        { status: 400 }
      )
    }

    console.log('▶️ Resuming plan:', {
      plan_id,
      instance_id: instance_id || 'not provided',
      user_id: session.user.id
    })

    // Verify the plan exists and belongs to the user
    const { data: plan, error: fetchError } = await supabase
      .from('instance_plans')
      .select('id, status, user_id, instance_id')
      .eq('id', plan_id)
      .single()

    if (fetchError || !plan) {
      console.error('Error fetching plan:', fetchError)
      return NextResponse.json(
        { success: false, error: { message: "Plan not found" } },
        { status: 404 }
      )
    }

    // Verify user has access to this plan
    if (plan.user_id !== session.user.id) {
      return NextResponse.json(
        { success: false, error: { message: "Permission denied" } },
        { status: 403 }
      )
    }

    // Check if plan can be resumed (only paused plans can be resumed)
    if (plan.status !== 'paused') {
      return NextResponse.json(
        { success: false, error: { message: `Cannot resume plan with status: ${plan.status}` } },
        { status: 400 }
      )
    }

    // Update plan status to in_progress
    const { data: updatedPlan, error: updateError } = await supabase
      .from('instance_plans')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', plan_id)
      .select()
      .single()
      .single()

    if (updateError) {
      console.error('Error resuming plan:', updateError)
      return NextResponse.json(
        { success: false, error: { message: "Failed to resume plan" } },
        { status: 500 }
      )
    }

    console.log('✅ Plan resumed successfully:', updatedPlan.id)

    return NextResponse.json({
      success: true,
      data: {
        plan_id: updatedPlan.id,
        status: 'in_progress',
        message: 'Plan resumed successfully'
      }
    })

  } catch (error) {
    console.error('Error in resumePlan:', error)
    return NextResponse.json(
      { success: false, error: { message: "Internal server error" } },
      { status: 500 }
    )
  }
}
