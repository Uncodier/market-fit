import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Validation schema for webhook payload
const WorkflowWebhookSchema = z.object({
  workflow_type: z.enum(['leadFollowUp', 'leadResearch', 'syncEmails', 'dailyStandUp', 'leadGeneration', 'assignLeads']),
  event_type: z.enum(['response_received', 'workflow_completed', 'workflow_failed']),
  lead_id: z.string().uuid(),
  site_id: z.string().uuid(),
  user_id: z.string().uuid(),
  response_data: z.object({
    message: z.string().optional(),
    response_type: z.string().optional(), // 'email', 'call', 'meeting', etc.
    response_content: z.string().optional(),
    timestamp: z.string().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
})

export async function POST(request: NextRequest) {
  try {
    // Use service role client to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Parse request body
    const body = await request.json()
    const validatedData = WorkflowWebhookSchema.parse(body)
    
    console.log('Workflow webhook received:', validatedData)

    const { workflow_type, event_type, lead_id, site_id, user_id, response_data, metadata } = validatedData

    // Verificar que el lead existe
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, email, status')
      .eq('id', lead_id)
      .eq('site_id', site_id)
      .single()

    if (leadError || !lead) {
      console.error('Lead not found:', leadError)
      return NextResponse.json({
        error: 'Lead not found',
        details: leadError?.message
      }, { status: 404 })
    }

    // Handle different workflow types and events
    if (workflow_type === 'leadFollowUp' && event_type === 'response_received') {
      // Lead follow up received a response - send immediate success
      console.log(`🎉 Lead ${lead.name} responded to follow-up! Sending immediate success notification.`)
      
      // Create a task to mark the follow-up as successful
      const followUpTaskData = {
        title: `Follow-up response received: ${lead.name}`,
        description: `${lead.name} (${lead.email}) responded to the follow-up message. ${response_data?.response_content ? `Response: "${response_data.response_content}"` : ''}`,
        status: 'completed' as const,
        stage: 'consideration' as const, // Move to consideration stage since they responded
        scheduled_date: new Date().toISOString(),
        completed_date: new Date().toISOString(),
        lead_id: lead_id,
        type: 'follow_up',
        site_id: site_id,
        user_id: user_id,
        notes: response_data?.message || 'Lead responded to follow-up workflow',
        priority: 1
      }

      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert([followUpTaskData])
        .select()
        .single()

      if (taskError) {
        console.error('Error creating follow-up response task:', taskError)
      } else {
        console.log('Follow-up response task created:', task)
      }

      // Create a notification for the user
      const notificationData = {
        title: '✅ Lead Follow-up Success',
        message: `${lead.name} responded to your follow-up! The workflow completed successfully in real-time instead of waiting 2 hours.`,
        type: 'success',
        is_read: false,
        site_id: site_id,
        user_id: user_id,
        related_entity_type: 'lead',
        related_entity_id: lead_id,
        event_type: 'workflow_success',
        severity: 1,
        action_url: `/leads/${lead_id}`
      }

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([notificationData])

      if (notificationError) {
        console.error('Error creating notification:', notificationError)
      } else {
        console.log('Success notification created for lead follow-up response')
      }

      // Optionally update lead status to 'contacted' if it's still 'new'
      if (lead.status === 'new') {
        const { error: updateError } = await supabase
          .from('leads')
          .update({ status: 'contacted', updated_at: new Date().toISOString() })
          .eq('id', lead_id)

        if (updateError) {
          console.error('Error updating lead status:', updateError)
        } else {
          console.log('Lead status updated to contacted')
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Follow-up response processed successfully',
        data: {
          lead_id,
          task_created: !!task,
          notification_sent: !notificationError,
          lead_status_updated: lead.status === 'new'
        }
      })
    }

    // Handle other workflow types and events
    if (event_type === 'workflow_completed') {
      console.log(`Workflow ${workflow_type} completed for lead ${lead_id}`)
      
      // Create a general completion notification
      const notificationData = {
        title: `${workflow_type} Completed`,
        message: `The ${workflow_type} workflow completed successfully for ${lead.name}.`,
        type: 'info',
        is_read: false,
        site_id: site_id,
        user_id: user_id,
        related_entity_type: 'lead',
        related_entity_id: lead_id,
        event_type: 'workflow_completed',
        severity: 2
      }

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([notificationData])

      if (notificationError) {
        console.error('Error creating completion notification:', notificationError)
      }

      return NextResponse.json({
        success: true,
        message: 'Workflow completion processed',
        data: { lead_id, workflow_type }
      })
    }

    if (event_type === 'workflow_failed') {
      console.error(`Workflow ${workflow_type} failed for lead ${lead_id}`)
      
      // Create a failure notification
      const notificationData = {
        title: `${workflow_type} Failed`,
        message: `The ${workflow_type} workflow failed for ${lead.name}. Please check the logs.`,
        type: 'error',
        is_read: false,
        site_id: site_id,
        user_id: user_id,
        related_entity_type: 'lead',
        related_entity_id: lead_id,
        event_type: 'workflow_failed',
        severity: 3
      }

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([notificationData])

      if (notificationError) {
        console.error('Error creating failure notification:', notificationError)
      }

      return NextResponse.json({
        success: true,
        message: 'Workflow failure processed',
        data: { lead_id, workflow_type }
      })
    }

    // Default response for unhandled events
    return NextResponse.json({
      success: true,
      message: 'Webhook received but no specific action taken',
      data: { workflow_type, event_type, lead_id }
    })

  } catch (error) {
    console.error('Error processing workflow webhook:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid webhook payload',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET method for testing the endpoint
export async function GET() {
  return NextResponse.json({
    message: 'Workflow webhook endpoint is active',
    usage: 'POST to this endpoint when workflows detect responses or complete',
    expected_payload: {
      workflow_type: 'leadFollowUp | leadResearch | syncEmails | dailyStandUp | leadGeneration | assignLeads',
      event_type: 'response_received | workflow_completed | workflow_failed',
      lead_id: 'UUID of the lead',
      site_id: 'UUID of the site',
      user_id: 'UUID of the user',
      response_data: {
        message: 'Optional response message',
        response_type: 'email | call | meeting | etc',
        response_content: 'Content of the response',
        timestamp: 'ISO timestamp of response'
      },
      metadata: 'Optional additional data'
    }
  })
} 