"use client"

import { useEffect } from "react"
import { DETAIL_VIEW_LEAVE_EVENT } from "@/lib/navigation/detail-view-navigation"

export function useDetailViewLeaveGuard({ busy, dirty = false }: { busy: boolean; dirty?: boolean }) {
  useEffect(() => {
    if (!busy && !dirty) return
    const guard = (event: Event) => {
      if (busy || !window.confirm("Discard your unsaved changes?")) event.preventDefault()
    }
    window.addEventListener(DETAIL_VIEW_LEAVE_EVENT, guard)
    return () => window.removeEventListener(DETAIL_VIEW_LEAVE_EVENT, guard)
  }, [busy, dirty])
}