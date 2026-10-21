"use client"

import { useId, useState, type ReactNode } from "react"
import { Badge } from "@/app/components/ui/badge"
import { ChevronDown, ChevronUp, X } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

export function MemberAccessPanel({ title, count, countLabel, summary, preview = [], initialOpen = false, children }: {
  title: string
  count: number
  countLabel: string
  summary: string
  preview?: string[]
  initialOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(initialOpen)
  const contentId = useId()

  return <section aria-label={title} className="rounded-lg border border-border/70 bg-muted/20">
    <button type="button" aria-expanded={open} aria-controls={contentId}
      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      onClick={() => setOpen(value => !value)}>
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-sm font-medium">{title}</span>
        {count > 0 ? <>
          <Badge variant="secondary">{count} {countLabel}</Badge>
          {!open && preview.length > 0 && <span className="hidden truncate text-xs text-muted-foreground sm:inline">
            {preview.join(", ")}{count > preview.length ? ` +${count - preview.length}` : ""}
          </span>}
        </> : <span className="text-xs text-muted-foreground">{summary}</span>}
      </span>
      {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> :
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </button>
    <div id={contentId} hidden={!open} className="space-y-4 border-t border-border/70 px-3 py-3">{open && children}</div>
  </section>
}

export function MemberAccessChip({ restricted, disabled, title, onClick, children }: {
  restricted: boolean
  disabled?: boolean
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return <button type="button" disabled={disabled} aria-pressed={restricted} title={title} onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
      restricted ? "border-border bg-muted text-muted-foreground" : "border-border bg-background hover:bg-accent"
    )}>
    {children}
    {restricted && <X className="h-3 w-3" size={12} />}
  </button>
}