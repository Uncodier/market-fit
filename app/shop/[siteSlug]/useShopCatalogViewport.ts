"use client"

import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { categoryDomId, type ShopCategoryOffset } from "./shop-catalog-shared"

export type ShopCatalogRequestResult = boolean | undefined | void
type Request = () => ShopCatalogRequestResult | Promise<ShopCatalogRequestResult>
const FEED = "__feed__"

/** Failed reads retry only after leaving/reentering, connectivity recovery, or an explicit retry. */
export function useShopCatalogViewport({
  sections, categoryOffsets, useSections, ready, isSearching, busy, hasMoreBelow,
  sentinelRef, jumpToCategory, loadMoreBelow,
}: {
  sections: { name: string; pendingCount: number }[]
  categoryOffsets: ShopCategoryOffset[]
  useSections: boolean
  ready: boolean
  isSearching: boolean
  busy: boolean
  hasMoreBelow: boolean
  sentinelRef: RefObject<HTMLDivElement | null>
  jumpToCategory: (offset: number, name: string, count?: number, scroll?: boolean) => ShopCatalogRequestResult | Promise<ShopCatalogRequestResult>
  loadMoreBelow: Request
}) {
  const requested = useRef(new Set<string>())
  const failures = useRef(new Set<string>())
  const nearby = useRef(new Set<string>())
  const inFlight = useRef(false)
  const generation = useRef(0)
  const [failedCategories, setFailedCategories] = useState<string[]>([])
  const invalidate = useCallback(() => { generation.current++; inFlight.current = false }, [])

  const retry = useCallback(() => {
    for (const name of failures.current) requested.current.delete(name)
    failures.current.clear()
    setFailedCategories([])
  }, [])

  useEffect(() => {
    window.addEventListener("online", retry)
    return () => window.removeEventListener("online", retry)
  }, [retry])

  useEffect(() => {
    invalidate()
    requested.current.clear()
    failures.current.clear()
    nearby.current.clear()
    // Search responses never share automatic request bookkeeping with the catalog.
    const frame = requestAnimationFrame(() => setFailedCategories([]))
    return () => { invalidate(); cancelAnimationFrame(frame) }
  }, [isSearching, invalidate])

  const hasPending = useSections && sections.some((section) => section.pendingCount > 0)
  useEffect(() => {
    if (busy || (useSections && !ready) || typeof IntersectionObserver === "undefined") return
    const gen = generation.current
    const invoke = async (name: string, request: Request) => {
      requested.current.add(name)
      inFlight.current = true
      try {
        const result = await request()
        if (gen !== generation.current) return
        if (result === false) throw new Error("Catalog request failed")
        if (result === undefined) requested.current.delete(name)
      } catch {
        if (gen !== generation.current) return
        failures.current.add(name)
        setFailedCategories([...failures.current])
      } finally {
        if (gen === generation.current) {
          inFlight.current = false
          if (name === FEED) requested.current.delete(name)
        }
      }
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const name = (entry.target as HTMLElement).dataset.shopCategory || FEED
        if (!entry.isIntersecting) {
          if (nearby.current.delete(name) && failures.current.delete(name)) {
            requested.current.delete(name)
            setFailedCategories([...failures.current])
          }
        } else nearby.current.add(name)
      }
      if (inFlight.current) return
      const entry = entries.find((candidate) => {
        const name = (candidate.target as HTMLElement).dataset.shopCategory || FEED
        return candidate.isIntersecting && !requested.current.has(name) && !failures.current.has(name)
      })
      if (!entry) return
      const name = (entry.target as HTMLElement).dataset.shopCategory
      if (name) {
        const category = categoryOffsets.find((candidate) => candidate.name === name)
        if (category) void invoke(name, () => jumpToCategory(category.offset, name, category.count, false))
      } else if (hasMoreBelow) void invoke(FEED, loadMoreBelow)
    }, { rootMargin: "240px 0px", threshold: 0 })

    if (hasPending) {
      for (const section of sections) {
        if (!section.pendingCount || (requested.current.has(section.name) && !failures.current.has(section.name))) continue
        const element = document.getElementById(categoryDomId(section.name))
        if (element) observer.observe(element)
      }
    } else if (hasMoreBelow && sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [sections, categoryOffsets, useSections, ready, busy, hasPending, hasMoreBelow, sentinelRef, jumpToCategory, loadMoreBelow, failedCategories])

  return { failedCategories, retry }
}