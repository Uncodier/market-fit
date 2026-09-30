"use client"

import { useLayoutEffect, useRef, useState, type HTMLAttributes } from "react"

// Leave room below the plot instead of filling all the way to the viewport edge.
const REPORT_CHART_BOTTOM_CLEARANCE = 71

/** Fill the report viewport below the bars, headings and preceding widgets. */
export function ReportChartFrame({ children, style, minimumHeight = 0, enabled = true, ...props }: HTMLAttributes<HTMLDivElement> & {
  minimumHeight?: number
  enabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState<number | null>(null)

  useLayoutEffect(() => {
    const frame = ref.current
    const viewport = frame?.closest<HTMLElement>("[data-report-viewport]")
    // Shared charts retain their original size outside Reports. Nested charts
    // inherit their outer frame instead of subtracting the same space twice.
    if (!enabled || !frame || !viewport || frame.parentElement?.closest("[data-report-chart]")) return

    const measure = () => {
      let top = frame.getBoundingClientRect().top + window.scrollY
      for (let parent = frame.parentElement; parent; parent = parent.parentElement) {
        if (parent !== document.body && parent !== document.documentElement) top += parent.scrollTop
      }
      const bottomPadding = Number.parseFloat(getComputedStyle(viewport).paddingBottom) || 0
      setOffset(Math.max(0, Math.ceil(top + bottomPadding + REPORT_CHART_BOTTOM_CLEARANCE)))
    }

    let pending = 0
    const schedule = () => {
      cancelAnimationFrame(pending)
      pending = requestAnimationFrame(measure)
    }
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule)
    // Ancestors and preceding siblings cover wrapping filters, async KPIs,
    // stacked cards and subgrid headers without observing chart SVG mutations.
    for (let node: HTMLElement | null = frame; node; node = node.parentElement) {
      observer?.observe(node)
      for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        observer?.observe(sibling)
      }
    }
    window.addEventListener("resize", schedule)
    measure()
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", schedule)
      cancelAnimationFrame(pending)
    }
  }, [enabled])

  return <div {...props} ref={ref} data-report-chart={enabled ? "" : undefined} style={{
    ...style,
    ...(enabled && offset !== null ? { minHeight: `max(${minimumHeight}px, calc(100dvh - ${offset}px))` } : {}),
  }}>{children}</div>
}