"use client"

import { useEffect, useState, useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { NAVIGATION_AREAS, isNavItemActive, buildNavItemHref, AreaNavItem } from "@/app/config/navigation-areas"
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

// Same mapping as in NavigationAreaGroups
const NAV_ITEM_EMOJI: Record<string, string> = {
  salesHome: "🏠",
  campaigns: "🎯",
  segments: "🏷️",
  content: "📄",
  contentCreator: "🖨️",
  assets: "📁",
  context: "🏢",
  agentsConfiguration: "✨",
  applicationsDatabase: "💾",
  applicationsRepositories: "📦",
  sales: "💰",
  leads: "👥",
  deals: "🤝",
  chat: "💬",
  people: "🔍",
  controlCenter: "🚀",
  requirements: "✅",
  channels: "📡",
  activities: "📋",
  skills: "🧩",
  reportPerformance: "📈",
  reportOverview: "📋",
  reportAnalytics: "🔎",
  reportTraffic: "🌐",
  reportCosts: "📊",
  reportSales: "💵",
}

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
  item: AreaNavItem
  emoji: string
  linkHref: string
  isActive: boolean
  isCollapsed: boolean
  title: string
  onRemove: (key: string) => void
  t: (k: string) => string
}

function SortableShortcutItem({
  id,
  item,
  emoji,
  linkHref,
  isActive,
  isCollapsed,
  title,
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
                emoji={emoji}
                title={title}
                isActive={isActive}
                isCollapsed={isCollapsed}
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

// Get all possible items except contentCreator (which is statically shown)
const ALL_ITEMS: AreaNavItem[] = []
Object.values(NAVIGATION_AREAS).forEach((area: any) => {
  if (area && area.items) {
    area.items.forEach((item: AreaNavItem) => {
      if (item.key !== "contentCreator") {
        ALL_ITEMS.push(item)
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

export function DynamicShortcuts({ isCollapsed }: DynamicShortcutsProps) {
  const { t } = useLocalization()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const navSearchParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams])

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
          setShortcuts(loadedShortcuts)
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
        setShortcuts(JSON.parse(saved))
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
          return [...prev, activeItem.key]
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
            
            return [...prev, {
              id: customId,
              title,
              href: fullHref,
              isCustom: true
            }];
          }
          return prev;
        });
      }
    }
  }, [pathname, navSearchParams, searchParams, isLoaded])

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

  const shortcutIds = shortcuts.map(s => typeof s === 'string' ? s : s.id)

  return (
    <>
      <div className="w-full h-[1px] bg-black/5 dark:bg-white/5 my-2" />
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext 
          items={shortcutIds}
          strategy={verticalListSortingStrategy}
        >
          {shortcuts.map((entry) => {
            const isCustom = typeof entry !== 'string'
            const id = isCustom ? entry.id : entry
            
            let item: AreaNavItem | undefined;
            let emoji = "📌"
            let linkHref = ""
            let isActive = false
            let title = ""

            if (isCustom) {
              item = { key: entry.id, href: entry.href }
              emoji = "✨"
              linkHref = entry.href
              // Basic check for active state
              isActive = pathname === entry.href || pathname.startsWith(entry.href + '?') || pathname.startsWith(entry.href + '/')
              title = entry.title
            } else {
              item = ALL_ITEMS.find(i => i.key === id)
              if (!item) return null
              emoji = NAV_ITEM_EMOJI[item.key] || "📌"
              linkHref = buildNavItemHref(item, navSearchParams)
              isActive = isNavItemActive(item, pathname, navSearchParams)
              title = reportItemTitle(item, t)
            }

            return (
              <SortableShortcutItem
                key={id}
                id={id}
                item={item}
                emoji={emoji}
                linkHref={linkHref}
                isActive={isActive}
                isCollapsed={isCollapsed}
                title={title}
                onRemove={handleRemove}
                t={t}
              />
            )
          })}
        </SortableContext>
      </DndContext>
    </>
  )
}
