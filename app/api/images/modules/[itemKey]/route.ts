import { getModuleImagePrompt } from '@/app/config/module-image-visuals'
import { isSharedModuleImageKey, SHARED_MODULE_IMAGE_AREAS } from '@/app/config/shared-module-images'
import { SUPPORT_SITE_ID } from '@/lib/chat/identity-types'
import { isSameOriginApiRequest } from '@/lib/http/api-proxy-security'
import { readPromptImageCache, type ImageBytes } from '@/lib/images/prompt-image-cache'
import { generateSharedModuleImage, moduleImageFailure } from '@/lib/images/shared-module-generation'
import { checkRateLimit, rateLimitError } from '@/lib/redis/control-plane'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300

function image(result: ImageBytes, cached: boolean): Response {
  return new Response(result.bytes as BodyInit, { headers: {
    'Content-Type': result.contentType,
    'Cache-Control': cached ? 'public, max-age=3600' : 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Image-Delivery': cached ? 'makinari-cache' : 'makinari-generated',
  } })
}

export async function GET(request: Request, context: { params: Promise<{ itemKey: string }> }): Promise<Response> {
  const { itemKey } = await context.params
  if (!isSharedModuleImageKey(itemKey) || new URL(request.url).search) {
    return moduleImageFailure('Invalid shared module image request', 400)
  }
  try {
    const input = {
      prompt: getModuleImagePrompt(SHARED_MODULE_IMAGE_AREAS[itemKey], itemKey, ''),
      width: 256, height: 256,
    }
    const cached = await readPromptImageCache(input, SUPPORT_SITE_ID)
    if (cached) return image(cached, true)
    if (!isSameOriginApiRequest(request) || request.headers.get('sec-fetch-site') !== 'same-origin') {
      return moduleImageFailure('Same-origin workspace access is required', 403)
    }
    // Skip demo identities: only a verified real account may request a fixed shared asset.
    const supabase = await createClient(true)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return moduleImageFailure('Authentication is required', 401)
    const admission = await checkRateLimit(`rl:v1:shared-module-images:user:${user.id}`, {
      limit: 30, windowSeconds: 60, failureMode: 'closed',
    })
    if (!admission.allowed) return rateLimitError(admission)
    // Makinari authorizes only the finite server-owned module set, never caller prompts or tenants.
    const result = await generateSharedModuleImage(request, input)
    return result instanceof Response ? result : image(result, false)
  } catch {
    return moduleImageFailure('Shared module image delivery is temporarily unavailable', 502)
  }
}