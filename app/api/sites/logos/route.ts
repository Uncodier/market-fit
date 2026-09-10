import { NextResponse } from "next/server"
import { createServiceSupabase, createUserSupabase } from "@/lib/auth/site-member-request"
import { listAccessibleSitesForUser } from "@/lib/sites/list-accessible-sites"

export async function POST(request: Request) {
  try {
    const { ids } = await request.json().catch(() => ({ ids: null }))
    
    // If ids is not provided or null, fetch all accessible. If empty array, fetch none.
    const requestedIds = ids

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

    const accessibleSiteIds = new Set(sites.map(s => s.id))
    
    // Filter to only requested IDs that the user has access to, or all accessible if ids is null
    const targetIds = Array.isArray(requestedIds)
      ? requestedIds.filter(id => accessibleSiteIds.has(id))
      : Array.from(accessibleSiteIds)

    if (targetIds.length === 0) {
      return NextResponse.json({ success: true, logos: {} })
    }

    const { data: logosData, error: logosError } = await admin
      .from('sites')
      .select('id, logo_url')
      .in('id', targetIds)
      .not('logo_url', 'is', null)

    if (logosError) {
      return NextResponse.json({ success: false, error: logosError.message }, { status: 500 })
    }

    const logos = (logosData || []).reduce((acc, curr) => {
      if (curr.logo_url) {
        acc[curr.id] = curr.logo_url
      }
      return acc
    }, {} as Record<string, string>)

    return NextResponse.json({ success: true, logos })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch logos"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
