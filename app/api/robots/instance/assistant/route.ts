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
      message, 
      site_id, 
      user_id, 
      context, 
      system_prompt, 
      instance_id 
    } = body

    // Validate required fields
    if (!message || !site_id || !user_id) {
      return NextResponse.json(
        { success: false, error: { message: "Missing required fields: message, site_id, user_id" } },
        { status: 400 }
      )
    }

    let actualInstanceId = instance_id

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

      console.log('🤖 Processing message for robot instance:', {
        instanceId: instance.id,
        instanceName: instance.name,
        instanceStatus: instance.status,
        message: message.substring(0, 100) + '...'
      })
    } else {
      // No instance_id provided - this is a new_makina context
      // Create a new robot instance
      console.log('🤖 Creating new robot instance for new_makina context')
      
      const { data: newInstance, error: createError } = await supabase
        .from('remote_instances')
        .insert({
          site_id: site_id,
          user_id: session.user.id,
          name: 'New Makina',
          status: 'pending',
          instance_type: 'assistant',
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError || !newInstance) {
        console.error('Error creating new robot instance:', createError)
        return NextResponse.json(
          { success: false, error: { message: "Failed to create new robot instance" } },
          { status: 500 }
        )
      }

      actualInstanceId = newInstance.id
      console.log('✅ New robot instance created:', {
        instanceId: newInstance.id,
        instanceName: newInstance.name,
        status: newInstance.status
      })
    }

    // Create a log entry for the user message
    const { data: userLog, error: userLogError } = await supabase
      .from('instance_logs')
      .insert({
        instance_id: actualInstanceId,
        log_type: 'user_action',
        level: 'info',
        message: message,
        details: {
          site_id,
          user_id,
          context: context || null,
          system_prompt: system_prompt || null
        }
      })
      .select()
      .single()

    if (userLogError) {
      console.error('Error creating user log:', userLogError)
      return NextResponse.json(
        { success: false, error: { message: "Failed to log user message" } },
        { status: 500 }
      )
    }

    // Create a system log entry indicating the message was received
    const { data: systemLog, error: systemLogError } = await supabase
      .from('instance_logs')
      .insert({
        instance_id: actualInstanceId,
        log_type: 'system',
        level: 'info',
        message: `Message received: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`,
        details: {
          user_log_id: userLog.id,
          processing: true
        }
      })
      .select()
      .single()

    if (systemLogError) {
      console.error('Error creating system log:', systemLogError)
    }

    // For now, create a simple response log
    // In a real implementation, this would call an AI service
    const { data: responseLog, error: responseLogError } = await supabase
      .from('instance_logs')
      .insert({
        instance_id: actualInstanceId,
        log_type: 'agent_action',
        level: 'info',
        message: `I received your message: "${message}". This is a placeholder response. In a real implementation, this would be processed by an AI assistant.`,
        details: {
          user_log_id: userLog.id,
          response_type: 'assistant',
          processing_complete: true
        }
      })
      .select()
      .single()

    if (responseLogError) {
      console.error('Error creating response log:', responseLogError)
    }

    console.log('✅ Assistant message processed successfully:', {
      userLogId: userLog.id,
      systemLogId: systemLog?.id,
      responseLogId: responseLog?.id,
      instanceId: actualInstanceId
    })

    return NextResponse.json({
      success: true,
      message: "Message processed successfully",
      data: {
        user_log_id: userLog.id,
        system_log_id: systemLog?.id,
        response_log_id: responseLog?.id,
        instance_id: actualInstanceId
      }
    })

  } catch (error) {
    console.error('Error in assistant API:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: { message: "Internal server error" } 
      },
      { status: 500 }
    )
  }
}
