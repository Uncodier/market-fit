"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { getVisibleTabIndices } from "./responsive-tabs-fit"

export function useResponsiveTabsFit(
  tabCount: number,
  activeIndex: number,
  content: unknown,
  onPreferredWidthChange?: (width: number) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  const [visibleIndices, setVisibleIndices] = useState<number[] | null>(null)
  const preferredWidthRef = useRef<number | null>(null)

  // Measure committed DOM, including responsive styles and late font/content changes.
  useLayoutEffect(() => {
    const container = containerRef.current
    const measurement = measurementRef.current
    if (!container || !measurement) return
    let disposed = false
    const measure = () => {
      if (disposed) return
      const containerStyle = getComputedStyle(container)
      const pixels = (value: string) => Number.parseFloat(value) || 0
      const availableWidth = container.clientWidth - pixels(containerStyle.paddingLeft) -
        pixels(containerStyle.paddingRight)
      if (availableWidth <= 0) return
      const style = getComputedStyle(measurement)
      const chromeWidth = pixels(style.paddingLeft) + pixels(style.paddingRight) +
        pixels(style.borderLeftWidth) + pixels(style.borderRightWidth)
      const gap = pixels(style.columnGap)
      const widths = Array.from(measurement.querySelectorAll<HTMLElement>("[data-tab-measure]"))
        .map(element => element.getBoundingClientRect().width)
      const overflow = measurement.querySelector<HTMLElement>("[data-overflow-measure]")
      const counter = overflow?.querySelector<HTMLElement>("[data-overflow-count]")
      if (widths.length !== tabCount || !overflow || !counter) return
      const overflowWidths = [0]
      for (let count = 1; count <= tabCount; count++) {
        counter.textContent = String(count)
        overflowWidths[count] = overflow.getBoundingClientRect().width
      }
      const preferredWidth = chromeWidth + widths.reduce((sum, width) => sum + width, 0) +
        Math.max(0, tabCount - 1) * gap
      if (preferredWidth !== preferredWidthRef.current) {
        preferredWidthRef.current = preferredWidth
        onPreferredWidthChange?.(preferredWidth)
      }
      const next = getVisibleTabIndices({ widths, availableWidth, chromeWidth, gap,
        activeIndex, overflowWidths })
      setVisibleIndices(previous => previous?.length === next.length &&
        previous.every((value, index) => value === next[index]) ? previous : next)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(measurement)
    measurement.querySelectorAll<HTMLElement>("[data-tab-measure]").forEach(element => observer.observe(element))
    window.addEventListener("resize", measure)
    document.fonts?.addEventListener("loadingdone", measure)
    void document.fonts?.ready.then(measure)
    return () => {
      disposed = true
      observer.disconnect()
      window.removeEventListener("resize", measure)
      document.fonts?.removeEventListener("loadingdone", measure)
    }
  }, [tabCount, activeIndex, content, onPreferredWidthChange])

  return { containerRef, measurementRef, visibleIndices }
}