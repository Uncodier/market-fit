import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import CryptoJS from 'crypto-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  // Decodificar el state
  let statePayload
  try {
    statePayload = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'))
  } catch (e) {
    return NextResponse.json({ error: 'Invalid state' }, { status: 400 })
  }

  const { site_id, user_id } = statePayload

  const supabase = await createClient();
  const { data: { user: auth } } = await supabase.auth.getUser();
  if (!auth || auth.id !== user_id) {
    return NextResponse.json({ error: 'Unauthorized or session mismatch' }, { status: 401 })
  }

  const clientId = process.env.CLOUDFLARE_CLIENT_ID
  const clientSecret = process.env.CLOUDFLARE_CLIENT_SECRET
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/cloudflare/oauth/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Cloudflare credentials not configured' }, { status: 500 })
  }

  // Intercambiar el código por un token (Cloudflare)
  const params = new URLSearchParams()
  params.append('grant_type', 'authorization_code')
  params.append('client_id', clientId)
  params.append('client_secret', clientSecret)
  params.append('code', code)
  params.append('redirect_uri', redirectUri)

  const tokenResponse = await fetch('https://dash.cloudflare.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString()
  })

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text()
    console.error('Cloudflare token error:', text)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=cloudflare_token_exchange_failed`)
  }

  const tokenData = await tokenResponse.json()
  const accessToken = tokenData.access_token

  // Guardar en Supabase public.site_secrets directamente
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'Encryption-key'

    const supabaseAdmin = createSupabaseJsClient(supabaseUrl, supabaseServiceKey)

    // Función para encriptar con AES
    const encryptToken = (text: string): string => {
      const salt = CryptoJS.lib.WordArray.random(128 / 8).toString()
      const encrypted = CryptoJS.AES.encrypt(text, ENCRYPTION_KEY + salt).toString()
      return `${salt}:${encrypted}`
    }

    const encryptedValue = encryptToken(accessToken)

    // Check if it exists
    const { data: existing } = await supabaseAdmin
      .from('site_secrets')
      .select('id')
      .eq('site_id', site_id)
      .eq('provider', 'cloudflare')
      .eq('use_case', 'dns_sync')
      .is('instance_id', null)
      .maybeSingle()

    if (existing) {
      await supabaseAdmin
        .from('site_secrets')
        .update({
          encrypted_value: encryptedValue,
          name: 'Cloudflare OAuth Token'
        })
        .eq('id', existing.id)
    } else {
      await supabaseAdmin
        .from('site_secrets')
        .insert({
          site_id: site_id,
          name: 'Cloudflare OAuth Token',
          provider: 'cloudflare',
          use_case: 'dns_sync',
          encrypted_value: encryptedValue,
          instance_id: null
        })
    }
  } catch (err: any) {
    console.error('Error saving cloudflare token to site_secrets:', err)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?error=cloudflare_token_save_failed`)
  }

  // Redirigir de vuelta a los settings o dashboard (donde sea que inició)
  // Agregamos el parámetro cloudflare_sync_pending=true para que la UI sepa 
  // que recién regresamos del OAuth y necesita apretar Sync.
  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/settings?tab=channels&cloudflare_sync_pending=true`)
}
