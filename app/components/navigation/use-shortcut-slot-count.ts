import { useEffect, useState } from "react"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { SIDEBAR_ROW_GAP, SIDEBAR_ROW_PITCH } from "./sidebar-metrics"

export function calculateShortcutSlots(availableHeight: number, separatorHeight: number) {
  return Math.max(0, Math.floor((availableHeight - separatorHeight + SIDEBAR_ROW_GAP) / SIDEBAR_ROW_PITCH))
}

export function useShortcutSlotCount(
  containerRef: React.RefObject<HTMLElement | null>,
  separatorHeight = 38,
  isCollapsed = false,
) {
  const [slots, setSlots] = useState(0)
  const isMobile = useIsMobile()

  useEffect(() => {
    const container = containerRef.current
    const viewport = container?.closest<HTMLElement>("[data-sidebar-shortcut-viewport]")
    const content = container?.closest<HTMLElement>("[data-sidebar-shortcut-content]")
    if (!container || !viewport || !content || isMobile) return

    const updateSlots = () => {
      // The flex viewport excludes the logo, site picker, widgets and footer.
      // Measure the actual shortcut origin, including the visible AI navigation rows.
      const origin = container.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop
      const bottomPadding = parseFloat(getComputedStyle(content).paddingBottom) || 0
      setSlots(calculateShortcutSlots(viewport.clientHeight - origin - bottomPadding, separatorHeight))
    }

    const resizeObserver = new ResizeObserver(updateSlots)
    resizeObserver.observe(viewport)
    resizeObserver.observe(content)
    for (const sibling of container.parentElement?.children ?? []) {
      if (sibling !== container) resizeObserver.observe(sibling)
    }
    const frame = requestAnimationFrame(updateSlots)
    window.addEventListener("resize", updateSlots)
    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateSlots)
    }
  }, [containerRef, isMobile, separatorHeight, isCollapsed])

  // Mobile scrolls the complete menu rather than hiding contextual shortcuts.
  return isMobile ? Number.MAX_SAFE_INTEGER : slots
}
