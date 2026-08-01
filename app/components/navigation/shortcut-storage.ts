import { createClient } from "@/lib/supabase/client"
import { normalizeShortcut, ShortcutRecord } from "./shortcut-types"

const STORAGE_KEY_V3 = "navigationShortcuts_v3"
const STORAGE_KEY_V4 = "navigationShortcuts_v4"

export async function loadShortcuts(userId: string | undefined): Promise<ShortcutRecord[]> {
  let rawShortcuts: any[] = []
  let hasLoadedFromDB = false

  // Try DB if logged in
  if (userId) {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('user_shortcuts')
        .select('shortcuts')
        .eq('user_id', userId)
        .single()
        
      if (data && Array.isArray(data.shortcuts)) {
        rawShortcuts = data.shortcuts
        hasLoadedFromDB = true
      }
    } catch (e) {
      console.error("Failed to load shortcuts from DB", e)
    }
  }

  // Fallback to local storage
  if (!hasLoadedFromDB) {
    try {
      const savedV4 = localStorage.getItem(STORAGE_KEY_V4)
      if (savedV4) {
        rawShortcuts = JSON.parse(savedV4)
      } else {
        const savedV3 = localStorage.getItem(STORAGE_KEY_V3)
        if (savedV3) {
          rawShortcuts = JSON.parse(savedV3)
        }
      }
    } catch (e) {
      console.error("Failed to parse local storage shortcuts", e)
    }
  }

  // Normalize whatever we loaded
  return (rawShortcuts || []).map(normalizeShortcut)
}

export async function saveShortcuts(userId: string | undefined, shortcuts: ShortcutRecord[]) {
  // Save to V4 local storage
  try {
    localStorage.setItem(STORAGE_KEY_V4, JSON.stringify(shortcuts))
  } catch (e) {
    console.error("Failed to save to localStorage", e)
  }

  // Save to DB
  if (userId) {
    try {
      const supabase = createClient()
      await supabase
        .from('user_shortcuts')
        .upsert({ 
          user_id: userId, 
          shortcuts: shortcuts,
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'user_id' 
        })
    } catch (e) {
      console.error("Failed to save to DB", e)
    }
  }
}

export function loadShortcutsFromLocalStorage(): ShortcutRecord[] {
  try {
    const savedV4 = localStorage.getItem(STORAGE_KEY_V4)
    if (savedV4) {
      return JSON.parse(savedV4).map(normalizeShortcut)
    }
    const savedV3 = localStorage.getItem(STORAGE_KEY_V3)
    if (savedV3) {
      return JSON.parse(savedV3).map(normalizeShortcut)
    }
  } catch (e) {
    console.error("Failed to parse local storage shortcuts", e)
  }
  return []
}
