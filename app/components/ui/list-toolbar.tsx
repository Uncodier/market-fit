import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Desktop list layout. Mobile drawers render their own compact header. */
export function ListToolbar({ search, tabs, actions, controls, className }: {
  search?: ReactNode
  tabs?: ReactNode
  actions?: ReactNode
  controls?: ReactNode
  className?: string
}) {
  return (
    <div data-list-toolbar className={cn("flex w-full min-w-0 flex-wrap items-center gap-2 md:gap-3", className)}>
      {tabs && <div data-toolbar-zone="tabs" data-toolbar-tabs className="flex min-w-0 max-w-full items-center gap-2">{tabs}</div>}
      {actions && <div data-toolbar-zone="tools" data-toolbar-actions data-toolbar-icon-actions className="mx-auto flex min-w-0 flex-wrap items-center justify-center gap-1">{actions}</div>}
      {(search || controls) && (
        <div data-toolbar-zone="view" data-toolbar-controls className="ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2">
          {search && <div data-toolbar-search className="min-w-0 max-w-full [&_*]:max-w-full">{search}</div>}
          {controls}
        </div>
      )}
    </div>
  )
}