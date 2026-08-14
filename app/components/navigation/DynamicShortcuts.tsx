"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import {
  NAVIGATION_AREAS,
  NAVIGATION_MENU_AREA_ORDER,
  isNavItemActive,
  buildNavItemHref,
  AreaNavItem,
  WorkspaceArea,
  getNavItemTitle,
  isSettingsNavKey,
  isConfigurationNavPath,
} from "@/app/config/navigation-areas"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useAuth } from "@/app/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Star } from "@/app/components/ui/icons"
import { isPinnedShortcutKey, SIDEBAR_PINNED_NAV_KEYS } from "./shortcut-types"
import { useShortcutSlotCount } from "./use-shortcut-slot-count"
import { NAV_ITEM_ICON, getModuleVisual, ModuleVariant } from "@/app/config/module-visuals"
import { setVisibleSidebarShortcutKeys } from "./use-sidebar-nav-keys"
import { useOptionalScreenAccess } from "@/app/context/ScreenAccessContext"
import { getNavKeyForPath } from "@/lib/auth/screen-access"
import { SortableShortcutItem } from "./SortableShortcutItem"

interface DynamicShortcutsProps {
  isCollapsed: boolean
}

const PINNED_NAV_KEYS = new Set<string>(SIDEBAR_PINNED_NAV_KEYS)

export interface CustomShortcutItem {
  id: string;
  title: string;
  href: string;
  isCustom: true;
}

export type ShortcutEntry = string | CustomShortcutItem;

// Launcher items only — Settings lives in the bottom Configuration section
type AreaNavItemWithArea = AreaNavItem & { area: WorkspaceArea }
const ALL_ITEMS: AreaNavItemWithArea[] = []
for (const areaKey of NAVIGATION_MENU_AREA_ORDER) {
  const area = NAVIGATION_AREAS[areaKey]
  if (!area?.items) continue
  for (const item of area.items) {
    if (!PINNED_NAV_KEYS.has(item.key)) {
      ALL_ITEMS.push({ ...item, area: areaKey })
    }
  }
}

function withoutConfigurationShortcuts(entries: ShortcutEntry[]): ShortcutEntry[] {
  return entries.filter((entry) => {
    if (typeof entry === "string") return !isSettingsNavKey(entry)
    try {
      const url = new URL(entry.href, "http://local")
      return !isConfigurationNavPath(url.pathname, url.searchParams)
    } catch {
      return true
    }
  })
}

function withoutPinnedShortcuts(entries: ShortcutEntry[]): ShortcutEntry[] {
  return entries.filter((entry) => typeof entry !== "string" || !isPinnedShortcutKey(entry))
}

