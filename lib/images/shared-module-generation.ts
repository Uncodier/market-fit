import 'server-only'
import { SUPPORT_SITE_ID } from '@/lib/chat/identity-types'
import { configuredApiUrl } from '@/lib/http/api-proxy-security'
import { checkRateLimit, rateLimitError } from '@/lib/redis/control-plane'
import { readImageResponse, type ImageBytes } from './prompt-image-cache'
import type { PromptImageInput } from './prompt-image-contract'

const inFlight = new Map<string, Promise<ImageBytes | Response>>()

export function moduleImageFailure(message: string, status: number): Response {
  return Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store, private' } })
}

/** Called only after session authorization and fixed module prompt resolution. */
export async function generateSharedModuleImage(request: Request, input: PromptImageInput): Promise<ImageBytes | Response> {
  const existing = inFlight.get(input.prompt)
  if (existing) {
    const result = await existing
    return result instanceof Response ? result.clone() : result
  }
  const work = generate(request, input)
  inFlight.set(input.prompt, work)
  try { return await work } finally { inFlight.delete(input.prompt) }
}

async function generate(request: Request, input: PromptImageInput): Promise<ImageBytes | Response> {
  const key = process.env.SERVICE_API_KEY?.trim()
  const target = configuredApiUrl(request, `/api/public/image/prompt/${encodeURIComponent(input.prompt)}`)
  if (!key || !target) return moduleImageFailure('Shared module image generation is not configured', 503)
  const admission = await checkRateLimit('rl:v1:shared-module-images:generation', {
    limit: 20, windowSeconds: 3600, failureMode: 'closed',
  })
  if (!admission.allowed) return rateLimitError(admission)
  target.search = new URLSearchParams({ site_id: SUPPORT_SITE_ID, width: '256', height: '256' }).toString()
  const response = await fetch(target, {
    headers: { 'x-api-key': key, Accept: 'image/*' },
    credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(240_000),
  })
  const image = await readImageResponse(response)
  if (image) return image
  // Never replay a request that may already have started paid generation.
  return moduleImageFailure('Shared module image generation could not be confirmed',
    [400, 401, 402, 403, 409, 429, 503].includes(response.status) ? response.status : 502)
}