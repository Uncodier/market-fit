type LinkedInKind = 'company' | 'person'

export function normalizeLinkedInIdentifier(value: string, kind: LinkedInKind): string {
  const text = value.trim()
  const path = kind === 'company' ? 'company' : 'in'
  const invalid = () => new Error(`Enter a valid LinkedIn ${kind} slug or linkedin.com/${path}/ URL.`)
  let slug = text
  if (/^(?:https?:\/\/)?(?:[a-z0-9-]+\.)?linkedin\.com\//i.test(text) || text.includes('/')) {
    let url: URL
    try {
      url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
    } catch { throw invalid() }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port ||
      !/^(?:[a-z0-9-]+\.)?linkedin\.com$/i.test(url.hostname)) throw invalid()
    const parts = url.pathname.split('/').filter(Boolean)
    if (parts[0]?.toLowerCase() !== path || parts.length < 2 || parts.length > 3 ||
      (parts[2] && !['about', 'posts', 'jobs', 'people', 'life', 'details'].includes(parts[2].toLowerCase()))) {
      throw invalid()
    }
    try { slug = decodeURIComponent(parts[1]) } catch { throw invalid() }
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(slug)) throw invalid()
  return slug.toLowerCase()
}

export function normalizeLinkedInFilters(payload: unknown) {
  if (!payload || typeof payload !== 'object') return payload
  const body = { ...payload as Record<string, unknown> }
  const fields = {
    organization_linkedin_public_identifiers: 'company',
    person_linkedin_public_identifiers: 'person',
  } as const
  for (const field of Object.keys(fields) as (keyof typeof fields)[]) {
    const values = body[field]
    if (values === undefined) continue
    if (!Array.isArray(values) || !values.every(value => typeof value === 'string')) {
      throw new Error(`Invalid LinkedIn ${fields[field]} identifiers`)
    }
    const normalized = values.map(value => normalizeLinkedInIdentifier(value, fields[field]))
    body[field] = normalized.length ? [...new Set(normalized)] : undefined
  }
  return body
}