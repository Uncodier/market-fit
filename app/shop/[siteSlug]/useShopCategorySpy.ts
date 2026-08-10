"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { categoryDomId } from "./shop-catalog-shared"

const STICKY_OFFSET_PX = 140

export function useShopCategorySpy(
  categoryNames: string[],
  enabled: boolean
) {
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const isManualClickRef = useRef(false)
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intersectingRef = useRef<Map<string, IntersectionObserverEntry>>(new Map())
  const namesKey = categoryNames.join("|")

  useEffect(() => {
    if (!enabled || categoryNames.length === 0) {
      setActiveCategory("all")
      return
    }

    intersectingRef.current.clear()

    const updateActiveSection = () => {
      if (isManualClickRef.current) return

      const intersecting = Array.from(intersectingRef.current.values()).filter(
        (entry) => entry.isIntersecting
      )

      if (intersecting.length === 0) {
        // Above first section → All
        const first = document.getElementById(categoryDomId(categoryNames[0]))
        if (first && first.getBoundingClientRect().top > STICKY_OFFSET_PX + 40) {
          setActiveCategory((prev) => (prev !== "all" ? "all" : prev))
        }
        return
      }

      const scored = intersecting.map((entry) => {
        const rect = entry.boundingClientRect
        const distanceFromTop = Math.abs(rect.top - STICKY_OFFSET_PX)
        const visibleHeight =
          Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)
        const visibilityRatio = visibleHeight / Math.max(rect.height, 1)
        const score = visibilityRatio * 1000 - distanceFromTop
        return { entry, score }
      })

      scored.sort((a, b) => b.score - a.score)
      const id = scored[0].entry.target.id
      const name =
        categoryNames.find((n) => categoryDomId(n) === id) || "all"
      setActiveCategory((prev) => (prev !== name ? name : prev))
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            intersectingRef.current.set(entry.target.id, entry)
          } else {
            intersectingRef.current.delete(entry.target.id)
          }
        })

        if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)
        updateTimeoutRef.current = setTimeout(updateActiveSection, 80)
      },
      {
        root: null,
        rootMargin: `-${STICKY_OFFSET_PX}px 0px -45% 0px`,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    )

    for (const name of categoryNames) {
      const el = document.getElementById(categoryDomId(name))
      if (el) observer.observe(el)
    }

    return () => {
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current)
      observer.disconnect()
      intersectingRef.current.clear()
    }
    // namesKey tracks categoryNames contents without depending on array identity
  }, [namesKey, enabled, categoryNames])

  const lockManual = useCallback((categoryName: string, durationMs = 1000) => {
    setActiveCategory(categoryName)
    isManualClickRef.current = true
    setTimeout(() => {
      isManualClickRef.current = false
    }, durationMs)
  }, [])

  const scrollToCategory = useCallback(
    (categoryName: string) => {
      if (categoryName === "all") {
        lockManual("all", 800)
        const top =
          document.getElementById("shop-catalog-top")?.offsetTop ?? 0
        window.scrollTo({ top: Math.max(0, top - 80), behavior: "smooth" })
        return true
      }

      const el = document.getElementById(categoryDomId(categoryName))
      if (!el) return false

      lockManual(categoryName, 1000)
      const y = el.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET_PX + 8
      window.scrollTo({ top: y, behavior: "smooth" })
      return true
    },
    [lockManual]
  )

  return { activeCategory, setActiveCategory: lockManual, scrollToCategory }
}
