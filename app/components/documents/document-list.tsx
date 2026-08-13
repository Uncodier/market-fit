"use client"

import React from "react"
import { cn } from "@/lib/utils"
import { TableHead, TableRow } from "@/app/components/ui/table"
import { Globe, Quotes, ShoppingCart, Store } from "@/app/components/ui/icons"

const AVATAR_TONES = [
  "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300",
  "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300",
  "bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300",
]

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-500",
  completed: "bg-emerald-500",
  cancelled: "bg-rose-400",
  refunded: "bg-violet-500",
  draft: "bg-zinc-400",
  active: "bg-emerald-500",
  new: "bg-sky-500",
  contacted: "bg-amber-500",
  qualified: "bg-violet-500",
  cold: "bg-zinc-400",
  converted: "bg-emerald-500",
  lost: "bg-rose-400",
  not_qualified: "bg-orange-500",
  awareness: "bg-sky-500",
  consideration: "bg-amber-500",
  decision: "bg-violet-500",
  purchase: "bg-emerald-500",
  retention: "bg-indigo-500",
  referral: "bg-pink-500",
  not_contacted: "bg-zinc-400",
  in_progress: "bg-sky-500",
  preparing: "bg-sky-500",
  shipped: "bg-sky-500",
  in_transit: "bg-indigo-500",
  delivered: "bg-emerald-500",
  failed: "bg-rose-500",
  paused: "bg-amber-500",
  expired: "bg-zinc-400",
  confirmed: "bg-sky-500",
  canceled: "bg-rose-400",
  sent: "bg-sky-500",
  accepted: "bg-emerald-500",
  rejected: "bg-rose-400",
  inactive: "bg-zinc-400",
  prospecting: "bg-sky-500",
  proposal: "bg-violet-500",
  negotiation: "bg-amber-500",
  closed_won: "bg-emerald-500",
  closed_lost: "bg-rose-400",
  available: "bg-emerald-500",
  sold_out: "bg-amber-500",
  unavailable: "bg-rose-400",
  archived: "bg-zinc-400",
  review: "bg-amber-500",
  published: "bg-emerald-500",
  always: "bg-emerald-500",
  closed: "bg-zinc-400",
  backlog: "bg-zinc-400",
  "in-progress": "bg-violet-500",
  "on-review": "bg-sky-500",
  done: "bg-emerald-500",
  validated: "bg-emerald-500",
  pageview: "bg-sky-500",
  click: "bg-emerald-500",
  form_submission: "bg-violet-500",
  scroll: "bg-amber-500",
  engagement: "bg-indigo-500",
  session_recording: "bg-rose-500",
  sale: "bg-sky-500",
  expense: "bg-rose-500",
  opening: "bg-violet-500",
  manual: "bg-orange-500",
  asset: "bg-sky-500",
  liability: "bg-amber-500",
  equity: "bg-violet-500",
  income: "bg-emerald-500",
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
}

