import type { LookupOption } from './finder-api'

export function organizationId(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) return undefined
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}

export function buildCompanyFilters(companies: LookupOption[], draft = '') {
  const options = draft.trim() ? [...companies, { text: draft.trim() }] : companies
  const ids = new Set<number>()
  const domains = new Set<string>()
  const names = new Set<string>()
  for (const option of options) {
    const id = organizationId(option.id)
    const text = option.text.trim()
    if (id !== undefined) ids.add(id)
    else if (/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(text)) domains.add(text.toLowerCase())
    else if (text) names.add(text)
  }
  return {
    organizations: ids.size ? [...ids] : undefined,
    organization_domains: domains.size ? [...domains] : undefined,
    // UI-only field resolved to provider IDs before search, totals or query creation.
    organization_names: names.size ? [...names] : undefined,
  }
}

export async function resolveCompanyFilters(
  payload: unknown,
  lookup: (name: string, siteId?: string) => Promise<LookupOption[]>,
) {
  if (!payload || typeof payload !== 'object' || !('organization_names' in payload)) return payload
  const { organization_names: names, ...body } = payload as Record<string, unknown>
  if (!Array.isArray(names) || !names.every(name => typeof name === 'string')) {
    throw new Error('Invalid company names')
  }
  const resolved = await Promise.all(names.map(async name => {
    const results = await lookup(name, typeof body.site_id === 'string' ? body.site_id : undefined)
    const matches = new Set(results
      .filter(option => option.text.trim().toLowerCase() === name.trim().toLowerCase())
      .map(option => organizationId(option.id))
      .filter((id): id is number => id !== undefined))
    if (matches.size !== 1) {
      throw new Error(`Select a company suggestion for "${name}" or enter its domain before searching.`)
    }
    return [...matches][0]
  }))
  const existing = Array.isArray(body.organizations) ? body.organizations : []
  return { ...body, ...(resolved.length ? { organizations: [...new Set([...existing, ...resolved])] } : {}) }
}