"use client"

import { useId, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export function ReportSection({ title, description, action, children, className, embedded = false }: {
  title: string
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  embedded?: boolean
}) {
  const titleId = useId()
  return (
    <section aria-labelledby={embedded ? undefined : titleId} aria-label={embedded ? title : undefined} className={cn("min-w-0 space-y-4", className)}>
      {(!embedded || action) && <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {!embedded &&
        <div className="min-w-0 space-y-1">
          <h2 id={titleId} className="text-base font-semibold tracking-tight">{title}</h2>
          {description && <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>}
        {action && <div className={cn("min-w-0 shrink-0", embedded && "sm:ml-auto")}>{action}</div>}
      </div>}
      {children}
    </section>
  )
}

export function ReportDetails({ summary = "About this report", children, className }: {
  summary?: string
  children: ReactNode
  className?: string
}) {
  return (
    <details className={cn("min-w-0 border-t pt-3 text-xs text-muted-foreground", className)}>
      <summary className="w-fit max-w-full cursor-pointer rounded-sm py-1 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {summary}
      </summary>
      <div className="max-w-4xl space-y-2 pt-2 leading-relaxed">{children}</div>
    </details>
  )
}

export function ReportKpiGrid({ children, className, columns = 4, ...props }: {
  children: ReactNode; className?: string; columns?: 3 | 4; "aria-label"?: string
}) {
  return <div {...props} className={cn(
    "grid min-w-0 grid-cols-2 gap-3 [&>*]:min-w-0 max-[359px]:grid-cols-1 max-[359px]:[&>*:first-child]:col-span-1",
    // Shared tracks align titles, values and footnotes without truncating longer content.
    "supports-[grid-template-rows:subgrid]:[&>[data-report-kpi]]:row-span-3 supports-[grid-template-rows:subgrid]:[&>[data-report-kpi]]:grid-rows-subgrid",
    columns === 3 ? "sm:grid-cols-3 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1" : "xl:grid-cols-4",
    className,
  )}>{children}</div>
}