import { NextResponse } from 'next/server'
import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { createCloudflareOAuthState } from '@/app/lib/integrations/cloudflare/oauth-state'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get('site_id')

  if (!siteId) {
    return NextResponse.json({ error: 'Missing site_id' }, { status: 400 })
  }

  const access = await requireSiteAccess(request, siteId, {
    requireManager: true,
  })
  if (access.error) return access.error

  const clientId = process.env.CLOUDFLARE_CLIENT_ID
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/integrations/cloudflare/oauth/callback`

  if (!clientId) {
    return NextResponse.json({ error: 'Cloudflare Client ID not configured' }, { status: 500 })
  }

  const state = createCloudflareOAuthState(siteId, access.userId)

  const url = new URL('https://dash.cloudflare.com/oauth2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  // Añadimos prompt=consent para forzar a Cloudflare a mostrar la pantalla 
  // de aprobación incluso si el usuario ya había aprobado la app en el pasado.
  url.searchParams.set('prompt', 'consent')
    // Intento 8: Scopes dot-delimited simplificados (zone.read dns.read dns.write)
  // basados en configuraciones comprobadas de OAuth para Cloudflare (ej. Shelter, Alchemy)
  url.searchParams.set('scope', 'zone.read dns.read dns.write')

  return NextResponse.redirect(url.toString())
}
