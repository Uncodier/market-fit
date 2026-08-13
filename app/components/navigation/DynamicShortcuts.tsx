"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { NAVIGATION_AREAS, isNavItemActive, buildNavItemHref, AreaNavItem, WorkspaceArea } from "@/app/config/navigation-areas"
import { MenuItem } from "./MenuItem"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useAuth } from "@/app/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/app/components/ui/context-menu"

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
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"

import { Star } from "@/app/components/ui/icons"

import { ShortcutRecord } from "./shortcut-types"
import { loadShortcuts, saveShortcuts, loadShortcutsFromLocalStorage } from "./shortcut-storage"
import { useShortcutSlotCount } from "./use-shortcut-slot-count"
import { NAV_ITEM_ICON, getModuleVisual, ModuleVariant } from "@/app/config/module-visuals"

function reportItemTitle(item: AreaNavItem, t: (k: string) => string): string {
  if (item.dashboardTab) {
    return t(`dashboard.tabs.${item.dashboardTab}`) || item.dashboardTab
  }
  if (item.settingsTab === "channels") {
    return t("settings.tabs.channels") || "Agent Channels"
  }
  if (item.settingsTab === "activities") {
    return t("settings.tabs.activities") || "Activities"
  }
  if (item.key === "skills") {
    return t("settings.tabs.skills") || "Code agent skills"
  }
  if (item.key === "reportCosts") {
    return t("layout.sidebar.costs") || "Cost reports"
  }
  if (item.key === "contentCreator") {
    return t("layout.sidebar.imprenta") || "Content Creator"
  }
  return t(`layout.sidebar.${item.key}`) || item.key
}

interface DynamicShortcutsProps {
  isCollapsed: boolean
}

interface SortableShortcutItemProps {
  id: string
  item: AreaNavItem | undefined
  icon: React.ComponentType<any> | null
  linkHref: string
  isActive: boolean
  isCollapsed: boolean
  title: string
  visual?: ModuleVariant
  onRemove: (key: string) => void
  t: (k: string) => string
}

function SortableShortcutItem({
  id,
  item,
  icon,
  linkHref,
  isActive,
  isCollapsed,
  title,
  visual,
  onRemove,
  t
}: SortableShortcutItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 0,
    position: "relative" as const,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div 
            id={`nav-item-${id}`}
            className="relative select-none group"
            style={{ WebkitTouchCallout: "none" }}
            onContextMenu={(e) => {
              // Permitir el comportamiento predeterminado del ContextMenu
            }}
            onTouchStart={(e) => {
              const timer = setTimeout(() => {
                const event = new MouseEvent('contextmenu', {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  button: 2,
                  buttons: 2,
                  clientX: e.touches[0].clientX,
                  clientY: e.touches[0].clientY
                })
                document.getElementById(`nav-item-${id}`)?.dispatchEvent(event)
              }, 500)
              // Store timer to clear it if touch ends early
              const el = document.getElementById(`nav-item-${id}`)
              if (el) {
                el.dataset.timer = timer.toString()
              }
            }}
            onTouchEnd={() => {
              const el = document.getElementById(`nav-item-${id}`)
              if (el && el.dataset.timer) {
                clearTimeout(parseInt(el.dataset.timer))
                el.dataset.timer = ""
              }
            }}
            onTouchMove={() => {
              const el = document.getElementById(`nav-item-${id}`)
              if (el && el.dataset.timer) {
                clearTimeout(parseInt(el.dataset.timer))
                el.dataset.timer = ""
              }
            }}
          >
            <div className={cn("relative z-10", isDragging && "opacity-50 pointer-events-none")}>
              <MenuItem
                href={linkHref}
                icon={icon as any}
                title={title}
                isActive={isActive}
                isCollapsed={isCollapsed}
                visual={visual}
              />
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48 z-[10000]">
          <ContextMenuItem asChild>
            <a href={linkHref} className="w-full flex cursor-pointer" onPointerDown={(e) => e.stopPropagation()}>
              {t("common.open") === "common.open" ? `Open ${title}` : `${t("common.open")} ${title}`}
            </a>
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={() => onRemove(id)} 
            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {t("common.remove") === "common.remove" ? "Remove shortcut" : t("common.remove")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </div>
  )
}

const PINNED_NAV_KEYS = new Set(["contentCreator", "reportOverview"])

function isPinnedShortcutKey(key: string): boolean {
  return PINNED_NAV_KEYS.has(key)
}

// Get all possible items except pinned sidebar items (always visible at the top)
type AreaNavItemWithArea = AreaNavItem & { area: WorkspaceArea }
const ALL_ITEMS: AreaNavItemWithArea[] = []
Object.entries(NAVIGATION_AREAS).forEach(([areaKey, area]: [string, any]) => {
  if (area && area.items) {
    area.items.forEach((item: AreaNavItem) => {
      if (!PINNED_NAV_KEYS.has(item.key)) {
        ALL_ITEMS.push({ ...item, area: areaKey as WorkspaceArea })
      }
    })
  }
})

export interface CustomShortcutItem {
  id: string;
  title: string;
  href: string;
  isCustom: true;
}

export type ShortcutEntry = string | CustomShortcutItem;

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
          setShortcuts(withoutPinnedShortcuts(loadedShortcuts))
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
        setShortcuts(withoutPinnedShortcuts(JSON.parse(saved)))
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
    
    const activeItem = ALL_ITEMS.find(item => isNavItemActive(item, pathname, navSearchParams))
    if (activeItem) {
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
        !pathname.startsWith("/settings") &&
        !pathname.startsWith("/security") &&
        !pathname.startsWith("/billing") &&
        !pathname.startsWith("/integrations")
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
  }, [pathname, navSearchParams, searchParams, isLoaded, slots])

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

  if (shortcuts.length === 0) return null

  const visibleShortcuts = shortcuts.slice(0, slots)
  const shortcutIds = shortcuts.map(s => typeof s === 'string' ? s : s.id)
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
                title = reportItemTitle(item, t)
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
