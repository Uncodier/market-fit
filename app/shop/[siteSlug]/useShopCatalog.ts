"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CatalogItem } from "@/app/types"
import { getShopCatalog } from "./actions"
import {
  countItemsByCategory,
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

/** Category responses can overlap the initial page. Preserve loaded cards and listing order. */
function mergeCatalogItems(current: CatalogItem[], incoming: CatalogItem[]): CatalogItem[] {
  return dedupeById([...incoming, ...current]).sort((a, b) => {
    const sortOrder = (a.sort_order ?? Number.POSITIVE_INFINITY) - (b.sort_order ?? Number.POSITIVE_INFINITY)
    return (Number.isNaN(sortOrder) ? 0 : sortOrder) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
  })
}

/** Fetch every listed parent in a category (paginated). Does not use global offsets. */
async function fetchAllCategoryItems(
  siteId: string,
  categoryName: string,
  isCurrent: () => boolean
): Promise<{ items: CatalogItem[]; count: number } | undefined> {
  const pageSize = 100
  let offset = 0
  let total = Number.POSITIVE_INFINITY
  let items: CatalogItem[] = []

  while (offset < total) {
    if (!isCurrent()) return undefined
    const result = await getShopCatalog(siteId, {
      offset,
      pageSize,
      search: "",
      category: categoryName,
    })
    if (!isCurrent()) return undefined
    if (result.error || !Array.isArray(result.data) || !Number.isSafeInteger(result.count) || result.count < 0) {
      throw new Error("Failed to load shop category")
    }

    const batch = (result.data || []) as CatalogItem[]
    total = result.count
    if (batch.length === 0 && offset < total) throw new Error("Incomplete shop category")

    items = dedupeById([...items, ...batch])
    offset += batch.length
  }

  if (items.length !== total) throw new Error("Incomplete shop category")
  return { items, count: total }
}

/** First category with unloaded listing items, regardless of previous jumps. */
function nextCategoryToLoadBelow(
  offsets: ShopCategoryOffset[],
  items: CatalogItem[],
  completed: Set<string>
): ShopCategoryOffset | null {
  const counts = countItemsByCategory(items)
  for (const entry of offsets) {
    if (completed.has(entry.name)) continue
    const loaded = counts.get(entry.name) || 0
    if (loaded < entry.count) return entry
  }
  return null
}

/** Existing offsets are first-seen global positions, not cumulative category spans. */
function reconcileCategoryOffsets(
  offsets: ShopCategoryOffset[],
  items: CatalogItem[],
  authoritative?: ShopCategoryOffset,
  incoming: CatalogItem[] = [],
  globalOffset = 0
): ShopCategoryOffset[] {
  const counts = countItemsByCategory(items)
  const next = offsets.map((entry) => ({
    ...entry,
    count: entry.name === authoritative?.name ? authoritative.count : Math.max(entry.count, counts.get(entry.name) || 0),
  }))
  const known = new Set(next.map((entry) => entry.name))
  for (const [index, item] of incoming.entries()) {
    const name = item._shop?.categoryName || SHOP_UNCATEGORIZED_NAME
    if (known.has(name)) continue
    next.push({ name, offset: globalOffset + index, count: counts.get(name) || 0 })
    known.add(name)
  }
  if (authoritative && !known.has(authoritative.name)) next.push(authoritative)
  return next
}

function sumCategoryCounts(offsets: ShopCategoryOffset[]): number {
  return offsets.reduce((sum, entry) => sum + entry.count, 0)
}

export function useShopCatalog(
  siteId: string,
  initialCatalog: CatalogItem[],
  initialCount: number,
  searchQuery: string,
  initialCategoryOffsets: ShopCategoryOffset[]
) {
  const initialOffsets = useMemo(() => reconcileCategoryOffsets(initialCategoryOffsets, initialCatalog, undefined, initialCatalog),
    [initialCategoryOffsets, initialCatalog])
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>(initialCatalog)
  const [windowEnd, setWindowEnd] = useState(initialCatalog.length)
  const [totalCount, setTotalCount] = useState(initialCount)
  const [categoryOffsets, setCategoryOffsets] = useState(initialOffsets)
  const [globalTotalCount, setGlobalTotalCount] = useState(initialCount)
  const [hasGlobalGap, setHasGlobalGap] = useState(initialCount !== sumCategoryCounts(initialOffsets))
  const [isLoading, setIsLoading] = useState(false)
  const [searchError, setSearchError] = useState<string>()
  const [searchAttempt, setSearchAttempt] = useState(0)
  const previousSearchAttempt = useRef(searchAttempt)
  const searchId = useRef<string | undefined>(undefined)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isJumping, setIsJumping] = useState(false)
  const [pendingScrollCategory, setPendingScrollCategory] = useState<string | null>(null)

  const requestGen = useRef(0)
  const windowEndRef = useRef(initialCatalog.length)
  const totalCountRef = useRef(initialCount)
  const catalogItemsRef = useRef<CatalogItem[]>(initialCatalog)
  const completedCategoriesRef = useRef<Set<string>>(new Set())
  const skipSearchEffect = useRef(true)
  const prevSearch = useRef(searchQuery)
  const prevSite = useRef(siteId)
  const categoryOffsetsRef = useRef(initialOffsets)
  const globalTotalCountRef = useRef(initialCount)
  const requestBusyRef = useRef(false)

  useEffect(() => {
    windowEndRef.current = windowEnd
  }, [windowEnd])

  useEffect(() => {
    totalCountRef.current = totalCount
  }, [totalCount])

  useEffect(() => {
    catalogItemsRef.current = catalogItems
  }, [catalogItems])

  useEffect(() => () => { requestGen.current += 1 }, [siteId])

  const applyCategory = useCallback((name: string, offset: number, data: { items: CatalogItem[]; count: number }) => {
    const retained = catalogItemsRef.current.filter((item) => (item._shop?.categoryName || SHOP_UNCATEGORIZED_NAME) !== name)
    const next = mergeCatalogItems(retained, data.items)
    const nextOffsets = reconcileCategoryOffsets(categoryOffsetsRef.current, next, { name, offset, count: data.count })
    completedCategoriesRef.current.add(name)
    catalogItemsRef.current = next
    categoryOffsetsRef.current = nextOffsets
    totalCountRef.current = sumCategoryCounts(nextOffsets)
    setCatalogItems(next)
    setCategoryOffsets(nextOffsets)
    setTotalCount(totalCountRef.current)
    // Category positions cannot extend the contiguous global feed cursor.
  }, [])

  const hasMoreCategoryBelow =
    !searchQuery.trim() &&
    categoryOffsets.length > 0 &&
    nextCategoryToLoadBelow(
      categoryOffsets,
      catalogItems,
      new Set(completedCategoriesRef.current)
    ) !== null

  const hasMoreBelow = hasMoreCategoryBelow || (searchQuery.trim() || categoryOffsets.length === 0
    ? windowEnd < totalCount
    : hasGlobalGap && windowEnd < globalTotalCount)

  const loadMoreBelow = useCallback(async (): Promise<boolean | undefined> => {
    if (requestBusyRef.current || isLoadingMore || isJumping || isLoading) return undefined

    const gen = requestGen.current
    const offsets = categoryOffsetsRef.current
    const useCategoryPaging = !prevSearch.current.trim() && offsets.length > 0

    if (!hasMoreBelow) return undefined

    requestBusyRef.current = true
    setIsLoadingMore(true)
    try {
      if (useCategoryPaging) {
        const target = nextCategoryToLoadBelow(
          offsets,
          catalogItemsRef.current,
          completedCategoriesRef.current
        )
        if (!target) {
          if (windowEndRef.current >= globalTotalCountRef.current) return undefined
        } else {
          const data = await fetchAllCategoryItems(
            siteId,
            target.name,
            () => gen === requestGen.current
          )
          if (gen !== requestGen.current || !data) return undefined
          applyCategory(target.name, target.offset, data)
          return true
        }
      }

      const result = await getShopCatalog(siteId, {
        offset: windowEndRef.current,
        pageSize: SHOP_PAGE_SIZE,
        search: prevSearch.current,
      })
      if (gen !== requestGen.current) return undefined
      if (result.error || !Array.isArray(result.data)) throw new Error("Failed to load shop catalog page")
      if (prevSearch.current.trim() && searchId.current &&
        (!("search_id" in result) || result.search_id !== searchId.current)) {
        setSearchError("Catalog search changed. Please try again.")
        return false
      }
      if (result.data) {
        const next = result.data as CatalogItem[]
        const count = typeof result.count === "number" ? result.count : totalCountRef.current
        if (next.length === 0 && windowEndRef.current < count) throw new Error("Incomplete shop catalog page")
        const merged = dedupeById([...catalogItemsRef.current, ...next])
        catalogItemsRef.current = merged
        setCatalogItems(merged)
        if (!prevSearch.current.trim()) {
          const nextOffsets = reconcileCategoryOffsets(categoryOffsetsRef.current, merged, undefined, next, windowEndRef.current)
          categoryOffsetsRef.current = nextOffsets
          setCategoryOffsets(nextOffsets)
          if (count !== sumCategoryCounts(nextOffsets)) setHasGlobalGap(true)
        }
        const nextEnd = windowEndRef.current + next.length
        setWindowEnd(nextEnd)
        windowEndRef.current = nextEnd
        if (typeof result.count === "number") {
          setTotalCount(result.count)
          totalCountRef.current = result.count
          setGlobalTotalCount(result.count)
          globalTotalCountRef.current = result.count
        }
      }
      return true
    } catch (err) {
      if (gen !== requestGen.current) return undefined
      console.error("Failed to load more shop catalog:", err)
      return false
    } finally {
      if (gen === requestGen.current) {
        requestBusyRef.current = false
        setIsLoadingMore(false)
      }
    }
  }, [isLoadingMore, isJumping, isLoading, siteId, hasMoreBelow, applyCategory])

  const jumpToCategory = useCallback(
    async (offset: number, categoryName: string, categoryCount = 0, scrollToTarget = true): Promise<boolean | undefined> => {
      // Preserve the call signature; only the complete response can authorize a count.
      void categoryCount
      const gen = ++requestGen.current
      requestBusyRef.current = true
      setIsJumping(scrollToTarget)
      setIsLoading(false)
      setIsLoadingMore(!scrollToTarget)
      setPendingScrollCategory(scrollToTarget ? categoryName : null)

      try {
        const data = await fetchAllCategoryItems(
          siteId,
          categoryName || SHOP_UNCATEGORIZED_NAME,
          () => gen === requestGen.current
        )
        if (gen !== requestGen.current || !data) return undefined
        applyCategory(categoryName || SHOP_UNCATEGORIZED_NAME, offset, data)

        if (data.items.length === 0) {
          setPendingScrollCategory(null)
        }
        return true
      } catch (err) {
        if (gen !== requestGen.current) return undefined
        console.error("Failed to jump shop catalog category:", err)
        setPendingScrollCategory(null)
        return false
      } finally {
        if (gen === requestGen.current) {
          requestBusyRef.current = false
          setIsJumping(false)
          setIsLoadingMore(false)
        }
      }
    },
    [siteId, applyCategory]
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

    if (prevSearch.current === searchQuery && prevSite.current === siteId && previousSearchAttempt.current === searchAttempt) return
    previousSearchAttempt.current = searchAttempt
    prevSearch.current = searchQuery
    prevSite.current = siteId

    const gen = ++requestGen.current
    requestBusyRef.current = false
    completedCategoriesRef.current = new Set()
    searchId.current = undefined
    setSearchError(undefined)

    if (!searchQuery.trim()) {
      setCatalogItems(initialCatalog)
      catalogItemsRef.current = initialCatalog
      setWindowEnd(initialCatalog.length)
      windowEndRef.current = initialCatalog.length
      setTotalCount(initialCount)
      totalCountRef.current = initialCount
      setCategoryOffsets(initialOffsets)
      categoryOffsetsRef.current = initialOffsets
      setGlobalTotalCount(initialCount)
      globalTotalCountRef.current = initialCount
      setHasGlobalGap(initialCount !== sumCategoryCounts(initialOffsets))
      setIsLoading(false)
      setIsLoadingMore(false)
      setIsJumping(false)
      setPendingScrollCategory(null)
      return
    }

    setCatalogItems([])
    catalogItemsRef.current = []
    setTotalCount(0)
    totalCountRef.current = 0
    setWindowEnd(0)
    windowEndRef.current = 0
    setIsLoading(true)
    let cancelled = false
    const timer = setTimeout(async () => {
      setIsLoading(true)
      setIsLoadingMore(false)
      setIsJumping(false)
      try {
        const result = await getShopCatalog(siteId, {
          offset: 0,
          pageSize: SHOP_PAGE_SIZE,
          search: searchQuery,
        })
        if (cancelled || gen !== requestGen.current) return
        if (result.error || !Array.isArray(result.data)) throw new Error("Unable to search this shop")
        searchId.current = "search_id" in result ? result.search_id as string : undefined
        const data = (result.data || []) as CatalogItem[]
        setCatalogItems(data)
        catalogItemsRef.current = data
        setWindowEnd(data.length)
        windowEndRef.current = data.length
        setTotalCount(result.count || 0)
        totalCountRef.current = result.count || 0
        setGlobalTotalCount(result.count || 0)
        globalTotalCountRef.current = result.count || 0
      } catch (err) {
        if (!cancelled && gen === requestGen.current) setSearchError("Unable to search this shop. Please try again.")
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
  }, [searchQuery, siteId, initialCatalog, initialCount, initialOffsets, searchAttempt])

  return {
    catalogItems,
    totalCount,
    categoryOffsets,
    isLoading,
    searchError,
    retrySearch: () => setSearchAttempt(attempt => attempt + 1),
    isLoadingMore,
    isJumping,
    hasMoreBelow,
    loadMoreBelow,
    jumpToCategory,
    pendingScrollCategory,
    clearPendingScrollCategory,
  }
}
