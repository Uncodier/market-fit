"use client"

import { useEffect } from "react"
import { exitDemoMode, isDemoModeActive } from "@/lib/demo-utils"

/**
 * Clears leftover demo flags when mounting any commerce shell.
 * Cookie is primarily cleared by middleware; this only syncs localStorage.
 * Does not navigate or reload.
 */
export function ExitDemoMode() {
  useEffect(() => {
    if (isDemoModeActive()) {
      exitDemoMode()
    }
  }, [])

  return null
}
