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
    const { 
      site_id, 
      user_id, 
      activity,
      instance_id,
      message,
      context
    } = body

    // Validate required fields
    if (!site_id || !user_id || !activity) {
      return NextResponse.json(
        { success: false, error: { message: "Missing required fields: site_id, user_id, activity" } },
        { status: 400 }
      )
    }

    console.log('🤖 Starting robot workflow:', {
      site_id,
      user_id,
      activity,
      instance_id: instance_id || 'new',
      message: message ? message.substring(0, 100) + '...' : 'none',
      context: context ? 'provided' : 'none'
    })

    // If instance_id is provided, verify the instance exists and belongs to the user
    if (instance_id) {
      const { data: instance, error: fetchError } = await supabase
        .from('remote_instances')
        .select('id, site_id, user_id, name, status')
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

      // Verify the instance belongs to the correct site
      if (instance.site_id !== site_id) {
        return NextResponse.json(
          { success: false, error: { message: "Instance does not belong to this site" } },
          { status: 403 }
        )
      }

      console.log('🤖 Processing workflow for existing robot instance:', {
        instanceId: instance.id,
        instanceName: instance.name,
        instanceStatus: instance.status,
        activity
      })
    } else {
      // No instance_id provided - this is a new robot creation
      console.log('🤖 Creating new robot instance for workflow')
    }

    // Here you would integrate with your robot service
    // For now, we'll simulate the robot creation/start process
    
    let robotInstanceId = instance_id

    if (!instance_id) {
      // Create new robot instance
      const { data: newInstance, error: createError } = await supabase
        .from('remote_instances')
        .insert({
          site_id,
          user_id,
          name: `Robot-${Date.now()}`,
          status: 'pending',
          activity,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError || !newInstance) {
        console.error('Error creating robot instance:', createError)
        return NextResponse.json(
          { success: false, error: { message: "Failed to create robot instance" } },
          { status: 500 }
        )
      }

      robotInstanceId = newInstance.id
      console.log('🤖 Created new robot instance:', robotInstanceId)
    }

    // If message is provided, send it to the robot
    if (message && robotInstanceId) {
      try {
        // Send message to robot instance
        const { data: messageResponse, error: messageError } = await supabase
          .from('robot_messages')
          .insert({
            instance_id: robotInstanceId,
            message: message,
            role: 'user',
            context: context ? JSON.stringify(context) : null,
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (messageError) {
          console.error('Error sending message to robot:', messageError)
        } else {
          console.log('🤖 Message sent to robot:', messageResponse.id)
        }
      } catch (error) {
        console.error('Error processing message:', error)
      }
    }

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        instance_id: robotInstanceId,
        status: 'started',
        message: 'Robot workflow started successfully'
      }
    })

  } catch (error) {
    console.error('Error in workflow/startRobot:', error)
    return NextResponse.json(
      { success: false, error: { message: "Internal server error" } },
      { status: 500 }
    )
  }
}
