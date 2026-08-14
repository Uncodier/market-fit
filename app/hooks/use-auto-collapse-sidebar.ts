"use client"

import { useEffect, useRef, useState } from "react"

export const MOBILE_BREAKPOINT = 768
export const INNER_SIDEBAR_COLLAPSE_BREAKPOINT = 1280

export function shouldCollapseInnerSidebar(
  width: number,
  mobileBreakpoint = MOBILE_BREAKPOINT,
  collapseBreakpoint = INNER_SIDEBAR_COLLAPSE_BREAKPOINT
): boolean {
  return width >= mobileBreakpoint && width < collapseBreakpoint
}

/**
 * Auto-collapses an inner sidebar (chat list, task categories) on compact
 * desktop widths. Mobile layout is left unchanged. Users can still expand
 * manually; the next time the compact threshold is crossed, it collapses again.
 */
export function useAutoCollapseSidebar(
  collapseBreakpoint = INNER_SIDEBAR_COLLAPSE_BREAKPOINT
) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const hasAutoCollapsedRef = useRef(false)
  const userManuallyExpandedRef = useRef(false)
  const previousWidthRef = useRef<number | null>(null)

  useEffect(() => {
    const handleResize = () => {
      const currentWidth = window.innerWidth
      const previousWidth = previousWidthRef.current

      if (previousWidth === null) {
        previousWidthRef.current = currentWidth
        return
      }

      const wasCompact = shouldCollapseInnerSidebar(previousWidth, MOBILE_BREAKPOINT, collapseBreakpoint)
      const isCompact = shouldCollapseInnerSidebar(currentWidth, MOBILE_BREAKPOINT, collapseBreakpoint)

      if (!wasCompact && isCompact && !hasAutoCollapsedRef.current && !userManuallyExpandedRef.current) {
        setIsCollapsed(true)
        hasAutoCollapsedRef.current = true
      }

      if (wasCompact && !isCompact) {
        hasAutoCollapsedRef.current = false
        userManuallyExpandedRef.current = false
      }

      previousWidthRef.current = currentWidth
    }

    const initialWidth = window.innerWidth
    previousWidthRef.current = initialWidth

    if (shouldCollapseInnerSidebar(initialWidth, MOBILE_BREAKPOINT, collapseBreakpoint)) {
      setIsCollapsed(true)
      hasAutoCollapsedRef.current = true
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [collapseBreakpoint])

  useEffect(() => {
    if (hasAutoCollapsedRef.current && !isCollapsed) {
      userManuallyExpandedRef.current = true
    }
  }, [isCollapsed])

  return [isCollapsed, setIsCollapsed] as const
}