const STATUS_TEXT: Record<string, string> = {
  pending: "text-amber-700 dark:text-amber-400",
  completed: "text-emerald-700 dark:text-emerald-400",
  cancelled: "text-muted-foreground",
  refunded: "text-violet-700 dark:text-violet-400",
  draft: "text-muted-foreground",
  active: "text-emerald-700 dark:text-emerald-400",
  new: "text-sky-700 dark:text-sky-400",
  contacted: "text-amber-700 dark:text-amber-400",
  qualified: "text-violet-700 dark:text-violet-400",
  cold: "text-muted-foreground",
  converted: "text-emerald-700 dark:text-emerald-400",
  lost: "text-muted-foreground",
  not_qualified: "text-orange-700 dark:text-orange-400",
  awareness: "text-sky-700 dark:text-sky-400",
  consideration: "text-amber-700 dark:text-amber-400",
  decision: "text-violet-700 dark:text-violet-400",
  purchase: "text-emerald-700 dark:text-emerald-400",
  retention: "text-indigo-700 dark:text-indigo-400",
  referral: "text-pink-700 dark:text-pink-400",
  not_contacted: "text-muted-foreground",
  in_progress: "text-sky-700 dark:text-sky-400",
  preparing: "text-sky-700 dark:text-sky-400",
  shipped: "text-sky-700 dark:text-sky-400",
  in_transit: "text-indigo-700 dark:text-indigo-400",
  delivered: "text-emerald-700 dark:text-emerald-400",
  failed: "text-rose-700 dark:text-rose-400",
  paused: "text-amber-700 dark:text-amber-400",
  expired: "text-muted-foreground",
  confirmed: "text-sky-700 dark:text-sky-400",
  canceled: "text-muted-foreground",
  sent: "text-sky-700 dark:text-sky-400",
  accepted: "text-emerald-700 dark:text-emerald-400",
  rejected: "text-rose-700 dark:text-rose-400",
  inactive: "text-muted-foreground",
  prospecting: "text-sky-700 dark:text-sky-400",
  proposal: "text-violet-700 dark:text-violet-400",
  negotiation: "text-amber-700 dark:text-amber-400",
  closed_won: "text-emerald-700 dark:text-emerald-400",
  closed_lost: "text-muted-foreground",
  available: "text-emerald-700 dark:text-emerald-400",
  sold_out: "text-amber-700 dark:text-amber-400",
  unavailable: "text-rose-700 dark:text-rose-400",
  archived: "text-muted-foreground",
  review: "text-amber-700 dark:text-amber-400",
  published: "text-emerald-700 dark:text-emerald-400",
  always: "text-emerald-700 dark:text-emerald-400",
  closed: "text-muted-foreground",
  backlog: "text-muted-foreground",
  "in-progress": "text-violet-700 dark:text-violet-400",
  "on-review": "text-sky-700 dark:text-sky-400",
  done: "text-emerald-700 dark:text-emerald-400",
  validated: "text-emerald-700 dark:text-emerald-400",
  pageview: "text-sky-700 dark:text-sky-400",
  click: "text-emerald-700 dark:text-emerald-400",
  form_submission: "text-violet-700 dark:text-violet-400",
  scroll: "text-amber-700 dark:text-amber-400",
  engagement: "text-indigo-700 dark:text-indigo-400",
  session_recording: "text-rose-700 dark:text-rose-400",
  sale: "text-sky-700 dark:text-sky-400",
  expense: "text-rose-700 dark:text-rose-400",
  opening: "text-violet-700 dark:text-violet-400",
  manual: "text-orange-700 dark:text-orange-400",
  asset: "text-sky-700 dark:text-sky-400",
  liability: "text-amber-700 dark:text-amber-400",
  equity: "text-violet-700 dark:text-violet-400",
  income: "text-emerald-700 dark:text-emerald-400",
  high: "text-rose-700 dark:text-rose-400",
  medium: "text-amber-700 dark:text-amber-400",
  low: "text-sky-700 dark:text-sky-400",
}

export function documentListShellClassName(className?: string) {
  return cn(
    "overflow-hidden rounded-xl border border-border/70 bg-card",
    className
  )
}

export function DocumentListHead({
  children,
  className,
  align = "left",
}: {
  children: React.ReactNode
  className?: string
  align?: "left" | "right"
}) {
  return (
    <TableHead
      className={cn(
        "h-10 px-4 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80",
        align === "right" && "text-right",
        className
      )}
    >
      {children}
    </TableHead>
  )
}

export function DocumentListRow({
  children,
  onClick,
  accent,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  accent?: "due" | "cancelled" | "none"
  className?: string
}) {
  return (
    <TableRow
      onClick={onClick}
      className={cn(
        "group cursor-pointer border-b border-border/50 transition-colors hover:bg-muted/40",
        accent === "due" && "shadow-[inset_3px_0_0_0] shadow-amber-400 dark:shadow-amber-500",
        accent === "cancelled" && "opacity-70",
        className
      )}
    >
      {children}
    </TableRow>
  )
}

