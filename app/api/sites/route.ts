import { NextResponse } from "next/server"
import { createServiceSupabase, createUserSupabase } from "@/lib/auth/site-member-request"
import { listAccessibleSitesForUser } from "@/lib/sites/list-accessible-sites"
import { readSiteBilling } from "@/app/context/read-site-billing"
import { selectorResponse } from './selector-response'

export async function GET(request: Request) {
  const controller = new AbortController()
  const signal = AbortSignal.any([request.signal, controller.signal])
  const start = performance.now()
  let timer: ReturnType<typeof setTimeout> | undefined
  const unavailable = () => NextResponse.json({ success: false, error: 'Project loading is temporarily unavailable' }, { status: 503 })
  const deadline = new Promise<NextResponse>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve(unavailable()) }, 8_000)
  })
  try {
    const response = await Promise.race([loadSitesResponse(request, signal), deadline])
    response.headers.set('Cache-Control', 'private, no-store')
    response.headers.append('Server-Timing', `total;dur=${(performance.now() - start).toFixed(1)}`)
    if (response.status === 503) response.headers.set('Retry-After', '2')
    return response
  } finally { clearTimeout(timer); controller.abort() }
}

async function loadSitesResponse(request: Request, signal: AbortSignal) {
  try {
    const { searchParams } = new URL(request.url)
    const detailId = searchParams.get('detail')
    const view = searchParams.get('view')
    const fresh = searchParams.get('fresh')
    if (fresh !== null && (fresh !== '1' || view !== 'selector')) return NextResponse.json({ success: false, error: 'Invalid refresh' }, { status: 400 })
    if (view !== null && view !== 'selector') return NextResponse.json({ success: false, error: 'Invalid view' }, { status: 400 })
    if (view === 'selector' && detailId !== null) return NextResponse.json({ success: false, error: 'Selector requests do not accept detail' }, { status: 400 })
    
    const supabase = await createUserSupabase(signal)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      const denied = !userError || userError.status === 401 || userError.status === 403 ||
        ['session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt'].includes(userError.code ?? '') ||
        userError.name === 'AuthSessionMissingError'
      return NextResponse.json({ success: false, error: denied ? "Not authenticated" : 'Authentication is temporarily unavailable' }, { status: denied ? 401 : 503 })
    }
    if (signal.aborted) throw new Error('Aborted')
    if (view === 'selector') return await selectorResponse(supabase, user.id, signal, fresh === '1')

    const admin = createServiceSupabase()
    const { sites, error } = await listAccessibleSitesForUser(admin, user.id, signal)
    if (error) {
      return NextResponse.json({ success: false, error: 'The complete project list is temporarily unavailable' }, { status: 503 })
    }

    const siteIds = sites.map(s => s.id)
    
    const [billingResponse, detailResponse] = await Promise.all([
      siteIds.length > 0 
        ? readSiteBilling<Record<string, unknown>[]>(fields =>
          admin.from('billing').select(`site_id, ${fields}`).in('site_id', siteIds)
            .returns<Record<string, unknown>[]>())
        : Promise.resolve({ data: [], error: null }),
      
      detailId && siteIds.includes(detailId)
        ? admin.from('sites').select('id, logo_url, tracking, resource_urls').eq('id', detailId).is('archived_at', null).single()
        : Promise.resolve({ data: null, error: null })
    ])
    
    const billingMap = new Map((billingResponse.error ? [] : billingResponse.data ?? []).map(b => [b.site_id, b]))
    for (const site of sites) {
      site.billing = billingMap.get(site.id)
      site.billing_read_status = billingResponse.error ? 'unavailable' : site.billing ? 'loaded' : 'missing'
    }

    return NextResponse.json({ 
      success: true, 
      sites,
      detail: detailResponse.data
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Project loading is temporarily unavailable' }, { status: 503 })
  }
}
