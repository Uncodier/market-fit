import { apiClient } from '@/app/services/api-client-service'

export interface LookupOption {
  id?: number | string | null
  text: string
}

// Finder is private: every request uses the signed-in user's session, not an API key.
export async function lookupFetcher(type: string, q: string, siteId?: string): Promise<LookupOption[]> {
  const categoryMap: Record<string, string> = {
    industries: 'industries',
    organizations: 'organizations',
    org_keywords: 'organization_keywords',
    locations: 'locations',
    skills: 'person_skills',
    web_technologies: 'web_technologies'
  }
  const category = categoryMap[type] || type
  const url = `/api/finder/autocomplete/${encodeURIComponent(category)}?q=${encodeURIComponent(q)}&page=0${siteId ? `&site_id=${encodeURIComponent(siteId)}` : ''}`
  const res = await apiClient.get<{ results?: LookupOption[] }>(url, { includeAuth: true })
  if (!res.success) throw new Error(res.error?.message || 'Finder lookup failed')

  const results = Array.isArray(res.data?.results) ? res.data.results : []
  return results
    .map(r => ({ id: r?.id ?? null, text: r?.text }))
    .filter(v => typeof v.text === 'string' && v.text.length > 0)
}

export async function searchFinderPeople(payload: unknown) {
  // Keep the Search action pending until both requests settle, even on rejection.
  const [search, totals] = await Promise.allSettled([
    apiClient.post<{ search_results: Record<string, unknown>[]; total_search_results: number }>(
      '/api/finder/person_role_search', payload, { includeAuth: true }
    ),
    apiClient.post<{
      total_search_results: number
      total_persons: number
      total_organizations: number
    }>(
      '/api/finder/person_role_search/totals', payload, { includeAuth: true }
    )
  ])
  if (search.status === 'rejected') throw search.reason
  if (totals.status === 'rejected') throw totals.reason
  return [search.value, totals.value] as const
}

export function createFinderQuery(payload: unknown) {
  return apiClient.post('/api/finder/person_role_search/createQuery', payload, { includeAuth: true })
}