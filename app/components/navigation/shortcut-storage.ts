import { createClient } from "@/lib/supabase/client"
import { isRealSiteId } from "@/lib/demo-utils"
import { normalizeShortcut, ShortcutRecord } from "./shortcut-types"

const STORAGE_KEY_PREFIX = "navigationShortcuts_v5"
const STORAGE_KEY_V3 = "navigationShortcuts_v3"
const STORAGE_KEY_V4 = "navigationShortcuts_v4"
const LEGACY_STORAGE_KEYS = [STORAGE_KEY_V4, STORAGE_KEY_V3]

export const SHORTCUTS_UPDATED_EVENT = "shortcuts-updated"

export interface ShortcutsUpdatedDetail {
  siteId: string
}

export function getShortcutStorageKey(siteId: string): string {
  return `${STORAGE_KEY_PREFIX}:${siteId}`
}

function normalizeStoredShortcuts(value: unknown): ShortcutRecord[] | null {
  if (!Array.isArray(value)) return null

  return value
    .filter(
      (entry) =>
        typeof entry === "string" ||
        (typeof entry === "object" &&
          entry !== null &&
          "id" in entry &&
          typeof entry.id === "string"),
    )
    .map((entry) => normalizeShortcut(entry))
}

function readShortcutStorage(key: string): ShortcutRecord[] | null {
  if (typeof window === "undefined") return null

  const saved = localStorage.getItem(key)
  if (!saved) return null

  try {
    return normalizeStoredShortcuts(JSON.parse(saved))
  } catch (error) {
    console.error(`Failed to parse shortcuts from ${key}`, error)
    return null
  }
}

export function loadShortcutsFromLocalStorage(siteId: string): ShortcutRecord[] {
  const scopedKey = getShortcutStorageKey(siteId)
  const scopedShortcuts = readShortcutStorage(scopedKey)
  if (scopedShortcuts) return scopedShortcuts

  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    const legacyShortcuts = readShortcutStorage(legacyKey)
    if (!legacyShortcuts) continue

    saveShortcutsToLocalStorage(siteId, legacyShortcuts)
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
    return legacyShortcuts
  }

  return []
}

export function saveShortcutsToLocalStorage(
  siteId: string,
  shortcuts: ShortcutRecord[],
): void {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(
      getShortcutStorageKey(siteId),
      JSON.stringify(shortcuts),
    )
  } catch (error) {
    console.error("Failed to save shortcuts to localStorage", error)
  }
}

export function notifyShortcutsUpdated(siteId: string): void {
  window.dispatchEvent(
    new CustomEvent<ShortcutsUpdatedDetail>(SHORTCUTS_UPDATED_EVENT, {
      detail: { siteId },
    }),
  )
}

export async function loadShortcuts(
  userId: string | undefined,
  siteId: string,
): Promise<ShortcutRecord[]> {
  if (userId && isRealSiteId(siteId)) {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("user_shortcuts")
        .select("shortcuts")
        .eq("user_id", userId)
        .eq("site_id", siteId)
        .maybeSingle()

      if (error) throw error

      const storedShortcuts = normalizeStoredShortcuts(data?.shortcuts)
      if (storedShortcuts) {
        saveShortcutsToLocalStorage(siteId, storedShortcuts)
        return storedShortcuts
      }
    } catch (error) {
      console.error("Failed to load shortcuts from DB", error)
    }
  }

  return loadShortcutsFromLocalStorage(siteId)
}

export async function saveShortcuts(
  userId: string | undefined,
  siteId: string,
  shortcuts: ShortcutRecord[],
): Promise<void> {
  saveShortcutsToLocalStorage(siteId, shortcuts)

  if (userId && isRealSiteId(siteId)) {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("user_shortcuts")
        .upsert({
          user_id: userId,
          site_id: siteId,
          shortcuts: shortcuts,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,site_id",
        })

      if (error) throw error
    } catch (error) {
      console.error("Failed to save shortcuts to DB", error)
    }
  }
}
