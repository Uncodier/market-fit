"use client"

import { MenuItem } from "./MenuItem"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/app/components/ui/context-menu"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import type {
  AreaNavItem,
  WorkspaceArea,
} from "@/app/config/navigation-areas"
import type { ModuleVariant } from "@/app/config/module-visuals"

interface SortableShortcutItemProps {
  id: string
  item: AreaNavItem | undefined
  icon: React.ComponentType<any> | null
  linkHref: string
  isActive: boolean
  isCollapsed: boolean
  isPinned: boolean
  canRemove?: boolean
  title: string
  visual?: ModuleVariant
  moduleImage?: {
    area: WorkspaceArea
    itemKey: string
  }
  onPinnedChange: (key: string, pinned: boolean) => void
  onRemove: (key: string) => void
  t: (k: string) => string
}

export function SortableShortcutItem({
  id,
  item: _item,
  icon,
  linkHref,
  isActive,
  isCollapsed,
  isPinned,
  canRemove = true,
  title,
  visual,
  moduleImage,
  onPinnedChange,
  onRemove,
  t,
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
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          id={`nav-item-${id}`}
          style={{ ...style, WebkitTouchCallout: "none" }}
          {...attributes}
          {...listeners}
          className={cn(
            "relative z-10 block w-full min-w-0 touch-none select-none",
            isDragging && "opacity-50 pointer-events-none"
          )}
          onTouchStart={(e) => {
            listeners?.onTouchStart?.(e)
            const timer = setTimeout(() => {
              const touch = e.touches[0]
              if (!touch) return
              const event = new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 2,
                buttons: 2,
                clientX: touch.clientX,
                clientY: touch.clientY,
              })
              document.getElementById(`nav-item-${id}`)?.dispatchEvent(event)
            }, 500)
            e.currentTarget.dataset.timer = timer.toString()
          }}
          onTouchEnd={(e) => {
            listeners?.onTouchEnd?.(e)
            const timer = e.currentTarget.dataset.timer
            if (timer) clearTimeout(Number(timer))
            e.currentTarget.dataset.timer = ""
          }}
          onTouchMove={(e) => {
            listeners?.onTouchMove?.(e)
            const timer = e.currentTarget.dataset.timer
            if (timer) clearTimeout(Number(timer))
            e.currentTarget.dataset.timer = ""
          }}
        >
          <MenuItem
            id={`sidebar-shortcut-${id}`}
            href={linkHref}
            icon={icon as any}
            title={title}
            isActive={isActive}
            isCollapsed={isCollapsed}
            visual={visual}
            moduleImage={moduleImage}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48 z-[10000]">
        <ContextMenuItem asChild>
          <a href={linkHref} className="w-full flex cursor-pointer" onPointerDown={(e) => e.stopPropagation()}>
            {t("common.open") === "common.open" ? `Open ${title}` : `${t("common.open")} ${title}`}
          </a>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onPinnedChange(id, !isPinned)}
          className="cursor-pointer"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isPinned ? "Unpin shortcut" : "Pin shortcut"}
        </ContextMenuItem>
        {canRemove && (
          <ContextMenuItem
            onClick={() => onRemove(id)}
            className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {t("common.remove") === "common.remove" ? "Remove shortcut" : t("common.remove")}
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
