import { requireSiteAccess } from '@/lib/auth/api-site-access'
import { privateHeaders, procurementError, uuid } from '../http'

export async function catalogAccess(request: Request, command: 'select' | 'insert' | 'update') {
  const params = new URL(request.url).searchParams
  const site = uuid.safeParse(params.get('site_id'))
  if (!site.success || params.getAll('site_id').length !== 1) {
    return { error: procurementError('A valid workspace is required', 400) } as const
  }
  if (/(?:^|;\s*)market_fit_demo_site_id=/.test(request.headers.get('cookie') ?? '')) {
    return { error: procurementError('Procurement is unavailable in demo mode', 403) } as const
  }
  const access = await requireSiteAccess(request, site.data)
  if (access.error) {
    access.error.headers.set('Cache-Control', privateHeaders['Cache-Control'])
    return { error: access.error } as const
  }
  const permission = await access.supabase.rpc('procurement_supplier_can', { p_site_id: site.data, p_command: command })
  if (permission.error) return { error: procurementError('Unable to verify access', 503) } as const
  if (permission.data !== true) return { error: procurementError('Forbidden', 403) } as const
  return { ...access, siteId: site.data } as const
}

export class CatalogBodyError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export async function readCatalogBody(request: Request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) throw new CatalogBodyError('Forbidden origin', 403)
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Missing body')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 24000) { await reader.cancel(); throw new CatalogBodyError('Body too large', 413) }
      chunks.push(value)
    }
    const body = new Uint8Array(length)
    let offset = 0
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
    return JSON.parse(new TextDecoder().decode(body)) as unknown
  } finally { reader.releaseLock() }
}