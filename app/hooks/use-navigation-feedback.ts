"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { isPosDocument } from "@/lib/navigation/document-reload-policy"
import {
  cancelNavigationWatchdog,
  getNavigationFeedback,
  recoverPendingNavigation,
  subscribeNavigationFeedback,
} from "@/lib/navigation/stale-router"

const TOAST_ID = "navigation-progress"

/** Navigation feedback is non-blocking; document recovery always requires consent. */
export function useNavigationFeedback(): void {
  const pathname = usePathname()
  const search = useSearchParams().toString()

  useEffect(() => {
    cancelNavigationWatchdog()
  }, [pathname, search])

  useEffect(() => {
    const update = () => {
      const feedback = getNavigationFeedback()
      if (!feedback) {
        toast.dismiss(TOAST_ID)
      } else if (feedback.status === "pending") {
        toast.loading("Opening page…", {
          id: TOAST_ID, duration: Infinity, action: undefined, description: undefined,
        })
      } else {
        const posOpen = isPosDocument(window.location.pathname)
        toast.warning("Navigation is taking longer than expected", {
          id: TOAST_ID,
          duration: Infinity,
          description: posOpen
            ? "You can keep waiting. Page reload is unavailable while POS is open."
            : "You can keep waiting. Reloading may discard unsaved changes.",
          action: posOpen ? undefined : {
            label: "Reload page",
            onClick: () => recoverPendingNavigation(feedback.id),
          },
        })
      }
    }
    const unsubscribe = subscribeNavigationFeedback(update)
    update()
    return () => {
      unsubscribe()
      cancelNavigationWatchdog()
      toast.dismiss(TOAST_ID)
    }
  }, [])
}