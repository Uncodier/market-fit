"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import styles from "./toolbar-action-groups.module.css"

export function ToolbarActionGroups({ children, className }: { children: ReactNode; className?: string }) {
  return <div data-toolbar-action-groups data-toolbar-icon-actions className={cn("flex min-w-0 items-center", styles.groups, className)}>{children}</div>
}

export function ToolbarActionGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <div role="group" aria-label={label} data-toolbar-action-group className={cn("flex shrink-0 items-center gap-1", className)}>{children}</div>
}