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
import type { AreaNavItem } from "@/app/config/navigation-areas"
import type { ModuleVariant } from "@/app/config/module-visuals"

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

export function SortableShortcutItem({
  id,
  item: _item,
  icon,
  linkHref,
  isActive,
  isCollapsed,
  title,
  visual,
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none select-none">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            id={`nav-item-${id}`}
            className="relative select-none group"
            style={{ WebkitTouchCallout: "none" }}
            onTouchStart={(e) => {
              const timer = setTimeout(() => {
                const event = new MouseEvent("contextmenu", {
                  bubbles: true,
                  cancelable: true,
                  view: window,
                  button: 2,
                  buttons: 2,
                  clientX: e.touches[0].clientX,
                  clientY: e.touches[0].clientY,
                })
                document.getElementById(`nav-item-${id}`)?.dispatchEvent(event)
              }, 500)
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
