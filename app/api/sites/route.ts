import { NextResponse } from "next/server"
import { createServiceSupabase, createUserSupabase } from "@/lib/auth/site-member-request"
import { listAccessibleSitesForUser } from "@/lib/sites/list-accessible-sites"
import { readSiteBilling } from "@/app/context/read-site-billing"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const detailId = searchParams.get('detail')
    
    const supabase = await createUserSupabase()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 })
    }

    const admin = createServiceSupabase()
    const { sites, error } = await listAccessibleSitesForUser(admin, user.id)
    if (error) {
      return NextResponse.json({ success: false, error }, { status: 500 })
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load sites"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
