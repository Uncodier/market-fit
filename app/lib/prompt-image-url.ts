export const PROMPT_IMAGE_PATH = '/api/images/prompt'
export const IMAGE_PLACEHOLDER_PATH = '/images/image-placeholder.svg'

/** A URL is a delivery request, never an authorization proof or a service credential. */
export function promptImageUrl(prompt: string, size = 1024, siteId?: string | null): string {
  const params = new URLSearchParams({ prompt: prompt.trim(), width: String(size), height: String(size) })
  if (siteId) params.set('site_id', siteId)
  return `${PROMPT_IMAGE_PATH}?${params}`
}

/** Normalize persisted legacy generation links without preserving auth/query overrides. */
export function normalizePromptImageUrl(value: string, siteId?: string | null): string {
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
    if (url.searchParams.get('cache_only') === '1') params.set('cache_only', '1')
    return `${PROMPT_IMAGE_PATH}?${params}`
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