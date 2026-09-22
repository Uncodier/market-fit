import type { ReactNode } from "react"
import type { ShortcutRecord } from "./shortcut-types"

interface ShortcutDropSectionsProps {
  pinnedShortcuts: ShortcutRecord[]
  pinnedOverview?: ShortcutRecord
  recentShortcuts: ShortcutRecord[]
  isOverPinned: boolean
  isOverRecent: boolean
  setPinnedDropRef: (node: HTMLElement | null) => void
  setRecentDropRef: (node: HTMLElement | null) => void
  renderShortcut: (entry: ShortcutRecord) => ReactNode
}

export function ShortcutDropSections({
  pinnedShortcuts,
  pinnedOverview,
  recentShortcuts,
  isOverPinned,
  isOverRecent,
  setPinnedDropRef,
  setRecentDropRef,
  renderShortcut,
}: ShortcutDropSectionsProps) {
  return (
    <>
      <div
        ref={setPinnedDropRef}
        className={`flex min-h-1 w-full flex-col space-y-1 rounded-md transition-colors ${
          isOverPinned ? "bg-accent/40" : ""
        }`}
      >
        {pinnedOverview ? (
          <div className="my-2 w-full border-y border-black/5 py-2 dark:border-white/5">
            {renderShortcut(pinnedOverview)}
            {pinnedShortcuts.map(renderShortcut)}
          </div>
        ) : (
          pinnedShortcuts.map(renderShortcut)
        )}
      </div>

      <div
        ref={setRecentDropRef}
        className={`flex min-h-1 w-full flex-col space-y-1 rounded-md transition-colors ${
          !pinnedOverview
            ? "mt-2 border-t border-black/5 pt-2 dark:border-white/5"
            : ""
        } ${isOverRecent ? "bg-accent/40" : ""}`}
      >
        {recentShortcuts.map(renderShortcut)}
      </div>
    </>
  )
}
