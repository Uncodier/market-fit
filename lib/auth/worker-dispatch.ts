import { createHash, timingSafeEqual } from 'node:crypto'

/** Reuse the existing server-to-server x-api-key contract, not cron or browser credentials. */
export function isWorkerDispatchAuthorized(request: Request): boolean {
  const secret = process.env.SERVICE_API_KEY?.trim()
  if (!secret || request.method !== 'POST') return false
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(request.headers.get('x-api-key')?.trim() || ''), digest(secret))
}