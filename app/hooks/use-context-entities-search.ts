import { useState, useCallback, useMemo, useRef } from 'react'
import { useSite } from '@/app/context/SiteContext'
import { useOptionalScreenAccess } from '@/app/context/ScreenAccessContext'
import {
  ContextLead,
  ContextContent,
  ContextRequirement,
  ContextTask,
  ContextCampaign,
  ContextQuotation,
  ContextDeal,
  ContextRecord
} from '@/app/services/context-entities.service'
import { CONTEXT_COLLECTIONS } from '@/app/components/context/context-collections'
import {
  fetchContextLeads,
  fetchContextContents,
  fetchContextRequirements,
  fetchContextTasks,
  fetchContextCampaigns,
  fetchContextQuotations,
  fetchContextDeals,
  fetchContextRecords
} from './context-entity-fetchers'

interface SearchResults {
  leads: ContextLead[]
  contents: ContextContent[]
  requirements: ContextRequirement[]
  tasks: ContextTask[]
  campaigns: ContextCampaign[]
  quotations: ContextQuotation[]
  deals: ContextDeal[]
  records: ContextRecord[]
}

interface UseContextEntitiesSearchReturn {
  searchResults: SearchResults
  loading: boolean
  error: string | null
  searchAll: (query: string) => Promise<void>
  clearSearch: () => void
  loadInitialData: () => Promise<void>
  enabledCollections: typeof CONTEXT_COLLECTIONS
  hasInitialized: boolean
}

const EMPTY_RESULTS: SearchResults = {
  leads: [],
  contents: [],
  requirements: [],
  tasks: [],
  campaigns: [],
  quotations: [],
  deals: [],
  records: []
}

function filterClientSide<T>(items: T[], fields: string[], searchLower: string): T[] {
  return items.filter(item =>
    fields.some(field => {
      const val = field.split('.').reduce<unknown>((obj, key) => {
        if (obj && typeof obj === 'object' && key in (obj as object)) {
          return (obj as Record<string, unknown>)[key]
        }
        return undefined
      }, item as unknown)
      return typeof val === 'string' && val.toLowerCase().includes(searchLower)
    })
  )
}

function fulfilledValue<T>(result: PromiseSettledResult<T[]>): T[] {
  return result.status === 'fulfilled' ? result.value : []
}

