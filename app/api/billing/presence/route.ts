import "server-only"
import { z } from "zod"
import { requireSiteAccess } from "@/lib/auth/api-site-access"
import { createServiceClient } from "@/lib/supabase/server"
import { withTimeout } from "@/app/services/request-timeout"

const inputSchema = z.object({ site_id: z.string().uuid() }).strict()
const headers = { "Cache-Control": "private, no-store" }

/** Presence only: never expose service-role balances or initialize/grant billing. */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams
  const input = inputSchema.safeParse(Object.fromEntries(params))
  if (!input.success || params.getAll('site_id').length !== 1) {
    return Response.json({ error: "Invalid billing presence request" }, { status: 400, headers })
  }
  const controller = new AbortController()
  const signal = AbortSignal.any([request.signal, controller.signal])
  try {
    return await withTimeout((async () => {
      // Retain the normal membership and unrestricted-location boundary. This is
      // read-only presence, not permission to initialize billing or view balances.
      const access = await requireSiteAccess(request, input.data.site_id)
      signal.throwIfAborted()
      if (access.error) {
        access.error.headers.set('Cache-Control', headers['Cache-Control'])
        return access.error
      }
      const service = await createServiceClient(true)
      signal.throwIfAborted()
      const { data, error } = await service.from('billing').select('site_id')
        .eq('site_id', input.data.site_id).abortSignal(signal).maybeSingle()
      signal.throwIfAborted()
      if (error || (data !== null && data?.site_id !== input.data.site_id)) {
        throw new Error('Billing presence unavailable')
      }
      return Response.json({ status: data === null ? 'missing' : 'present' }, { headers })
    })(), 6_000, 'Billing presence unavailable')
  } catch {
    return Response.json({ error: "Billing presence could not be confirmed" }, { status: 503, headers })
  } finally {
    controller.abort()
  }
}