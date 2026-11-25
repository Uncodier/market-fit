import { useEffect, useState } from "react"

export function useCompactMobileDock(route: string, visible: boolean) {
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    setCompact(false)
    if (!visible) return

    const root = document.scrollingElement ?? document.documentElement
    let source = root
    let anchor = Math.max(0, root.scrollTop)
    let collapsed = false

    function onScroll(event: Event) {
      const element = event.target === document ? root : event.target
      if (!(element instanceof HTMLElement)) return
      if (element !== root && (!element.closest("main") || element.closest('textarea, [role="dialog"], [role="listbox"]'))) return

      // Clamp elastic overscroll so the bounce at either edge isn't a reversal.
      const limit = element.scrollHeight - element.clientHeight
      if (limit <= 0) return
      const y = Math.max(0, Math.min(limit, element.scrollTop))
      if (source !== element) {
        source = element
        anchor = y
      }

      // Measure from the most recent turning point, not the last scroll event.
      anchor = collapsed ? Math.max(anchor, y) : Math.min(anchor, y)
      const next = collapsed ? y > 4 && anchor - y < 12 : y - anchor >= 24
      if (next !== collapsed) {
        collapsed = next
        anchor = y
        setCompact(next)
      }
    }

    document.addEventListener("scroll", onScroll, { capture: true, passive: true })
    return () => document.removeEventListener("scroll", onScroll, true)
  }, [route, visible])

  return compact
}