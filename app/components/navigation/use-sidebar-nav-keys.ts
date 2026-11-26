"use client"

import { useEffect, useState } from "react"
import { useMobileViewport } from "@/app/hooks/use-mobile-view"
import { SIDEBAR_PINNED_NAV_KEYS } from "./shortcut-types"

let visibleShortcutKeys: string[] = []
const listeners = new Set<() => void>()

/** Published by the sidebar with only the shortcuts currently on screen. */
export function setVisibleSidebarShortcutKeys(keys: string[]) {
  visibleShortcutKeys = keys
  listeners.forEach((listener) => listener())
}

/** Nav item keys currently visible in the sidebar (pinned + on-screen shortcuts). */
export function useSidebarNavKeys(): Set<string> {
  const isMobile = useMobileViewport()
  const [shortcutKeys, setShortcutKeys] = useState(visibleShortcutKeys)

  useEffect(() => {
    const sync = () => setShortcutKeys(visibleShortcutKeys)
    sync()
    listeners.add(sync)
    return () => {
      listeners.delete(sync)
    }
  }, [])

  return new Set(isMobile ? shortcutKeys : [...SIDEBAR_PINNED_NAV_KEYS, ...shortcutKeys])
}
