'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const SLOT_ID = 'page-primary-actions'
function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
function snapshot() { return document.getElementById(SLOT_ID) }
function serverSnapshot() { return null }

/** Keeps page-owned handlers/state while rendering primary actions in the real shell. */
export function TopBarPrimaryActions({ children }: { children: ReactNode }) {
  const slot = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  return slot ? createPortal(children, slot) : null
}

export function TopBarPrimaryActionsSlot() {
  return <div id={SLOT_ID} data-page-primary-actions className="flex shrink-0 items-center gap-2 [&_.btn-primary]:!min-w-0 [&_.btn-primary]:!h-9 [&_.btn-primary]:!px-4" />
}