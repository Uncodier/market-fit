import { NextResponse } from "next/server"
import { createUserSupabase } from "@/lib/auth/site-member-request"
import { decodeRequestBody, readLimitedRequestBody, RequestBodyTooLargeError } from '@/lib/http/read-limited-request-body'
import { z } from 'zod'

const batchSchema = z.object({ ids: z.array(z.string().uuid()).max(50) }).strict()
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })

export async function POST(request: Request) {
  try {
    const body = decodeRequestBody(await readLimitedRequestBody(request, 4096))
    let parsed: unknown
    try { parsed = JSON.parse(body) } catch { return json({ success: false, error: 'Invalid project list' }, 400) }
    const input = batchSchema.safeParse(parsed)
    if (!input.success) return json({ success: false, error: 'Invalid project list' }, 400)
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(8_000)])
    const supabase = await createUserSupabase(signal)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user || user.is_anonymous) {
      return json({ success: false, error: 'Not authenticated' }, 401)
    }
    const reply = (logos: Record<string, string>) => json({ success: true, actorId: user.id, logos })
    if (!input.data.ids.length) return reply({})

    const location = await supabase.rpc('current_user_has_location_restrictions').abortSignal(signal)
    if (location.error || typeof location.data !== 'boolean') return json({ success: false, error: 'Location check unavailable' }, 503)
    if (location.data) return json({ success: false, error: 'Unrestricted location access is required' }, 403)

    // Recheck the selector's stored active/non-suspended membership, but only for
    // this batch. Sites RLS also enforces effective licensing at statement time.
    const ids = [...new Set(input.data.ids)]
    const members = await supabase.from('site_members').select('site_id').eq('user_id', user.id)
      .eq('status', 'active').eq('license_suspended', false).in('site_id', ids).abortSignal(signal)
    if (members.error || !Array.isArray(members.data)) return json({ success: false, error: 'Project list unavailable' }, 503)
    const memberIds = new Set(members.data.map(row => row.site_id).filter(id => ids.includes(id)))
    const filter = [`user_id.eq.${user.id}`, ...(memberIds.size ? [`id.in.(${[...memberIds].join(',')})`] : [])]
    const { data: logosData, error: logosError } = await supabase
      .from('sites')
      .select('id, logo_url')
      .in('id', ids)
      .or(filter.join(','))
      .is('archived_at', null)
      .not('logo_url', 'is', null)
      .abortSignal(signal)

    if (logosError || signal.aborted || !Array.isArray(logosData)) {
      return json({ success: false, error: 'Project logos unavailable' }, 503)
    }

    const logos = logosData.reduce((acc, curr) => {
      if (curr.logo_url) {
        acc[curr.id] = curr.logo_url
      }
      return acc
    }, {} as Record<string, string>)

    return reply(logos)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return json({ success: false, error: 'Project list too large' }, 413)
    return json({ success: false, error: 'Project logos unavailable' }, 503)
  }
}
