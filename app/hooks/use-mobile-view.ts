import { useState, useEffect } from "react"
import type { ViewType } from "@/app/components/view-selector"

const MOBILE_BREAKPOINT = 768

/** Unknown until hydration: CSS alone does not stop a hidden component's reads. */
export function useMobileViewport(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(mql.matches)
    setIsMobile(mql.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}

export function useIsMobile(): boolean {
  return useMobileViewport() ?? false
}

/**
 * Returns the appropriate default view type based on screen size.
 * On mobile, always defaults to 'kanban' (card view).
 * On desktop, uses the provided desktopDefault.
 */
export function useMobileView(desktopDefault: ViewType = "table"): [ViewType, (v: ViewType) => void] {
  const isMobile = useIsMobile()
  const [viewType, setViewType] = useState<ViewType>(desktopDefault)

  useEffect(() => {
    if (isMobile) {
      setViewType("kanban")
    }
  }, [isMobile])

  return [viewType, setViewType]
}
