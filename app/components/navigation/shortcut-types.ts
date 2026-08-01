export type CustomShortcutItem = {
  id: string
  title: string
  href: string
  isCustom: true
}

export type LegacyShortcutEntry = string | CustomShortcutItem

export type ShortcutRecord = {
  id: string
  pinned: boolean
  // Fields for custom shortcuts
  title?: string
  href?: string
  isCustom?: boolean
}

export function normalizeShortcut(entry: LegacyShortcutEntry | ShortcutRecord): ShortcutRecord {
  if (typeof entry === 'string') {
    return {
      id: entry,
      pinned: false
    }
  }
  
  if (!('pinned' in entry)) {
    // It's a legacy CustomShortcutItem
    return {
      id: entry.id,
      pinned: false,
      title: entry.title,
      href: entry.href,
      isCustom: true
    }
  }

  // Ensure older records get a default pinned status
  return {
    ...entry,
    pinned: entry.pinned ?? false
  }
}
