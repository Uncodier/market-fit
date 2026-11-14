import type { LookupOption } from './finder-api'
import { organizationId as lookupId } from './company-filters'

export function buildPersonLocationFilters(locations: LookupOption[], draft = '') {
  const options = draft.trim() ? [...locations, { text: draft.trim() }] : locations
  const ids = new Set<number>()
  const names = new Set<string>()
  for (const option of options) {
    const id = lookupId(option.id)
    if (id !== undefined) ids.add(id)
    else if (option.text.trim()) names.add(option.text.trim())
  }
  return {
    person_locations: ids.size ? [...ids] : undefined,
    // UI-only field; never forwarded to the provider.
    person_location_names: names.size ? [...names] : undefined,
  }
}

export async function resolvePersonLocationFilters(
  payload: unknown,
  lookup: (name: string, siteId?: string) => Promise<LookupOption[]>,
) {
  if (!payload || typeof payload !== 'object' || !('person_location_names' in payload)) return payload
  const { person_location_names: names, ...body } = payload as Record<string, unknown>
  if (!Array.isArray(names) || !names.every(name => typeof name === 'string' && name.trim())) {
    throw new Error('Invalid person location names')
  }
  const resolved = await Promise.all(names.map(async name => {
    const results = await lookup(name, typeof body.site_id === 'string' ? body.site_id : undefined)
    const matches = new Set(results
      .filter(option => option.text.trim().toLowerCase() === name.trim().toLowerCase())
      .map(option => lookupId(option.id))
      .filter((id): id is number => id !== undefined))
    if (matches.size !== 1) {
      throw new Error(`Select a person location suggestion for "${name}" before searching.`)
    }
    return [...matches][0]
  }))
  const existing = Array.isArray(body.person_locations) ? body.person_locations : []
  return { ...body, ...(resolved.length ? { person_locations: [...new Set([...existing, ...resolved])] } : {}) }
}