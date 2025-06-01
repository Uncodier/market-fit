import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for the WhatsApp setup request
const requestBodySchema = z.object({
  siteId: z.string().min(1, "Site ID is required"),
  siteName: z.string().min(1, "Site name is required"),
  setupType: z.enum(["new_number", "port_existing", "api_key"]),
  country: z.string().optional(),
  region: z.string().optional(),
  existingNumber: z.string().optional(),
  apiToken: z.string().optional()
}).refine((data) => {
  // If porting existing number, existingNumber is required
  if (data.setupType === "port_existing" && !data.existingNumber) {
    return false;
  }
  // For api_key setup, both apiToken and existingNumber (phone number) are required
  if (data.setupType === "api_key") {
    if (!data.apiToken || data.apiToken.trim() === '') return false;
    if (!data.existingNumber || data.existingNumber.trim() === '') return false;
  }
  // For new number setup, country is required and region field represents the preferred city
  if (data.setupType === "new_number") {
    if (!data.country) return false;
    if (["US", "CA", "AU", "BR", "IN", "GB", "DE", "FR", "IT", "ES", "NL", "JP", "MX"].includes(data.country) && !data.region) {
      return false;
    }
  }
  return true;
}, {
  message: "Missing required fields for the selected setup type",
  path: ["setupType"]
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
    const validatedData = requestBodySchema.parse(body)
    
    const systemUserId = '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'

    // Create task description based on setup type
    let taskDescription = '';
    if (validatedData.setupType === 'new_number') {
      taskDescription = `WhatsApp & SMS setup request for ${validatedData.siteName}. 
        New number requested for ${validatedData.country}${validatedData.region ? ` in ${validatedData.region} city area` : ''}.
        Customer needs assistance with Twilio WhatsApp Business API & SMS setup and number provisioning.`;
    } else if (validatedData.setupType === 'port_existing') {
      taskDescription = `WhatsApp Business setup request for ${validatedData.siteName}. 
        Number porting requested for existing number: ${validatedData.existingNumber}.
        Customer needs assistance with Twilio WhatsApp Business API setup and number porting process.`;
    } else {
      taskDescription = `Twilio API integration for ${validatedData.siteName}. 
        Customer has provided their Twilio API key for WhatsApp & SMS integration.
        Phone number to configure: ${validatedData.existingNumber}
        API key needs to be validated and integrated into the system.`;
    }

    // Create a task for processing the WhatsApp setup request
    const taskData = {
      title: `WhatsApp Business Setup: ${validatedData.siteName}`,
      description: taskDescription,
      status: 'pending' as const,
      stage: 'purchase' as const,
      category: 'setup' as const,
      scheduled_date: new Date().toISOString(),
      lead_id: null, // No specific lead for this setup task
      type: 'setup',
      site_id: validatedData.siteId,
      user_id: systemUserId,
      // Store setup details in metadata
      metadata: {
        setup_type: validatedData.setupType,
        country: validatedData.country,
        region: validatedData.region,
        existing_number: validatedData.existingNumber,
        api_token_provided: validatedData.apiToken ? true : false,
        service: 'whatsapp_business'
      }
    }

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert([taskData])
      .select()
      .single()

    if (taskError) {
      console.error('Error creating WhatsApp setup task:', taskError)
      return NextResponse.json({
        error: 'Failed to create setup task',
        details: taskError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'WhatsApp setup request submitted successfully',
      data: {
        task_id: task.id,
        site_id: validatedData.siteId,
        setup_type: validatedData.setupType,
        estimated_setup_time: validatedData.setupType === 'new_number' ? '1-2 business days' : 
                              validatedData.setupType === 'port_existing' ? '3-5 business days' : 
                              'Same day validation'
      }
    })

  } catch (error: any) {
    console.error('WhatsApp setup error:', error)
    
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
    message: 'WhatsApp setup endpoint is active',
    usage: 'POST to this endpoint with { siteId, setupType, country, region?, existingNumber?, siteName }'
  })
} 