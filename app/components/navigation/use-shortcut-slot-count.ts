import { useEffect, useState } from "react"

const ITEM_HEIGHT = 42 // ~40px item + space
const MIN_SLOTS = 3
const MAX_SLOTS = 8
const DEFAULT_SLOTS = 5

export function useShortcutSlotCount(containerRef: React.RefObject<HTMLElement | null>) {
  const [slots, setSlots] = useState(DEFAULT_SLOTS)

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const container = containerRef.current
    // If we couldn't get a ref, try to find the closest overflow container manually
    const scrollContainer = container 
      ? container.closest('.overflow-y-auto') 
      : document.querySelector('.overflow-y-auto')

    if (!scrollContainer) return

    const updateSlots = () => {
      // Get available height. Subtract some buffer for robots / apps link.
      // This is a heuristic based on the typical layout.
      const availableHeight = scrollContainer.clientHeight
      const buffer = 150 // robots nav items, apps link, margins
      
      const calculatedSlots = Math.floor((availableHeight - buffer) / ITEM_HEIGHT)
      const clampedSlots = Math.max(MIN_SLOTS, Math.min(MAX_SLOTS, calculatedSlots))
      
      setSlots(clampedSlots)
    }

    updateSlots()

    const resizeObserver = new ResizeObserver(() => {
      updateSlots()
    })
    
    resizeObserver.observe(scrollContainer)

    return () => {
      resizeObserver.disconnect()
    }
  }, [containerRef])

  return slots
}
