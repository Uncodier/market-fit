import { useState, useEffect, useRef } from 'react'
import type { CatalogItem } from '@/app/types'
import type { BuyerGeo } from '@/app/commerce/buyer-geo'
import { parseMarketplaceSort, type MarketplaceSort } from './marketplace-sort'
import type { MarketplaceListingFilters, MarketplaceRegion } from './marketplace-product-filters'
import { buildMarketplaceListingFilterSearch } from './marketplace-filter-url'
import { MARKETPLACE_PAGE_SIZE } from './marketplace-pagination'
import { useSearchPagination } from '@/lib/catalog-search/use-search-pagination'

const GEO_FIELDS = ['city', 'state', 'country', 'zip', 'latitude', 'longitude'] as const
const EMPTY_REGIONS: MarketplaceRegion[] = []

function isDefaultFilters(
  searchQuery: string,
  selectedKind: string,
  selectedSubtype: string,
  showOnlyRecurring: boolean,
  sort: MarketplaceSort,
  geoSearch: string,
) {
  return (
    searchQuery === '' &&
    selectedKind === 'all' &&
    selectedSubtype === 'all' &&
    !showOnlyRecurring &&
    sort === 'featured' &&
    geoSearch === ''
  )
}

export function useMarketplaceProducts(
  initialItems: CatalogItem[],
  initialTotalPages: number,
  searchQuery: string,
  selectedKind: string,
  selectedSubtype: string,
  showOnlyRecurring: boolean,
  selectedSort: MarketplaceSort = 'featured',
  buyerGeo?: BuyerGeo,
  listingFilters?: MarketplaceListingFilters,
  initialRegions: MarketplaceRegion[] = EMPTY_REGIONS,
  initialCount: number = initialItems.length,
  siteId?: string,
) {
  const sort = parseMarketplaceSort(selectedSort)
  const geoParams = new URLSearchParams()
  for (const field of GEO_FIELDS) {
    const value = buyerGeo?.[field]
    if (value) geoParams.set(field, value)
  }
  const geoSearch = geoParams.toString()
  const listingSearch = buildMarketplaceListingFilterSearch('', listingFilters || {})
  const defaultFilters = isDefaultFilters(
    searchQuery, selectedKind, selectedSubtype, showOnlyRecurring, sort, geoSearch,
  ) && listingSearch === '' && !siteId
  const nextKey = JSON.stringify([
    searchQuery, selectedKind, selectedSubtype, showOnlyRecurring, sort, geoSearch, listingSearch, siteId,
  ])
  const { page, setPage: _setPage, searchId, acceptSearchId, restart, generation } = useSearchPagination(nextKey, Boolean(searchQuery.trim()))

  const setPage = (p: number) => {
    _setPage(p)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [isLoading, setIsLoading] = useState(!defaultFilters)
  const [items, setItems] = useState<CatalogItem[]>(initialItems)
  const [count, setCount] = useState(defaultFilters ? initialCount : 0)
  const [regions, setRegions] = useState<MarketplaceRegion[]>(defaultFilters ? initialRegions : EMPTY_REGIONS)
  const [error, setError] = useState<string>()
  const [requestVersion, setRequestVersion] = useState(0)
  const prevFilters = useRef(nextKey)

  useEffect(() => {
    if (nextKey !== prevFilters.current) {
      prevFilters.current = nextKey
      if (page !== 1) {
        setIsLoading(!defaultFilters)
        setPage(1)
        return
      }
    }

    // SSR is a global featured page, never a location-aware or custom sorted page.
    if (page === 1 && defaultFilters) {
      setItems(initialItems)
      setTotalPages(initialTotalPages)
      setCount(initialCount)
      setRegions(initialRegions)
      setError(undefined)
      setIsLoading(false)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setIsLoading(true)
    setCount(0)
    setRegions(EMPTY_REGIONS)
    setTotalPages(0)
    setError(undefined)
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams(geoSearch)
        new URLSearchParams(listingSearch).forEach((value, key) => params.set(key, value))
        params.set('page', page.toString())
        params.set('limit', String(MARKETPLACE_PAGE_SIZE))
        params.set('sort', sort)

        if (searchQuery) {
          params.set('search', searchQuery)
          if (searchId) params.set('search_id', searchId)
        }
        if (siteId) params.set('siteId', siteId)

        const effectiveKind = selectedKind === 'recurring' ? 'all' : selectedKind
        if (effectiveKind !== 'all') params.set('kind', effectiveKind)

        if (effectiveKind === 'digital_asset' && selectedSubtype !== 'all') {
          params.set('digitalSubtype', selectedSubtype)
        }

        if (showOnlyRecurring || selectedKind === 'recurring') {
          params.set('is_recurring', 'true')
        }

        const res = await fetch(`/api/marketplace/products?${params.toString()}`, {
          signal: controller.signal,
        })
        if (cancelled) return
        if (res.status === 409 && searchQuery.trim()) {
          setItems([])
          restart()
          return
        }
        if (!res.ok) throw new Error('Marketplace request failed')
        const { data, totalPages: newTotalPages, count: newCount, regions: newRegions, search_id: newSearchId } = await res.json()
        if (cancelled) return
        setItems(data || [])
        acceptSearchId(newSearchId)
        setTotalPages(newTotalPages || 0)
        setCount(typeof newCount === 'number' ? newCount : 0)
        setRegions(Array.isArray(newRegions) ? newRegions : EMPTY_REGIONS)
      } catch (err) {
        if (!cancelled) {
          setError('Could not load marketplace products. Please try again.')
          console.error('Failed to fetch marketplace products:', err)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [page, searchQuery, selectedKind, selectedSubtype, showOnlyRecurring, sort, geoSearch,
    nextKey, defaultFilters, initialItems, initialTotalPages, initialCount, initialRegions, listingSearch, requestVersion, generation, siteId])

  return { items, page, setPage, totalPages, isLoading, count, regions, error,
    retry: () => setRequestVersion((version) => version + 1) }
}
