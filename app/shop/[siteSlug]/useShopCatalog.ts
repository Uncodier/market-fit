"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CatalogItem } from "@/app/types"
import { getShopCatalog } from "./actions"
import { flushSync } from "react-dom"
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

/**
 * Next category to fetch while scrolling down.
 * - From the top (windowStart === 0): walk chips in order and finish each one.
 * - After a jump (windowStart > 0): only finish/load from the furthest on-screen
 *   category forward (earlier gaps are backfillAbove's job).
 */
function nextCategoryToLoadBelow(
  offsets: ShopCategoryOffset[],
  items: CatalogItem[],
  completed: Set<string>,
  windowStart: number
): ShopCategoryOffset | null {
  const counts = countItemsByCategory(items)

  if (windowStart <= 0) {
    for (const entry of offsets) {
      if (completed.has(entry.name)) continue
      const loaded = counts.get(entry.name) || 0
      if (loaded < entry.count) return entry
      completed.add(entry.name)
    }
    return null
  }

  let lastPresentIdx = -1
  for (let i = 0; i < offsets.length; i++) {
    const name = offsets[i].name
    if ((counts.get(name) || 0) > 0 || completed.has(name)) {
      lastPresentIdx = i
    }
  }

  if (lastPresentIdx >= 0) {
    const current = offsets[lastPresentIdx]
    if (
      !completed.has(current.name) &&
      (counts.get(current.name) || 0) < current.count
    ) {
      return current
    }
  }

  for (let i = lastPresentIdx + 1; i < offsets.length; i++) {
    const entry = offsets[i]
    if (completed.has(entry.name)) continue
    const loaded = counts.get(entry.name) || 0
    if (loaded < entry.count) return entry
    completed.add(entry.name)
  }
  return null
}

export function useShopCatalog(
  siteId: string,
  initialCatalog: CatalogItem[],
  initialCount: number,
  searchQuery: string,
  categoryOffsets: ShopCategoryOffset[]
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
  const catalogItemsRef = useRef<CatalogItem[]>(initialCatalog)
  const completedCategoriesRef = useRef<Set<string>>(new Set())
  const backfillActiveRef = useRef(false)
  const skipSearchEffect = useRef(true)
  const prevSearch = useRef(searchQuery)
  const categoryOffsetsRef = useRef(categoryOffsets)

  useEffect(() => {
    windowStartRef.current = windowStart
  }, [windowStart])

  useEffect(() => {
    windowEndRef.current = windowEnd
  }, [windowEnd])

  useEffect(() => {
    totalCountRef.current = totalCount
  }, [totalCount])

  useEffect(() => {
    catalogItemsRef.current = catalogItems
  }, [catalogItems])

  useEffect(() => {
    categoryOffsetsRef.current = categoryOffsets
  }, [categoryOffsets])

  const hasMoreCategoryBelow =
    !searchQuery.trim() &&
    categoryOffsets.length > 0 &&
    nextCategoryToLoadBelow(
      categoryOffsets,
      catalogItems,
      new Set(completedCategoriesRef.current),
      windowStart
    ) !== null

  const hasMoreBelow = hasMoreCategoryBelow || windowEnd < totalCount
  const hasMoreAbove = windowStart > 0

  const backfillAbove = useCallback(async (gen: number) => {
    if (backfillActiveRef.current) return
    if (gen !== requestGen.current) return
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

        let anchorId: string | null = null
        let prevViewportTop = 0
        if (typeof document !== "undefined") {
          const anchorEl = document.querySelector('section[id^="shop-category-"]') as HTMLElement
          if (anchorEl) {
            anchorId = anchorEl.id
            prevViewportTop = anchorEl.getBoundingClientRect().top
          }
        }

        flushSync(() => {
          setCatalogItems((curr) => {
            const next = dedupeById([...(result.data as CatalogItem[]), ...curr])
            catalogItemsRef.current = next
            return next
          })
          setWindowStart(prevOffset)
        })
        windowStartRef.current = prevOffset

        if (anchorId && typeof window !== "undefined" && typeof document !== "undefined") {
          const anchorEl = document.getElementById(anchorId)
          if (anchorEl) {
            const currentViewportTop = anchorEl.getBoundingClientRect().top
            const diff = currentViewportTop - prevViewportTop
            // If the element moved in the viewport, scroll by that exact amount to keep it anchored
            if (Math.abs(diff) > 1) {
              window.scrollBy(0, diff)
            }
          }
        }
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

    const gen = requestGen.current
    const offsets = categoryOffsetsRef.current
    const useCategoryPaging = !prevSearch.current.trim() && offsets.length > 0

    if (!useCategoryPaging && windowEndRef.current >= totalCountRef.current) return

    setIsLoadingMore(true)
    try {
      if (useCategoryPaging) {
        const target = nextCategoryToLoadBelow(
          offsets,
          catalogItemsRef.current,
          completedCategoriesRef.current,
          windowStartRef.current
        )
        if (!target) {
          if (windowEndRef.current >= totalCountRef.current) return
        } else {
          const data = await fetchAllCategoryItems(
            siteId,
            target.name,
            () => gen === requestGen.current
          )
          if (gen !== requestGen.current) return

          completedCategoriesRef.current.add(target.name)
          setCatalogItems((curr) => {
            const next = dedupeById([...curr, ...data])
            catalogItemsRef.current = next
            return next
          })
          const nextEnd = Math.max(
            windowEndRef.current,
            target.offset + Math.max(target.count, data.length)
          )
          setWindowEnd(nextEnd)
          windowEndRef.current = nextEnd
          return
        }
      }

      const result = await getShopCatalog(siteId, {
        offset: windowEndRef.current,
        pageSize: SHOP_PAGE_SIZE,
        search: prevSearch.current,
      })
      if (gen !== requestGen.current) return
      if (result.data) {
        const next = result.data as CatalogItem[]
        if (next.length === 0) return
        setCatalogItems((curr) => {
          const merged = dedupeById([...curr, ...next])
          catalogItemsRef.current = merged
          return merged
        })
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
    async (offset: number, categoryName: string, categoryCount = 0) => {
      const gen = ++requestGen.current
      backfillActiveRef.current = false
      setIsJumping(true)
      setIsLoadingMore(false)
      setIsBackfilling(false)
      setPendingScrollCategory(categoryName)

      try {
        const data = await fetchAllCategoryItems(
          siteId,
          categoryName || SHOP_UNCATEGORIZED_NAME,
          () => gen === requestGen.current
        )
        if (gen !== requestGen.current) return

        completedCategoriesRef.current.add(categoryName || SHOP_UNCATEGORIZED_NAME)
        setCatalogItems(data)
        catalogItemsRef.current = data

        const span = Math.max(data.length, categoryCount || 0)
        setWindowStart(offset)
        setWindowEnd(offset + span)
        windowStartRef.current = offset
        windowEndRef.current = offset + span

        if (data.length === 0) {
          setPendingScrollCategory(null)
          return
        }

        setPendingScrollCategory(categoryName)

        if (offset > 0) {
          // Delay backfilling to allow the smooth scroll to finish first
          // Otherwise, instantaneous scroll corrections might cancel the animation.
          setTimeout(() => {
            void backfillAbove(gen)
          }, 1200)
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
    completedCategoriesRef.current = new Set()

    if (!searchQuery) {
      setCatalogItems(initialCatalog)
      catalogItemsRef.current = initialCatalog
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
        catalogItemsRef.current = data
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