export function DynamicShortcuts({ isCollapsed }: DynamicShortcutsProps) {
  const { t } = useLocalization()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const navSearchParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams])

  const containerRef = useRef<HTMLDivElement>(null)
  const slots = useShortcutSlotCount(containerRef)

  const { user, isLoading: isAuthLoading } = useAuth()
  const screenAccess = useOptionalScreenAccess()
  const [shortcuts, setShortcuts] = useState<ShortcutEntry[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from DB or local storage
  useEffect(() => {
    // Wait until auth is resolved (user is either present or null, not loading)
    if (isAuthLoading) return;

    let isMounted = true;

    const loadShortcuts = async () => {
      try {
        let loadedShortcuts: ShortcutEntry[] = []
        let hasLoadedFromDB = false

        if (user?.id) {
          const supabase = createClient()
          const { data, error } = await supabase
            .from('user_shortcuts')
            .select('shortcuts')
            .eq('user_id', user.id)
            .single()
            
          if (data && data.shortcuts && Array.isArray(data.shortcuts)) {
            loadedShortcuts = data.shortcuts
            hasLoadedFromDB = true
          }
        }

        if (!hasLoadedFromDB) {
          const saved = localStorage.getItem("navigationShortcuts_v3")
          if (saved) {
            loadedShortcuts = JSON.parse(saved)
          }
        }

        if (isMounted) {
          setShortcuts(
            withoutConfigurationShortcuts(withoutPinnedShortcuts(loadedShortcuts))
          )
          setIsLoaded(true)
        }
      } catch (e) {
        console.error("Failed to load shortcuts", e)
        if (isMounted) setIsLoaded(true)
      }
    }
    loadShortcuts()
    
    // Fallback sync for manual event triggers across components
    const handleLocalSync = () => {
      const saved = localStorage.getItem("navigationShortcuts_v3")
      if (saved) {
        setShortcuts(
          withoutConfigurationShortcuts(withoutPinnedShortcuts(JSON.parse(saved)))
        )
      }
    }
    
    window.addEventListener("shortcuts-updated", handleLocalSync)
    return () => {
      isMounted = false;
      window.removeEventListener("shortcuts-updated", handleLocalSync)
    }
  }, [user?.id, isAuthLoading])

  // Save to DB and local storage
  useEffect(() => {
    if (!isLoaded) return;
    
    localStorage.setItem("navigationShortcuts_v3", JSON.stringify(shortcuts))
    
    if (user?.id) {
      const saveToDb = async () => {
        const supabase = createClient()
        // Upsert to the new collection
        await supabase
          .from('user_shortcuts')
          .upsert({ 
            user_id: user.id, 
            shortcuts: shortcuts,
            updated_at: new Date().toISOString()
          }, { 
            onConflict: 'user_id' 
          })
      }
      saveToDb()
    }
  }, [shortcuts, isLoaded, user?.id])

  // Check if current route matches any item and add it if not exists
  useEffect(() => {
    if (!isLoaded) return;
    if (isConfigurationNavPath(pathname, navSearchParams)) return

    const activeItem = ALL_ITEMS.find(item => isNavItemActive(item, pathname, navSearchParams))
    if (activeItem) {
      if (screenAccess && !screenAccess.canAccessNavKey(activeItem.key)) return
      setShortcuts(prev => {
        // Find if this key already exists
        const exists = prev.some(s => {
          if (typeof s === 'string') return s === activeItem.key;
          return s.id === activeItem.key;
        });
        if (!exists) {
          return [activeItem.key, ...prev]
        } else {
          const index = prev.findIndex(s => {
            if (typeof s === 'string') return s === activeItem.key;
            return s.id === activeItem.key;
          });
          if (index >= slots) {
            const next = [...prev];
            const item = next.splice(index, 1)[0];
            return [item, ...next];
          }
        }
        return prev
      })
    } else {
      // Exclude paths that are handled explicitly in Sidebar or are root
      if (
        pathname && 
        pathname !== "/" && 
        pathname !== "/robots" && 
        !pathname.startsWith("/robots/") &&
        !(pathname.startsWith("/dashboard") && navSearchParams.get("tab") === "overview") &&
        pathname !== "/notifications" &&
        !pathname.startsWith("/notifications/") &&
        !pathname.startsWith("/profile") &&
        !isConfigurationNavPath(pathname, navSearchParams)
      ) {
        const fullHref = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
        const customId = `custom-${pathname.replace(/\//g, '-')}`;
        
        setShortcuts(prev => {
          const exists = prev.some(s => {
            if (typeof s === 'string') return false;
            return s.id === customId || s.href === pathname || s.href === fullHref;
          });
          
          if (!exists) {
            const segments = pathname.split('/').filter(Boolean);
            let title = segments[segments.length - 1] || pathname;
            if (title.length > 0) {
              try {
                title = decodeURIComponent(title);
              } catch (e) {}
              title = title.charAt(0).toUpperCase() + title.slice(1).replace(/-/g, ' ');
            }
            
            return [{
              id: customId,
              title,
              href: fullHref,
              isCustom: true
            }, ...prev];
          } else {
            const index = prev.findIndex(s => {
              if (typeof s === 'string') return false;
              return s.id === customId || s.href === pathname || s.href === fullHref;
            });
            if (index >= slots) {
              const next = [...prev];
              const item = next.splice(index, 1)[0];
              return [item, ...next];
            }
          }
          return prev;
        });
      }
    }
  }, [pathname, navSearchParams, searchParams, isLoaded, slots, screenAccess])

  const handleRemove = (idToRemove: string) => {
    setShortcuts(prev => prev.filter(k => {
      if (typeof k === 'string') return k !== idToRemove;
      return k.id !== idToRemove;
    }))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      setShortcuts((items) => {
        const oldIndex = items.findIndex(s => (typeof s === 'string' ? s : s.id) === active.id)
        const newIndex = items.findIndex(s => (typeof s === 'string' ? s : s.id) === over.id)
        
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const allowedShortcuts = useMemo(() => {
    const eligible = withoutConfigurationShortcuts(shortcuts)
    if (!screenAccess) return eligible
    return eligible.filter((entry) => {
      if (typeof entry === "string") return screenAccess.canAccessNavKey(entry)
      try {
        const url = new URL(entry.href, "http://local")
        const key = getNavKeyForPath(url.pathname, url.searchParams)
        return !key || screenAccess.canAccessNavKey(key)
      } catch {
        return true
      }
    })
  }, [screenAccess, shortcuts])

  useEffect(() => {
    const ids = allowedShortcuts.slice(0, slots).flatMap((entry) => {
      const id = typeof entry === "string" ? entry : entry.id
      const isCustom = typeof entry !== "string" && Boolean(entry.isCustom)
      if (!id || isCustom || isPinnedShortcutKey(id)) return []
      return [id]
    })
    setVisibleSidebarShortcutKeys(ids)
  }, [allowedShortcuts, slots])

  if (allowedShortcuts.length === 0) return null

  const visibleShortcuts = allowedShortcuts.slice(0, slots)
  const shortcutIds = allowedShortcuts.map(s => typeof s === 'string' ? s : s.id)
  const visibleShortcutIds = shortcutIds.slice(0, slots)

  let bestMatchId: string | null = null;
  let maxMatchLength = -1;

  visibleShortcuts.forEach((entry) => {
    const isCustom = typeof entry !== 'string'
    const id = isCustom ? entry.id : entry

    let isMatch = false
    let matchLen = 0

    if (isCustom) {
      isMatch = pathname === entry.href || pathname.startsWith(entry.href + '?') || pathname.startsWith(entry.href + '/')
      matchLen = entry.href.length
    } else {
      const item = ALL_ITEMS.find(i => i.key === id)
      if (item) {
        isMatch = isNavItemActive(item, pathname, navSearchParams)
        matchLen = (item.href || "").length
        if (item.dashboardTab) matchLen += item.dashboardTab.length
        if (item.settingsTab) matchLen += item.settingsTab.length
        if (item.robotsMode) matchLen += item.robotsMode.length
      }
    }

    if (isMatch && matchLen > maxMatchLength) {
      maxMatchLength = matchLen
      bestMatchId = id
    }
  })

  return (
    <>
      <div className="w-full h-[1px] bg-black/5 dark:bg-white/5 my-2" />
      <div ref={containerRef} className="flex-1 w-full min-h-0 flex flex-col space-y-1">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={visibleShortcutIds}
            strategy={verticalListSortingStrategy}
          >
            {visibleShortcuts.map((entry) => {
              const isCustom = typeof entry !== 'string'
              const id = isCustom ? entry.id : entry
              
              let item: AreaNavItem | undefined;
              let icon: React.ComponentType<any> | null = Star
              let linkHref = ""
              let isActive = false
              let title = ""
              let visual: ModuleVariant | undefined;

              if (isCustom) {
                item = { key: entry.id, href: entry.href }
                icon = Star
                linkHref = entry.href
                isActive = id === bestMatchId
                title = entry.title
              } else {
                item = ALL_ITEMS.find(i => i.key === id)
                if (!item) return null
                icon = NAV_ITEM_ICON[item.key] || Star
                linkHref = buildNavItemHref(item, navSearchParams)
                isActive = id === bestMatchId
                title = getNavItemTitle(item, t)
                if ((item as AreaNavItemWithArea).area) {
                  visual = getModuleVisual((item as AreaNavItemWithArea).area, item.key)
                }
              }

              return (
                <SortableShortcutItem
                  key={id}
                  id={id}
                  item={item}
                  icon={icon}
                  linkHref={linkHref}
                  isActive={isActive}
                  isCollapsed={isCollapsed}
                  title={title}
                  visual={visual}
                  onRemove={handleRemove}
                  t={t}
                />
              )
            })}
          </SortableContext>
        </DndContext>
      </div>
    </>
  )
}
