import { useState, useEffect, useRef } from 'react'
import { CatalogItem } from '@/app/types'

const PAGE_SIZE = 20

function filtersKey(
  searchQuery: string,
  selectedKind: string,
  selectedSubtype: string,
  showOnlyRecurring: boolean,
) {
  return `${searchQuery}|${selectedKind}|${selectedSubtype}|${showOnlyRecurring}`
}

function isDefaultFilters(
  searchQuery: string,
  selectedKind: string,
  selectedSubtype: string,
  showOnlyRecurring: boolean,
  filterParam: string | null,
) {
  const defaultKind = filterParam === 'recurring' ? 'recurring' : 'all'
  return (
    searchQuery === '' &&
    selectedKind === defaultKind &&
    selectedSubtype === 'all' &&
    showOnlyRecurring === (filterParam === 'recurring')
  )
}

export function useMarketplaceProducts(
  initialItems: CatalogItem[],
  initialTotalPages: number,
  searchQuery: string,
  selectedKind: string,
  selectedSubtype: string,
  showOnlyRecurring: boolean,
  filterParam: string | null
) {
  const [page, _setPage] = useState(1)

  const setPage = (p: number) => {
    _setPage(p)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  const [totalPages, setTotalPages] = useState(initialTotalPages)
  const [isLoading, setIsLoading] = useState(false)
  const [items, setItems] = useState<CatalogItem[]>(initialItems)
  const skipInitial = useRef(true)
  const prevFilters = useRef(
    filtersKey(searchQuery, selectedKind, selectedSubtype, showOnlyRecurring)
  )

  useEffect(() => {
    if (skipInitial.current) {
      skipInitial.current = false
      return
    }

    const nextKey = filtersKey(searchQuery, selectedKind, selectedSubtype, showOnlyRecurring)
    if (nextKey !== prevFilters.current) {
      prevFilters.current = nextKey
      if (page !== 1) {
        setPage(1)
        return
      }
    }

    if (page === 1 && isDefaultFilters(searchQuery, selectedKind, selectedSubtype, showOnlyRecurring, filterParam)) {
      setItems(initialItems)
      setTotalPages(initialTotalPages)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', page.toString())
        params.set('limit', String(PAGE_SIZE))

        if (searchQuery) params.set('search', searchQuery)

        const effectiveKind = selectedKind === 'recurring' ? 'all' : selectedKind
        if (effectiveKind !== 'all') params.set('kind', effectiveKind)

        if (effectiveKind === 'digital_asset' && selectedSubtype !== 'all') {
          params.set('digitalSubtype', selectedSubtype)
        }

        if (showOnlyRecurring || selectedKind === 'recurring') {
          params.set('is_recurring', 'true')
        }

        const res = await fetch(`/api/marketplace/products?${params.toString()}`)
        if (!res.ok || cancelled) return
        const { data, totalPages: newTotalPages } = await res.json()
        if (cancelled) return
        setItems(data || [])
        setTotalPages(newTotalPages || 0)
      } catch (err) {
        console.error('Failed to fetch marketplace products:', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [page, searchQuery, selectedKind, selectedSubtype, showOnlyRecurring, filterParam, initialItems, initialTotalPages])

  return { items, page, setPage, totalPages, isLoading }
}
