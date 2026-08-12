"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CatalogItem } from "@/app/types"
import { getShopCatalog } from "./actions"
import {
  SHOP_PAGE_SIZE,
  SHOP_UNCATEGORIZED_NAME,
  type ShopCategoryOffset,
} from "./shop-catalog-shared"

function dedupeById(items: CatalogItem[]): CatalogItem[] {
  const seen = new Set<string>()
  const out: CatalogItem[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

/** Fetch every listed parent in a category (paginated). Does not use global offsets. */
async function fetchAllCategoryItems(
  siteId: string,
  categoryName: string,
  isCurrent: () => boolean
): Promise<CatalogItem[]> {
  const pageSize = 100
  let offset = 0
  let total = Number.POSITIVE_INFINITY
  let items: CatalogItem[] = []

  while (offset < total) {
    if (!isCurrent()) return items
    const result = await getShopCatalog(siteId, {
      offset,
      pageSize,
      search: "",
      category: categoryName,
    })
    if (!isCurrent()) return items

    const batch = (result.data || []) as CatalogItem[]
    if (typeof result.count === "number") total = result.count
    if (batch.length === 0) break

    items = dedupeById([...items, ...batch])
    offset += batch.length
    if (batch.length < pageSize) break
  }

  return items
}

export function useShopCatalog(
  siteId: string,
  initialCatalog: CatalogItem[],
  initialCount: number,
  searchQuery: string,
  _categoryOffsets: ShopCategoryOffset[]
) {
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(initialCatalog)
  const [windowStart, setWindowStart] = useState(0)
  const [windowEnd, setWindowEnd] = useState(initialCatalog.length)
  const [totalCount, setTotalCount] = useState(initialCount)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isJumping, setIsJumping] = useState(false)
  const [isBackfilling, setIsBackfilling] = useState(false)
  const [pendingScrollCategory, setPendingScrollCategory] = useState<string | null>(null)

  const requestGen = useRef(0)
  const windowStartRef = useRef(0)
  const windowEndRef = useRef(initialCatalog.length)
  const totalCountRef = useRef(initialCount)
  const backfillActiveRef = useRef(false)
  const skipSearchEffect = useRef(true)
  const prevSearch = useRef(searchQuery)

  useEffect(() => {
    windowStartRef.current = windowStart
  }, [windowStart])

  useEffect(() => {
    windowEndRef.current = windowEnd
  }, [windowEnd])

  useEffect(() => {
    totalCountRef.current = totalCount
  }, [totalCount])

  const hasMoreBelow = windowEnd < totalCount
  const hasMoreAbove = windowStart > 0

  const backfillAbove = useCallback(async (gen: number) => {
    if (backfillActiveRef.current) return
    backfillActiveRef.current = true
    setIsBackfilling(true)

    try {
      while (windowStartRef.current > 0) {
        if (gen !== requestGen.current) return

        const prevOffset = Math.max(0, windowStartRef.current - SHOP_PAGE_SIZE)
        const pageSize = windowStartRef.current - prevOffset
        const result = await getShopCatalog(siteId, {
          offset: prevOffset,
          pageSize,
          search: prevSearch.current,
        })

        if (gen !== requestGen.current) return
        if (!result.data?.length) {
          setWindowStart(0)
          windowStartRef.current = 0
          break
        }

        const prevHeight = typeof document !== "undefined" ? document.documentElement.scrollHeight : 0
        const prevScroll = typeof window !== "undefined" ? window.scrollY : 0

        setCatalogItems((curr) => dedupeById([...(result.data as CatalogItem[]), ...curr]))
        setWindowStart(prevOffset)
        windowStartRef.current = prevOffset

        // Preserve viewport after prepend
        requestAnimationFrame(() => {
          if (typeof document === "undefined" || typeof window === "undefined") return
          const delta = document.documentElement.scrollHeight - prevHeight
          if (delta > 0) {
            window.scrollTo(0, prevScroll + delta)
          }
        })
      }
    } catch (err) {
      console.error("Failed to backfill shop catalog:", err)
    } finally {
      backfillActiveRef.current = false
      if (gen === requestGen.current) {
        setIsBackfilling(false)
      }
    }
  }, [siteId])

  const loadMoreBelow = useCallback(async () => {
    if (isLoadingMore || isJumping || isLoading) return
    if (windowEndRef.current >= totalCountRef.current) return

    const gen = requestGen.current
    setIsLoadingMore(true)
    try {
      const result = await getShopCatalog(siteId, {
        offset: windowEndRef.current,
        pageSize: SHOP_PAGE_SIZE,
        search: prevSearch.current,
      })
      if (gen !== requestGen.current) return
      if (result.data) {
        const next = result.data as CatalogItem[]
        if (next.length === 0) {
          // Empty page — stop paging this window without shrinking totalCount
          // (a transient empty response used to hide later categories forever).
          return
        }
        setCatalogItems((curr) => dedupeById([...curr, ...next]))
        const nextEnd = windowEndRef.current + next.length
        setWindowEnd(nextEnd)
        windowEndRef.current = nextEnd
        if (typeof result.count === "number") {
          setTotalCount(result.count)
          totalCountRef.current = result.count
        }
      }
    } catch (err) {
      console.error("Failed to load more shop catalog:", err)
    } finally {
      if (gen === requestGen.current) {
        setIsLoadingMore(false)
      }
    }
  }, [isLoadingMore, isJumping, isLoading, siteId])

  const jumpToCategory = useCallback(
    async (offset: number, categoryName: string, _categoryCount = 0) => {
      const gen = ++requestGen.current
      backfillActiveRef.current = false
      setIsJumping(true)
      setIsLoadingMore(false)
      setIsBackfilling(false)
      setPendingScrollCategory(categoryName)

      try {
        // Category-scoped fetch (not global offset/pageSize) so far categories
        // like Teas / Tisanes always load every listed parent.
        const data = await fetchAllCategoryItems(
          siteId,
          categoryName || SHOP_UNCATEGORIZED_NAME,
          () => gen === requestGen.current
        )
        if (gen !== requestGen.current) return

        setCatalogItems(data)
        // Keep the global window aligned to this category's catalog position so
        // backfill/load-more still walk the full shop feed around it.
        setWindowStart(offset)
        setWindowEnd(offset + data.length)
        windowStartRef.current = offset
        windowEndRef.current = offset + data.length
        // Do NOT overwrite totalCount with the category-scoped count.

        if (data.length === 0) {
          setPendingScrollCategory(null)
          return
        }

        setPendingScrollCategory(categoryName)

        if (offset > 0) {
          void backfillAbove(gen)
        }
      } catch (err) {
        console.error("Failed to jump shop catalog category:", err)
        setPendingScrollCategory(null)
      } finally {
        if (gen === requestGen.current) {
          setIsJumping(false)
        }
      }
    },
    [siteId, backfillAbove]
  )

  const clearPendingScrollCategory = useCallback(() => {
    setPendingScrollCategory(null)
  }, [])

  // Reset feed when search changes
  useEffect(() => {
    if (skipSearchEffect.current) {
      skipSearchEffect.current = false
      prevSearch.current = searchQuery
      return
    }

    if (prevSearch.current === searchQuery) return
    prevSearch.current = searchQuery

    const gen = ++requestGen.current
    backfillActiveRef.current = false

    if (!searchQuery) {
      setCatalogItems(initialCatalog)
      setWindowStart(0)
      setWindowEnd(initialCatalog.length)
      windowStartRef.current = 0
      windowEndRef.current = initialCatalog.length
      setTotalCount(initialCount)
      totalCountRef.current = initialCount
      setIsLoading(false)
      setIsLoadingMore(false)
      setIsJumping(false)
      setIsBackfilling(false)
      setPendingScrollCategory(null)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setIsLoading(true)
      setIsLoadingMore(false)
      setIsJumping(false)
      setIsBackfilling(false)
      try {
        const result = await getShopCatalog(siteId, {
          offset: 0,
          pageSize: SHOP_PAGE_SIZE,
          search: searchQuery,
        })
        if (cancelled || gen !== requestGen.current) return
        const data = (result.data || []) as CatalogItem[]
        setCatalogItems(data)
        setWindowStart(0)
        setWindowEnd(data.length)
        windowStartRef.current = 0
        windowEndRef.current = data.length
        setTotalCount(result.count || 0)
        totalCountRef.current = result.count || 0
      } catch (err) {
        console.error("Failed to search shop catalog:", err)
      } finally {
        if (!cancelled && gen === requestGen.current) {
          setIsLoading(false)
        }
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchQuery, siteId, initialCatalog, initialCount])

  return {
    catalogItems,
    totalCount,
    isLoading,
    isLoadingMore,
    isJumping,
    isBackfilling,
    hasMoreBelow,
    hasMoreAbove,
    loadMoreBelow,
    jumpToCategory,
    pendingScrollCategory,
    clearPendingScrollCategory,
  }
}