export function useContextEntitiesSearch(): UseContextEntitiesSearchReturn {
  const { currentSite } = useSite()
  const screenAccess = useOptionalScreenAccess()
  const canAccessNavKey = screenAccess?.canAccessNavKey
  const siteId = currentSite?.id

  const enabledCollections = useMemo(() => {
    return CONTEXT_COLLECTIONS.filter(
      (col) => !canAccessNavKey || canAccessNavKey(col.navKey)
    )
  }, [canAccessNavKey])

  const enabledKeys = useMemo(
    () => new Set(enabledCollections.map(c => c.key)),
    [enabledCollections]
  )
  const enabledKeysRef = useRef(enabledKeys)
  enabledKeysRef.current = enabledKeys

  const [searchResults, setSearchResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)

  const hasCollection = useCallback((key: string) => {
    return enabledKeysRef.current.has(key as typeof CONTEXT_COLLECTIONS[number]['key'])
  }, [])

  const loadInitialData = useCallback(async () => {
    if (!siteId) return

    setLoading(true)
    setError(null)

    try {
      const results = await Promise.allSettled([
        hasCollection('leads') ? fetchContextLeads(siteId, 20) : Promise.resolve([]),
        hasCollection('contents') ? fetchContextContents(siteId, "", 20) : Promise.resolve([]),
        hasCollection('requirements') ? fetchContextRequirements(siteId, 20) : Promise.resolve([]),
        hasCollection('tasks') ? fetchContextTasks(siteId, 20) : Promise.resolve([]),
        hasCollection('campaigns') ? fetchContextCampaigns(siteId, 20) : Promise.resolve([]),
        hasCollection('quotations') ? fetchContextQuotations(siteId, 20) : Promise.resolve([]),
        hasCollection('deals') ? fetchContextDeals(siteId, 20) : Promise.resolve([]),
        hasCollection('records') ? fetchContextRecords(siteId, 20) : Promise.resolve([])
      ])

      setSearchResults({
        leads: fulfilledValue(results[0]),
        contents: fulfilledValue(results[1]),
        requirements: fulfilledValue(results[2]),
        tasks: fulfilledValue(results[3]),
        campaigns: fulfilledValue(results[4]),
        quotations: fulfilledValue(results[5]),
        deals: fulfilledValue(results[6]),
        records: fulfilledValue(results[7])
      })
      setHasInitialized(true)
    } catch (err) {
      console.error('Error loading initial data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [siteId, hasCollection])

  const loadInitialDataRef = useRef(loadInitialData)
  loadInitialDataRef.current = loadInitialData

  const searchAll = useCallback(async (query: string) => {
    if (!siteId) return

    if (!query.trim()) {
      return loadInitialDataRef.current()
    }

    setLoading(true)
    setError(null)

    try {
      const settledResults = await Promise.allSettled([
        hasCollection('leads') ? fetchContextLeads(siteId, 50) : Promise.resolve([]),
        hasCollection('contents') ? fetchContextContents(siteId, query, 50) : Promise.resolve([]),
        hasCollection('requirements') ? fetchContextRequirements(siteId, 50) : Promise.resolve([]),
        hasCollection('tasks') ? fetchContextTasks(siteId, 50) : Promise.resolve([]),
        hasCollection('campaigns') ? fetchContextCampaigns(siteId, 50) : Promise.resolve([]),
        hasCollection('quotations') ? fetchContextQuotations(siteId, 50) : Promise.resolve([]),
        hasCollection('deals') ? fetchContextDeals(siteId, 50) : Promise.resolve([]),
        hasCollection('records') ? fetchContextRecords(siteId, 50) : Promise.resolve([])
      ])
      const searchLower = query.toLowerCase()

      setSearchResults({
        leads: settledResults[0].status === 'fulfilled'
          ? filterClientSide(settledResults[0].value, ['name', 'email', 'position', 'status', 'company'], searchLower)
          : [],
        contents: fulfilledValue(settledResults[1]),
        requirements: settledResults[2].status === 'fulfilled'
          ? filterClientSide(settledResults[2].value, ['title', 'description', 'status', 'priority'], searchLower)
          : [],
        tasks: settledResults[3].status === 'fulfilled'
          ? filterClientSide(settledResults[3].value, ['title', 'description', 'status', 'type', 'priority', 'serial_id'], searchLower)
          : [],
        campaigns: settledResults[4].status === 'fulfilled'
          ? filterClientSide(settledResults[4].value, ['title', 'description', 'status', 'priority', 'type'], searchLower)
          : [],
        quotations: settledResults[5].status === 'fulfilled'
          ? filterClientSide(settledResults[5].value, ['title', 'status', 'leadName'], searchLower)
          : [],
        deals: settledResults[6].status === 'fulfilled'
          ? filterClientSide(settledResults[6].value, ['name', 'stage', 'companyName'], searchLower)
          : [],
        records: settledResults[7].status === 'fulfilled'
          ? filterClientSide(settledResults[7].value, ['title', 'description', 'status', 'category.name'], searchLower)
          : []
      })

      const availableResults = settledResults.filter(r => {
        if (r.status === 'rejected') {
          return !r.reason?.message?.includes('does not exist') && !r.reason?.code?.includes('PGRST116')
        }
        return true
      })

      const allAvailableFailed = availableResults.length > 0 && availableResults.every(r => r.status === 'rejected')
      if (allAvailableFailed) {
        setError('Failed to search across available databases. Please try again.')
      }
    } catch (err) {
      console.error('Error in searchAll:', err)
      setError(err instanceof Error ? err.message : 'Failed to search')
    } finally {
      setLoading(false)
    }
  }, [siteId, hasCollection])

  const clearSearch = useCallback(() => {
    setSearchResults(EMPTY_RESULTS)
    setError(null)
    setHasInitialized(false)
  }, [])

  return {
    searchResults,
    loading,
    error,
    searchAll,
    clearSearch,
    loadInitialData,
    enabledCollections,
    hasInitialized
  }
}

export default useContextEntitiesSearch
