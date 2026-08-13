"use client"

import { useEffect, useState } from "react"
import { SIDEBAR_PINNED_NAV_KEYS } from "./shortcut-types"

let visibleShortcutKeys: string[] = []
const listeners = new Set<() => void>()

function snapshot(): Set<string> {
  return new Set([...SIDEBAR_PINNED_NAV_KEYS, ...visibleShortcutKeys])
}

/** Published by the sidebar with only the shortcuts currently on screen. */
export function setVisibleSidebarShortcutKeys(keys: string[]) {
  visibleShortcutKeys = keys
  listeners.forEach((listener) => listener())
}

/** Nav item keys currently visible in the sidebar (pinned + on-screen shortcuts). */
export function useSidebarNavKeys(): Set<string> {
  const [keys, setKeys] = useState<Set<string>>(snapshot)

  useEffect(() => {
    const sync = () => setKeys(snapshot())
    sync()
    listeners.add(sync)
    return () => {
      listeners.delete(sync)
    }
  }, [])

  return keys
}
