import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import {
  decodeRequestBody,
  readLimitedRequestBody,
  RequestBodyTooLargeError,
} from '@/lib/http/read-limited-request-body'

const requestSchema = z.object({
  siteId: z.string().uuid(),
  requestedCredits: z.number().positive().max(1_000_000_000),
  idempotencyKey: z.string().min(16).max(128),
})

export async function POST(request: NextRequest) {
  try {
    const rawBody = decodeRequestBody(
      await readLimitedRequestBody(request, 8 * 1024)
    )
    const parsed = requestSchema.safeParse(JSON.parse(rawBody))
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Missing or invalid fields' },
        { status: 400 }
      )
    }

    const { siteId, requestedCredits, idempotencyKey } = parsed.data
    const access = await requireSiteAccess(request, siteId, {
      requireManager: true,
    })
    if (access.error) return access.error

    const { data: settings, error: settingsError } = await access.supabase
      .from('settings')
      .select('shop')
      .eq('site_id', siteId)
      .single()
    const shop = settings?.shop as Record<string, unknown> | null
    const bankDetails = {
      accountName: shop?.bank_account_name,
      bankName: shop?.bank_name,
      routingNumber: shop?.bank_routing_number,
      accountNumber: shop?.bank_account_number,
    }
    if (
      settingsError ||
      Object.values(bankDetails).some(
        (value) => typeof value !== 'string' || !value.trim()
      )
    ) {
      return NextResponse.json(
        { error: 'Complete the site bank details before requesting a payout' },
        { status: 400 }
      )
    }

    const serviceClient = await createServiceClient(true)

    const { data: payoutRequest, error: payoutError } = await serviceClient.rpc(
      'create_payout_request',
      {
        p_site_id: siteId,
        p_requested_credits: requestedCredits,
        p_bank_details: bankDetails,
        p_requested_by: access.userId,
        p_idempotency_key: idempotencyKey,
      }
    )

    if (payoutError) {
      console.error('Error creating payout request:', payoutError)
      return NextResponse.json({ error: 'Failed to create payout request' }, { status: 409 })
    }

    return NextResponse.json({ success: true, payoutRequest })
  } catch (err: unknown) {
    if (err instanceof RequestBodyTooLargeError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status }
      )
    }
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }
    console.error('Error in request payout:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
