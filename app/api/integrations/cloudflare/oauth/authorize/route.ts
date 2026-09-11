import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get('site_id')

  if (!siteId) {
    return NextResponse.json({ error: 'Missing site_id' }, { status: 400 })
  }

  // Verificar sesión activa
  const supabase = await createClient()
  const { data: { user: auth } } = await supabase.auth.getUser()
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = process.env.CLOUDFLARE_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/cloudflare/oauth/callback`

  if (!clientId) {
    return NextResponse.json({ error: 'Cloudflare Client ID not configured' }, { status: 500 })
  }

  // Guardamos el site_id en el estado
  const statePayload = { site_id: siteId, user_id: auth.id }
  const state = Buffer.from(JSON.stringify(statePayload)).toString('base64')

  const url = new URL('https://dash.cloudflare.com/oauth2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  // Añadimos prompt=consent para forzar a Cloudflare a mostrar la pantalla 
  // de aprobación incluso si el usuario ya había aprobado la app en el pasado.
  url.searchParams.set('prompt', 'consent')
  // Cloudflare actually requires the scopes in the URL for them to appear on the consent screen.
  url.searchParams.set('scope', 'zone:read dns_records:read dns_records:write')

  return NextResponse.redirect(url.toString())
}
