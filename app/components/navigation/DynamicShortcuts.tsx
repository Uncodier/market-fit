"use client"
import { useEffect, useState, useMemo, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import {
  isNavItemActive,
  buildNavItemHref,
  type AreaNavItem,
  getNavItemTitle,
  isConfigurationNavPath,
} from "@/app/config/navigation-areas"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor,
  useDroppable,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Star } from "@/app/components/ui/icons"
import {
  isPinnedShortcutKey,
  type ShortcutRecord,
} from "./shortcut-types"
import { canonicalizeShortcutRecords } from "./shortcut-normalization"
import { useShortcutSlotCount } from "./use-shortcut-slot-count"
import { NAV_ITEM_ICON, getModuleVisual, ModuleVariant } from "@/app/config/module-visuals"
import { setVisibleSidebarShortcutKeys } from "./use-sidebar-nav-keys"
import { useOptionalScreenAccess } from "@/app/context/ScreenAccessContext"
import { getNavKeyForPath } from "@/lib/auth/screen-access"
import { SortableShortcutItem } from "./SortableShortcutItem"
import { ShortcutDropSections } from "./ShortcutDropSections"
import {
  ALL_SHORTCUT_ITEMS,
  type AreaNavItemWithArea,
  prepareSidebarShortcuts,
  withoutConfigurationShortcuts,
} from "./dynamic-shortcut-utils"
import {
  loadShortcuts,
  loadShortcutsFromLocalStorage,
  saveShortcuts,
  SHORTCUTS_UPDATED_EVENT,
  type ShortcutsUpdatedDetail,
} from "./shortcut-storage"

interface DynamicShortcutsProps { isCollapsed: boolean }
const ALL_ITEMS = ALL_SHORTCUT_ITEMS

