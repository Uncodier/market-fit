"use client"

import type { ReactNode } from "react"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"

/** Announce one pending region, not each decorative placeholder. */
export function AgentLoadingRegion({ label, className, children }: { label?: string; className?: string; children: ReactNode }) {
  const { t } = useLocalization()
  return <div role="status" aria-busy="true" aria-label={label ?? t("common.loading")}
    className={cn("min-w-0 motion-reduce:[&_.animate-pulse]:animate-none", className)}>
    <div aria-hidden="true">{children}</div>
  </div>
}

/** Keep the toolbar footprint without mounting navigation, shortcuts or layout listeners. */
export function AgentSkeletonToolbar({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[71px] w-full min-w-0 flex-wrap items-center gap-3 border-b bg-background px-4 py-3 lg:px-8">
    {children}
  </div>
}