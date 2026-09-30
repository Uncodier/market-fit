import 'server-only'
import { createHash } from 'node:crypto'
import type { PromptImageInput } from './prompt-image-contract'
import { readLimitedRequestBody } from '@/lib/http/read-limited-request-body'

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024
export type ImageBytes = { bytes: Uint8Array; contentType: string }

export async function readImageResponse(response: Response): Promise<ImageBytes | null> {
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  if (!response.ok || !contentType || !['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(contentType)) {
    void response.body?.cancel().catch(() => {})
    return null
  }
  try {
    const bytes = await readLimitedRequestBody(response as unknown as Request, MAX_IMAGE_BYTES)
    return bytes.length ? { bytes, contentType } : null
  } catch {
    if (!response.body?.locked) void response.body?.cancel().catch(() => {})
    return null
  }
}

/** Match the API's v2 site-scoped public cache. This reads storage only; it cannot generate. */
export function promptImageCacheUrl(input: PromptImageInput, siteId: string): URL | null {
  try {
    const base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    if (base.protocol !== 'https:' || base.username || base.password || base.port || base.pathname !== '/' || base.search || base.hash ||
      !(base.hostname === 'db.makinari.com' || /^[a-z0-9-]+\.supabase\.co$/.test(base.hostname))) return null
    const prompt = `v2:${siteId.toLowerCase()}:${input.prompt}`.trim().toLowerCase()
    const hash = createHash('sha256').update(`${prompt}|${input.width}x${input.height}`).digest('hex')
    return new URL(`/storage/v1/object/public/generative_images/prompt_cache/${hash}`, base)
  } catch {
    return null
  }
}

export async function readPromptImageCache(input: PromptImageInput, siteId?: string | null): Promise<ImageBytes | null> {
  if (!siteId) return null
  const target = promptImageCacheUrl(input, siteId)
  if (!target) return null
  try {
    const response = await fetch(target, {
      headers: { Accept: 'image/*' }, credentials: 'omit', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    })
    return await readImageResponse(response)
  } catch {
    return null
  }
}