export function initialsFromName(name?: string | null) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

function toneFromName(name?: string | null) {
  const value = name || ""
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash + value.charCodeAt(i) * (i + 1)) % 997
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

export function EntityAvatar({ name, className }: { name?: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tracking-wide",
        toneFromName(name),
        className
      )}
    >
      {initialsFromName(name)}
    </span>
  )
}

export function EntityCell({
  name,
  secondary,
  meta,
  secondaryMono = true,
}: {
  name?: string | null
  secondary?: string | null
  meta?: string | null
  secondaryMono?: boolean
}) {
  const displayName = (name || "").trim() || "—"
  return (
    <div className="flex min-w-0 items-center gap-3">
      <EntityAvatar name={name} />
      <div className="min-w-0 space-y-0.5">
        <p className="truncate text-sm font-medium leading-tight text-foreground">{displayName}</p>
        {secondary ? (
          <p className={cn(
            "truncate text-[11px] leading-tight text-muted-foreground",
            secondaryMono && "font-mono"
          )}>{secondary}</p>
        ) : null}
        {meta ? (
          <p className="truncate text-[11px] leading-tight text-muted-foreground/80">{meta}</p>
        ) : null}
      </div>
    </div>
  )
}

export function StatusDot({ status, label }: { status: string; label: string }) {
  const key = status.toLowerCase()
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-medium", STATUS_TEXT[key] || "text-foreground")}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[key] || "bg-muted-foreground")} />
      {label}
    </span>
  )
}

export function SourceLabel({
  source,
  label,
}: {
  source: string
  label: string
}) {
  const key = source.toLowerCase()
  const Icon =
    key === "pos" || key === "retail"
      ? Store
      : key === "quote"
        ? Quotes
        : key === "marketplace"
          ? ShoppingCart
          : Globe

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon size={13} className="opacity-70" />
      <span className="capitalize">{label}</span>
    </span>
  )
}

export function MoneyCell({
  amountLabel,
  dueLabel,
  paidLabel,
  cancelled,
  paidRatio,
}: {
  amountLabel: string
  dueLabel?: string | null
  paidLabel?: string | null
  cancelled?: boolean
  paidRatio?: number | null
}) {
  const showMeter = typeof paidRatio === "number" && paidRatio < 1 && !cancelled

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={cn(
          "text-[15px] font-semibold tabular-nums tracking-tight",
          cancelled && "text-muted-foreground line-through decoration-muted-foreground/60"
        )}
      >
        {amountLabel}
      </span>
      {dueLabel ? (
        <span className="text-[11px] font-medium tabular-nums text-amber-600 dark:text-amber-400">
          {dueLabel}
        </span>
      ) : paidLabel ? (
        <span className="text-[11px] text-muted-foreground">{paidLabel}</span>
      ) : null}
      {showMeter ? (
        <span className="mt-0.5 h-1 w-14 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-amber-500"
            style={{ width: `${Math.max(6, Math.round((paidRatio || 0) * 100))}%` }}
          />
        </span>
      ) : null}
    </div>
  )
}

export function documentRowAccent(status: string, amountDue: number): "due" | "cancelled" | "none" {
  if (status === "cancelled" || status === "canceled" || status === "refunded" || status === "failed" || status === "expired" || status === "rejected") return "cancelled"
  if (amountDue > 0) return "due"
  return "none"
}

export function normalizeSource(source?: string | null, channel?: string | null) {
  const raw = (channel || source || "").toLowerCase()
  if (raw === "retail" || raw === "pos") return "pos"
  if (raw === "online" || raw === "shop") return "shop"
  if (raw === "quote") return "quote"
  if (raw === "marketplace") return "marketplace"
  return raw || "online"
}
