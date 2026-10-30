import { timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { procurementError } from '../../http'
import { resultJson } from '../../requests/http'
import { processReplenishmentQueue } from './core'

export async function POST(request: Request) {
  const secret = process.env.PROCUREMENT_REPLENISHMENT_WORKER_SECRET
  if (!secret || secret.length < 32) return procurementError('Replenishment worker authentication is not configured', 503)
  const supplied = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return procurementError('Unauthorized worker', 401)
  }
  if (new URL(request.url).search || request.body !== null) {
    return procurementError('Worker does not accept parameters', 400)
  }
  try {
    // The verified server secret authorizes this cookie-free system contract only.
    // SQL reauthorizes the saved manager before each rule's separate transaction.
    const service = await createServiceClient(true, { access: 'system' })
    return resultJson(await processReplenishmentQueue(service))
  } catch { return procurementError('Unable to process replenishment queue', 503) }
}