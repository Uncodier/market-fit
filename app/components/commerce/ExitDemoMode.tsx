"use client"

import { useEffect } from "react"
import { exitDemoMode, isDemoModeActive } from "@/lib/demo-utils"
import { usePathname } from 'next/navigation'

/**
 * Clears leftover demo flags on commerce shells, except procurement previews.
 * Cookie is primarily cleared by middleware; this only syncs localStorage.
 * Does not navigate or reload.
 */
export function ExitDemoMode() {
  const pathname = usePathname()
  useEffect(() => {
    if (pathname === '/tenders' || pathname?.startsWith('/tenders/') ||
      pathname === '/home' || pathname?.startsWith('/home/')) return
    if (isDemoModeActive()) {
      exitDemoMode()
    }
  }, [pathname])

  return null
}
