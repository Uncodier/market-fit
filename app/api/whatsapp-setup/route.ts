import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { createServiceClient } from '@/lib/supabase/server'
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/http/read-limited-request-body'

const requestBodySchema = z.object({
  siteId: z.string().uuid("Invalid site ID"),
  siteName: z.string().trim().min(1).max(160).optional(),
  setupType: z.enum(["new_number", "port_existing", "api_key"]),
  country: z.string().trim().max(2).optional(),
  region: z.string().trim().max(160).optional(),
  existingNumber: z.string().trim().max(32).optional(),
  apiToken: z.string().trim().max(512).optional()
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
    const rawBody = decodeRequestBody(
      await readLimitedRequestBody(request, 16 * 1024)
    )
    const validatedData = requestBodySchema.parse(JSON.parse(rawBody))
    const access = await requireSiteAccess(request, validatedData.siteId, {
      requireManager: true,
    })
    if (access.error) return access.error

    const supabase = await createServiceClient()
    const { data: site, error: siteError } = await supabase
      .from("sites")
      .select("name")
      .eq("id", validatedData.siteId)
      .single()
    if (siteError || !site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 })
    }
    const siteName = site.name
    
    const systemUserId = '541396e1-a904-4a81-8cbf-0ca4e3b8b2b4'

    // Create task description based on setup type
    let taskDescription = '';
    if (validatedData.setupType === 'new_number') {
      taskDescription = `WhatsApp & SMS setup request for ${siteName}.
        New number requested for ${validatedData.country}${validatedData.region ? ` in ${validatedData.region} city area` : ''}.
        Customer needs assistance with Twilio WhatsApp Business API & SMS setup and number provisioning.`;
    } else if (validatedData.setupType === 'port_existing') {
      taskDescription = `WhatsApp Business setup request for ${siteName}.
        Number porting requested for existing number: ${validatedData.existingNumber}.
        Customer needs assistance with Twilio WhatsApp Business API setup and number porting process.`;
    } else {
      taskDescription = `Twilio API integration for ${siteName}.
        Customer has provided their Twilio API key for WhatsApp & SMS integration.
        Phone number to configure: ${validatedData.existingNumber}
        API key needs to be validated and integrated into the system.`;
    }

    // Create a task for processing the WhatsApp setup request
    const taskData = {
      title: `WhatsApp Business Setup: ${siteName}`,
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

  } catch (error: unknown) {
    console.error('WhatsApp setup error:', error)

    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      )
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Internal server error'
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