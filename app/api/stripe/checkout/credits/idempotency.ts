import 'server-only'
import { createHash } from 'node:crypto'

export const CREDITS_IDEMPOTENCY_VERSION = 'v2'

/** Hash the complete provider payload, not a selection of its varying fields. */
export function createCreditsIdempotencyKey(
  operation: 'checkout' | 'product' | 'customer',
  params: object,
  scope: object = {},
  version = CREDITS_IDEMPOTENCY_VERSION
): string {
  const payload = JSON.stringify({ version, operation, scope, params }, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)))
    }
    return value
  })
  return `credits-${operation}-${version}-${createHash('sha256').update(payload).digest('hex')}`
}