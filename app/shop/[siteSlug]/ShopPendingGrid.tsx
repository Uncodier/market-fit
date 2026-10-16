"use client"

import { memo, useEffect, useRef, useState, type CSSProperties } from "react"
import { commerceProductGridClassName } from "@/app/components/commerce/CommerceProductGrid"
import { CatalogListingCardSkeleton } from "@/app/components/commerce/CatalogListingCardSkeleton"
import { pendingGridLayout, pendingGridStyles, pendingRowWindow } from "./shop-pending-grid-layout"
import { observeShopPlaceholder } from "./shop-placeholder-viewport"
import styles from "./shop-pending-grid.module.css"

const PartialSlot = memo(function PartialSlot({ style, compactMobile }: {
  style: CSSProperties
  compactMobile: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    return observeShopPlaceholder(ref.current, setNear)
  }, [])
  return (
    <div ref={ref} className={styles.partial} style={style} data-shop-partial-slot aria-hidden>
      {near && <div data-shop-placeholder><CatalogListingCardSkeleton compactMobile={compactMobile} stableLayout /></div>}
    </div>
  )
})

export const ShopPendingGrid = memo(function ShopPendingGrid({ loadedCount, pendingCount, compactMobile }: {
  loadedCount: number
  pendingCount: number
  compactMobile: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState({ first: 0, count: 0, top: 0, columns: 1 })
  const layout = pendingGridStyles(loadedCount, pendingCount)
  const { partialCount } = pendingGridLayout(loadedCount, pendingCount, visible.columns)
  // A response may shrink pendingCount before the observer remeasures the region.
  const visibleCount = Math.min(visible.count, Math.max(0, pendingCount - partialCount - visible.first))

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let frame = 0
    let active = false
    let resizeObserver: ResizeObserver | null = null

    const measure = () => {
      frame = 0
      const rect = element.getBoundingClientRect()
      const computed = getComputedStyle(element)
      const columns = Number(computed.getPropertyValue("--shop-columns")) || 1
      const { partialCount, rows } = pendingGridLayout(loadedCount, pendingCount, columns)
      const gap = parseFloat(getComputedStyle(element.parentElement!).rowGap) || 0
      const window = pendingRowWindow({ top: rect.top, height: rect.height, rows, gap, viewportHeight: globalThis.innerHeight })
      const first = window.start * columns
      const count = Math.max(0, Math.min(pendingCount - partialCount, window.end * columns) - first)
      const top = window.start * window.stride
      setVisible((previous) => previous.first === first && previous.count === count && previous.top === top && previous.columns === columns
        ? previous : { first, count, top, columns })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    const stop = () => {
      active = false
      globalThis.removeEventListener("scroll", schedule)
      globalThis.removeEventListener("resize", schedule)
      resizeObserver?.disconnect()
      resizeObserver = null
      cancelAnimationFrame(frame)
      frame = 0
    }
    const unsubscribe = observeShopPlaceholder(element, (near) => {
      if (near && !active) {
        active = true
        globalThis.addEventListener("scroll", schedule, { passive: true })
        globalThis.addEventListener("resize", schedule)
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(schedule)
          resizeObserver.observe(element)
        }
        schedule()
      } else if (!near) {
        stop()
        setVisible((previous) => previous.count ? { ...previous, first: 0, count: 0, top: 0 } : previous)
      }
    })
    return () => { unsubscribe(); stop() }
  }, [loadedCount, pendingCount, compactMobile])

  return (
    <>
      {layout.partial.map((style, index) => <PartialSlot key={index} style={style} compactMobile={compactMobile} />)}
      <div ref={ref} className={styles.rows} style={layout.rows} data-shop-pending-space={pendingCount} aria-hidden>
        {visibleCount > 0 && (
          <div className={`${styles.window} ${commerceProductGridClassName(compactMobile)}`} style={{ top: visible.top }}>
            {Array.from({ length: visibleCount }, (_, index) => (
              <div key={visible.first + index} data-shop-placeholder>
                <CatalogListingCardSkeleton compactMobile={compactMobile} stableLayout />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
})