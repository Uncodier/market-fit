import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateContactPhone } from '@/app/auth/phone-validation'

export async function POST(request: Request) {
  try {
    const { phone } = await request.json()

    const phoneResult = validateContactPhone(phone)
    if (!phoneResult.valid || !phoneResult.phone) {
      return NextResponse.json(
        {
          error: phoneResult.valid
            ? 'Phone is required'
            : phoneResult.error,
        },
        { status: 400 }
      )
    }

    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } =
      await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
      {
        method: 'PUT',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            ...user.user_metadata,
            phone: phoneResult.phone,
          },
        }),
      }
    )

    if (!authResponse.ok) {
      const payload = await authResponse.json().catch(() => null)
      console.error('Supabase rejected the phone update:', payload)
      return NextResponse.json(
        { error: 'Unable to update phone number' },
        { status: authResponse.status >= 500 ? 502 : 400 }
      )
    }

    return NextResponse.json({
      success: true,
      phoneVerified: false,
    })
  } catch (error) {
    console.error('Unexpected error in update-phone route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
