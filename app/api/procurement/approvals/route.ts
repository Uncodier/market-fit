import { NextResponse } from 'next/server'
import { operationalRequestAccess } from '../requests/http'
import { privateHeaders, procurementError, uuid } from '../http'

export async function GET(request: Request) {
  try {
    const access = await operationalRequestAccess(request)
    if (access.error) return access.error
    const target = new URL(request.url).searchParams.get('target_id')
    if (target && !uuid.safeParse(target).success) return procurementError('Invalid approval target', 400)
    let query = access.supabase.from('procurement_event_approvals')
      .select('id,target_id,target_version,event,policy_revision,status,created_at,procurement_event_stages(id,position,definition,status)')
      .eq('site_id', access.siteId).order('created_at', { ascending: false }).limit(100)
    if (target) query = query.eq('target_id', target)
    const { data, error } = await query
    if (error) return procurementError('Unable to load approvals', 503)
    return NextResponse.json({ approvals: data }, { headers: privateHeaders })
  } catch { return procurementError('Unable to load approvals', 503) }
}