export function DynamicShortcuts({ isCollapsed }: DynamicShortcutsProps) {
  const { t } = useLocalization()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const navSearchParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams])

  const containerRef = useRef<HTMLDivElement>(null)
  const slots = useShortcutSlotCount(containerRef)

  const { user, isLoading: isAuthLoading } = useAuth()
  const { currentSite, isLoading: isSiteLoading } = useSite()
  const siteId = currentSite?.id ?? null
  const shortcutScope = siteId
    ? `${user?.id ?? "anonymous"}:${siteId}`
    : null
  const screenAccess = useOptionalScreenAccess()
  const [shortcuts, setShortcuts] = useState<ShortcutRecord[]>([])
  const [loadedScope, setLoadedScope] = useState<string | null>(null)
  const isLoaded = shortcutScope !== null && loadedScope === shortcutScope

  // Load from DB or local storage
  useEffect(() => {
    if (isAuthLoading || isSiteLoading || !siteId || !shortcutScope) return

    let isMounted = true

    const loadSiteShortcuts = async () => {
      try {
        const loadedShortcuts = await loadShortcuts(user?.id, siteId)

        if (isMounted) {
          setShortcuts(prepareSidebarShortcuts(loadedShortcuts))
          setLoadedScope(shortcutScope)
        }
      } catch (error) {
        console.error("Failed to load shortcuts", error)
        if (isMounted) {
          setShortcuts(prepareSidebarShortcuts([]))
          setLoadedScope(shortcutScope)
        }
      }
    }
    void loadSiteShortcuts()

    const handleLocalSync = (event: Event) => {
      const eventSiteId = (
        event as CustomEvent<ShortcutsUpdatedDetail>
      ).detail?.siteId
      if (eventSiteId && eventSiteId !== siteId) return

      setShortcuts(
        prepareSidebarShortcuts(loadShortcutsFromLocalStorage(siteId)),
      )
    }

    window.addEventListener(SHORTCUTS_UPDATED_EVENT, handleLocalSync)
    return () => {
      isMounted = false
      window.removeEventListener(SHORTCUTS_UPDATED_EVENT, handleLocalSync)
    }
  }, [
    user?.id,
    isAuthLoading,
    isSiteLoading,
    siteId,
    shortcutScope,
  ])

  // Save to DB and local storage
  useEffect(() => {
    if (!isLoaded || !siteId) return

    void saveShortcuts(user?.id, siteId, shortcuts)
  }, [shortcuts, isLoaded, siteId, user?.id])

  // Check if current route matches any item and add it if not exists
  useEffect(() => {
    if (!isLoaded) return;
    if (isConfigurationNavPath(pathname, navSearchParams)) return

    const activeItem = ALL_ITEMS.find(item => isNavItemActive(item, pathname, navSearchParams))
    if (activeItem) {
      if (screenAccess && !screenAccess.canAccessNavKey(activeItem.key)) return
      setShortcuts(prev => {
        const canonicalShortcuts = canonicalizeShortcutRecords(prev)
        const exists = canonicalShortcuts.some(
          (shortcut) => shortcut.id === activeItem.key,
        )
        if (!exists) {
          return [
            { id: activeItem.key, pinned: false },
            ...canonicalShortcuts,
          ]
        } else {
          const index = canonicalShortcuts.findIndex(
            (shortcut) => shortcut.id === activeItem.key,
          )
          if (index >= slots) {
            const next = [...canonicalShortcuts];
            const item = next.splice(index, 1)[0];
            return [item, ...next];
          }
        }
        return canonicalShortcuts
      })
    } else {
      // Exclude paths that are handled explicitly in Sidebar or are root
      if (
        pathname && 
        pathname !== "/" && 
        pathname !== "/robots" && 
        !pathname.startsWith("/robots/") &&
        pathname !== "/navigation" &&
        !(pathname.startsWith("/dashboard") && navSearchParams.get("tab") === "overview") &&
        pathname !== "/notifications" &&
        !pathname.startsWith("/notifications/") &&
        !pathname.startsWith("/profile") &&
        !isConfigurationNavPath(pathname, navSearchParams)
      ) {
        const fullHref = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");
        const customId = `custom-${pathname.replace(/\//g, '-')}`;
        
        setShortcuts(prev => {
          const exists = prev.some(
            (shortcut) =>
              shortcut.id === customId ||
              shortcut.href === pathname ||
              shortcut.href === fullHref
          )
          
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
              isCustom: true,
              pinned: false,
            }, ...prev];
          } else {
            const index = prev.findIndex(
              (shortcut) =>
                shortcut.id === customId ||
                shortcut.href === pathname ||
                shortcut.href === fullHref
            )
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
    setShortcuts((prev) => prev.filter((shortcut) => shortcut.id !== idToRemove))
  }

  const handlePinnedChange = (id: string, pinned: boolean) => {
    setShortcuts((prev) =>
      prev.map((shortcut) =>
        shortcut.id === id ? { ...shortcut, pinned } : shortcut
      )
    )
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
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const { setNodeRef: setPinnedDropRef, isOver: isOverPinned } = useDroppable({
    id: "sidebar-pinned-zone",
  })
  const { setNodeRef: setRecentDropRef, isOver: isOverRecent } = useDroppable({
    id: "sidebar-recent-zone",
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over) return

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50)
    }

    setShortcuts((items) => {
      const activeId = String(active.id)
      const overId = String(over.id)
      const oldIndex = items.findIndex((shortcut) => shortcut.id === activeId)
      if (oldIndex < 0) return items

      const overShortcut = items.find((shortcut) => shortcut.id === overId)
      const targetPinned =
        overId === "sidebar-pinned-zone"
          ? true
          : overId === "sidebar-recent-zone"
            ? false
            : overShortcut?.pinned

      const next = items.map((shortcut) =>
        shortcut.id === activeId && targetPinned !== undefined
          ? { ...shortcut, pinned: targetPinned }
          : shortcut
      )
      const newIndex = next.findIndex((shortcut) => shortcut.id === overId)
      return newIndex >= 0 && oldIndex !== newIndex
        ? arrayMove(next, oldIndex, newIndex)
        : next
    })
  }

  const allowedShortcuts = useMemo(() => {
    if (!isLoaded) return []

    const eligible = withoutConfigurationShortcuts(
      canonicalizeShortcutRecords(shortcuts),
    )
    if (!screenAccess) return eligible
    return eligible.filter((entry) => {
      if (!entry.isCustom) return screenAccess.canAccessNavKey(entry.id)
      if (!entry.href) return false
      try {
        const url = new URL(entry.href, "http://local")
        const key = getNavKeyForPath(url.pathname, url.searchParams)
        return !key || screenAccess.canAccessNavKey(key)
      } catch {
        return true
      }
    })
  }, [isLoaded, screenAccess, shortcuts])

  const pinnedShortcuts = useMemo(
    () => allowedShortcuts.filter((entry) => entry.pinned),
    [allowedShortcuts]
  )
  const pinnedOverview = pinnedShortcuts.find(
    (entry) => entry.id === "reportOverview"
  )
  const userPinnedShortcuts = pinnedShortcuts.filter(
    (entry) => entry.id !== "reportOverview"
  )
  const visibleRecentShortcuts = useMemo(
    () =>
      allowedShortcuts
        .filter((entry) => !entry.pinned)
        .slice(0, Math.max(0, slots - pinnedShortcuts.length)),
    [allowedShortcuts, pinnedShortcuts.length, slots]
  )
  const visibleShortcuts = useMemo(
    () => [...pinnedShortcuts, ...visibleRecentShortcuts],
    [pinnedShortcuts, visibleRecentShortcuts]
  )

  useEffect(() => {
    const ids = visibleShortcuts.flatMap((entry) => {
      if (!entry.id || entry.isCustom || isPinnedShortcutKey(entry.id)) return []
      return [entry.id]
    })
    setVisibleSidebarShortcutKeys(ids)
  }, [visibleShortcuts])

  let bestMatchId: string | null = null;
  let maxMatchLength = -1;

  visibleShortcuts.forEach((entry) => {
    const isCustom = Boolean(entry.isCustom)
    const id = entry.id

    let isMatch = false
    let matchLen = 0

    if (isCustom && entry.href) {
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

  const renderShortcut = (entry: ShortcutRecord) => {
    const isCustom = Boolean(entry.isCustom)
    const id = entry.id

    let item: AreaNavItem | undefined
    let icon: React.ComponentType<any> | null = Star
    let linkHref = ""
    let title = ""
    let visual: ModuleVariant | undefined

    if (isCustom && entry.href) {
      item = { key: id, href: entry.href }
      linkHref = entry.href
      title = entry.title || id
    } else {
      item = ALL_ITEMS.find((candidate) => candidate.key === id)
      if (!item) return null
      icon = NAV_ITEM_ICON[item.key] || Star
      linkHref = buildNavItemHref(item, navSearchParams)
      title = getNavItemTitle(item, t) || item.key
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
        isActive={id === bestMatchId}
        isCollapsed={isCollapsed}
        isPinned={entry.pinned}
        canRemove={id !== "reportOverview"}
        title={title}
        visual={visual}
        onPinnedChange={handlePinnedChange}
        onRemove={handleRemove}
        t={t}
      />
    )
  }

  if (!isLoaded || visibleShortcuts.length === 0) return null

  return (
    <div ref={containerRef} className="flex min-h-0 w-full flex-1 flex-col space-y-1">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleShortcuts.map((entry) => entry.id)}
          strategy={verticalListSortingStrategy}
        >
          <ShortcutDropSections
            pinnedShortcuts={userPinnedShortcuts}
            pinnedOverview={pinnedOverview}
            recentShortcuts={visibleRecentShortcuts}
            isOverPinned={isOverPinned}
            isOverRecent={isOverRecent}
            setPinnedDropRef={setPinnedDropRef}
            setRecentDropRef={setRecentDropRef}
            renderShortcut={renderShortcut}
          />
        </SortableContext>
      </DndContext>
    </div>
  )
}
