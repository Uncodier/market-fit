import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for the request data
const WaitlistSignupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  referralCode: z.string().optional(),
  source: z.string().optional().default("waitlist")
})

export async function POST(request: Request) {
  try {
    // Use service role client to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Parse request body
    const body = await request.json()
    const validatedData = WaitlistSignupSchema.parse(body)
    
    const siteId = '9be0a6a2-5567-41bf-ad06-cb4014f0faf2'
    const systemUserId = '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'

    // 1. Create a new lead for the site first
    const leadData = {
      name: validatedData.name,
      email: validatedData.email,
      status: 'new' as const,
      origin: validatedData.source || 'waitlist',
      notes: validatedData.referralCode 
        ? `Attempted signup with referral code: ${validatedData.referralCode}` 
        : 'Signed up without referral code - added to waitlist',
      site_id: siteId,
      user_id: systemUserId,
      company: null,
      phone: null,
      position: null,
      segment_id: null,
      campaign_id: null,
      last_contact: null,
      birthday: null,
      language: null,
      social_networks: null,
      address: null
    }

    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert([leadData])
      .select()
      .single()

    if (leadError) {
      console.error('Error creating lead:', leadError)
      return NextResponse.json({
        error: 'Failed to create lead',
        details: leadError.message
      }, { status: 500 })
    }

    // 2. Create a task for processing the waitlist signup
    const taskData = {
      title: `Process waitlist signup: ${validatedData.name}`,
      description: `New user ${validatedData.name} (${validatedData.email}) signed up without referral code. Added to waitlist and needs follow-up.`,
      status: 'pending' as const,
      stage: 'awareness' as const,
      scheduled_date: new Date().toISOString(),
      lead_id: lead.id,
      type: 'email',
      site_id: siteId,
      user_id: systemUserId
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert([taskData])
      .select()
      .single()

    if (taskError) {
      console.error('Error creating task:', taskError)
      // Try to clean up the lead if task creation failed
      await supabase
        .from('leads')
        .delete()
        .eq('id', lead.id)
      
      return NextResponse.json({
        error: 'Failed to create processing task',
        details: taskError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully added to waitlist',
      data: {
        task_id: task.id,
        lead_id: lead.id,
        site_id: siteId
      }
    })

  } catch (error: any) {
    console.error('Waitlist signup error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}

// GET method for testing the endpoint
export async function GET() {
  return NextResponse.json({
    message: 'Waitlist signup endpoint is active',
    usage: 'POST to this endpoint with { name, email, referralCode?, source? }'
  })
} 