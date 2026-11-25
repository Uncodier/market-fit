import { useEffect, useState } from "react"
import { SIDEBAR_ROW_GAP, SIDEBAR_ROW_PITCH } from "./sidebar-metrics"

export function calculateShortcutSlots(availableHeight: number, separatorHeight: number) {
  return Math.max(0, Math.floor((availableHeight - separatorHeight + SIDEBAR_ROW_GAP) / SIDEBAR_ROW_PITCH))
}

export function useShortcutSlotCount(
  containerRef: React.RefObject<HTMLElement | null>,
  separatorHeight = 38,
  isCollapsed = false,
  isMobile = false,
) {
  const [slots, setSlots] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    const viewport = container?.closest<HTMLElement>("[data-sidebar-shortcut-viewport]")
    const content = container?.closest<HTMLElement>("[data-sidebar-shortcut-content]")
    if (!container || !viewport || !content) return

    // Mobile scrolls the whole drawer. Its growing shortcut section isn't a
    // height budget, so subtract the fixed sections from the drawer itself.
    const mobileDrawer = isMobile ? viewport.parentElement : null
    const fixedSections = Array.from(mobileDrawer?.children ?? []).filter(section => section !== viewport)

    const updateSlots = () => {
      const panelHeight = mobileDrawer?.clientHeight ?? viewport.clientHeight
      // The closed mobile drawer is hidden; keep the last measured capacity.
      if (mobileDrawer && panelHeight === 0) return
      const reservedHeight = fixedSections.reduce((height, section) => height + section.getBoundingClientRect().height, 0)
      const origin = container.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop
      const bottomPadding = parseFloat(getComputedStyle(content).paddingBottom) || 0
      setSlots(calculateShortcutSlots(panelHeight - reservedHeight - origin - bottomPadding, separatorHeight))
    }

    const resizeObserver = new ResizeObserver(updateSlots)
    resizeObserver.observe(mobileDrawer ?? viewport)
    if (!mobileDrawer) resizeObserver.observe(content)
    for (const section of fixedSections) resizeObserver.observe(section)
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

  return slots
}
