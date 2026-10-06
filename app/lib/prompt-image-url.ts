import { resolveAppApiUrl } from '@/app/commerce/app-api-url'

export const PROMPT_IMAGE_PATH = '/api/images/prompt'
export const IMAGE_PLACEHOLDER_PATH = '/images/image-placeholder.svg'
export const PUBLIC_PROMPT_IMAGE_ORIGIN = 'https://app.makinari.com'

export type PromptImageResource = { type: 'catalog' | 'promotion' | 'hero'; id: string; hostId?: string }

/** Public routing is serialized by the server, never inferred again during hydration. */
export type PromptImageDelivery = {
  scope: 'public'
  origin: typeof PUBLIC_PROMPT_IMAGE_ORIGIN | null
}

function deliveryUrl(params: URLSearchParams, delivery?: PromptImageDelivery): string {
  const path = delivery
    ? `${delivery.origin || ''}${PROMPT_IMAGE_PATH}`
    : resolveAppApiUrl(PROMPT_IMAGE_PATH)
  // Public generation is authorized against the resource, never browser cookies.
  if (delivery?.scope === 'public' || path !== PROMPT_IMAGE_PATH) params.set('public', '1')
  return `${path}?${params}`
}

/** A URL is a delivery request, never an authorization proof or a service credential. */
export function promptImageUrl(prompt: string, size = 1024, siteId?: string | null, delivery?: PromptImageDelivery, resource?: PromptImageResource): string {
  const params = new URLSearchParams({ prompt: prompt.trim(), width: String(size), height: String(size) })
  if (siteId) params.set('site_id', siteId)
  if (resource) {
    params.set('resource_type', resource.type)
    params.set('resource_id', resource.id)
    if (resource.hostId) params.set('host_id', resource.hostId)
  }
  return deliveryUrl(params, delivery)
}

/** Normalize persisted legacy generation links without preserving auth/query overrides. */
export function normalizePromptImageUrl(value: string, siteId?: string | null, delivery?: PromptImageDelivery, resource?: PromptImageResource): string {
  try {
    const url = new URL(value, 'https://image.invalid')
    const legacyPrefix = '/api/public/image/prompt/'
    if (url.pathname !== PROMPT_IMAGE_PATH && !url.pathname.startsWith(legacyPrefix)) return value
    const prompt = url.pathname === PROMPT_IMAGE_PATH
      ? url.searchParams.get('prompt') || '' : decodeURIComponent(url.pathname.slice(legacyPrefix.length))
    const params = new URLSearchParams({
      prompt: prompt.trim(), width: url.searchParams.get('width') || '1024', height: url.searchParams.get('height') || '1024',
    })
    const site = siteId || url.searchParams.get('site_id')
    if (site) params.set('site_id', site)
    const resourceType = resource?.type || url.searchParams.get('resource_type')
    const resourceId = resource?.id || url.searchParams.get('resource_id')
    if (resourceId && ['catalog', 'promotion', 'hero'].includes(resourceType || '')) {
      params.set('resource_type', resourceType!)
      params.set('resource_id', resourceId)
      const hostId = resource?.hostId || url.searchParams.get('host_id')
      if (hostId) params.set('host_id', hostId)
    }
    if (url.searchParams.get('cache_only') === '1') params.set('cache_only', '1')
    if (url.searchParams.get('public') === '1') params.set('public', '1')
    return deliveryUrl(params, delivery)
  } catch {
    return value
  }
}

export function isPromptImageUrl(value: string): boolean {
  try {
    const path = new URL(value, 'https://image.invalid').pathname
    return path === PROMPT_IMAGE_PATH || path.startsWith('/api/public/image/prompt/')
  } catch {
    return false
  }
}