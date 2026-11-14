import type { LookupOption } from './finder-api'
import { organizationId as lookupId } from './company-filters'

export const LOOKUP_FILTERS = {
  person_industries: { category: 'industries', label: 'person industry' },
  person_industries_exclude: { category: 'industries', label: 'excluded person industry' },
  person_skills: { category: 'skills', label: 'person skill' },
  organization_locations: { category: 'locations', label: 'company location' },
  organization_industries: { category: 'industries', label: 'company industry' },
  organization_industries_exclude: { category: 'industries', label: 'excluded company industry' },
  organization_keywords: { category: 'org_keywords', label: 'company keyword' },
  organization_web_technologies: { category: 'web_technologies', label: 'web technology' },
  job_post_locations: { category: 'locations', label: 'job posting location' },
  job_post_locations_exclude: { category: 'locations', label: 'excluded job posting location' },
} as const

export type LookupFilterField = keyof typeof LOOKUP_FILTERS
export type LookupFilterNames = Partial<Record<`${LookupFilterField}_names`, string[]>>

export function buildLookupFilter(field: LookupFilterField, values: LookupOption[], draft = '') {
  const options = draft.trim() ? [...values, { text: draft.trim() }] : values
  const ids = new Set<number>()
  const names = new Set<string>()
  for (const option of options) {
    const id = lookupId(option.id)
    if (id !== undefined) ids.add(id)
    else if (option.text.trim()) names.add(option.text.trim())
  }
  return {
    [field]: ids.size ? [...ids] : undefined,
    [`${field}_names`]: names.size ? [...names] : undefined,
  }
}

export function buildLookupOptions(field: LookupFilterField, query: object): LookupOption[] {
  const body = query as Record<string, unknown>
  const ids = Array.isArray(body[field]) ? body[field] as unknown[] : []
  const names = Array.isArray(body[`${field}_names`]) ? body[`${field}_names`] as unknown[] : []
  return [
    ...ids.map(lookupId).filter((id): id is number => id !== undefined).map(id => ({ id, text: `ID ${id}` })),
    ...names.filter((text): text is string => typeof text === 'string').map(text => ({ id: null, text })),
  ]
}

export function hasLookupFilterNames(payload: unknown) {
  return payload !== null && typeof payload === 'object' && Object.keys(LOOKUP_FILTERS)
    .some(field => (payload as Record<string, unknown>)[`${field}_names`] !== undefined)
}

export async function resolveLookupFilters(
  payload: unknown,
  lookup: (category: string, name: string, siteId?: string) => Promise<LookupOption[]>,
) {
  const body = { ...payload as Record<string, unknown> }
  await Promise.all((Object.keys(LOOKUP_FILTERS) as LookupFilterField[]).map(async field => {
    const namesKey = `${field}_names`
    const names = body[namesKey]
    delete body[namesKey]
    if (names === undefined) return
    if (!Array.isArray(names) || !names.every(name => typeof name === 'string' && name.trim())) {
      throw new Error(`Invalid ${LOOKUP_FILTERS[field].label} names`)
    }
    const resolved = await Promise.all(names.map(async name => {
      const results = await lookup(LOOKUP_FILTERS[field].category, name,
        typeof body.site_id === 'string' ? body.site_id : undefined)
      const matches = new Set(results
        .filter(option => option.text.trim().toLowerCase() === name.trim().toLowerCase())
        .map(option => lookupId(option.id)).filter((id): id is number => id !== undefined))
      if (matches.size !== 1) {
        throw new Error(`Select a ${LOOKUP_FILTERS[field].label} suggestion for "${name}" before searching.`)
      }
      return [...matches][0]
    }))
    if (resolved.length) body[field] = [...new Set([...(Array.isArray(body[field]) ? body[field] : []), ...resolved])]
  }))
  return body
}