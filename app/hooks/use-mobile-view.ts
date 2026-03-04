import { useState, useEffect } from "react"
import { ViewType } from "@/app/components/view-selector"

const MOBILE_BREAKPOINT = 768

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(mql.matches)
    setIsMobile(mql.matches)
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
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
