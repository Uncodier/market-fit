import { useState, useEffect, useRef } from 'react'
import { CatalogItem } from '@/app/types'
import { getShopCatalog } from './actions'

const PAGE_SIZE = 20

export function useShopCatalog(
  siteId: string,
  initialCatalog: CatalogItem[],
  initialTotalPages: number,
  searchQuery: string,
  selectedCategory: string
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
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(initialCatalog)
  const skipInitial = useRef(true)
  const prevFilters = useRef(`${searchQuery}|${selectedCategory}`)

  useEffect(() => {
    if (skipInitial.current) {
      skipInitial.current = false
      return
    }

    const nextKey = `${searchQuery}|${selectedCategory}`
    if (nextKey !== prevFilters.current) {
      prevFilters.current = nextKey
      if (page !== 1) {
        setPage(1)
        return
      }
    }

    if (page === 1 && searchQuery === '' && selectedCategory === 'all') {
      setCatalogItems(initialCatalog)
      setTotalPages(initialTotalPages)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const result = await getShopCatalog(siteId, {
          page,
          pageSize: PAGE_SIZE,
          search: searchQuery,
          category: selectedCategory,
        })
        if (cancelled) return
        if (result.data) {
          setCatalogItems(result.data as CatalogItem[])
          setTotalPages(result.totalPages || 0)
        }
      } catch (err) {
        console.error('Failed to fetch shop catalog:', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [page, searchQuery, selectedCategory, siteId, initialCatalog, initialTotalPages])

  return { catalogItems, page, setPage, totalPages, isLoading }
}
