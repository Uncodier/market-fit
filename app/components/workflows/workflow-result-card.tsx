"use client"

import { useEffect, useRef } from "react"
import type { InstanceNode } from "@/app/types/instance-nodes"
import { Badge } from "@/app/components/ui/badge"
import { Card } from "@/app/components/ui/card"
import { cn } from "@/lib/utils"
import { NODE_W, isOverallResultId } from "./types"
import type { WorkflowResultLog } from "./workflow-result-logs"

function formatLogTime(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return ""
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function logLabel(log: WorkflowResultLog) {
  return (log.log_type || "log").replace(/_/g, " ")
}

export function WorkflowResultCard({
  node,
  loading,
  logs,
  stepOutput,
  summary,
}: {
  node: InstanceNode
  loading: boolean
  logs: WorkflowResultLog[]
  stepOutput?: string
  summary?: string
}) {
  const overall = isOverallResultId(node.id)
  const empty = loading && logs.length === 0 && !stepOutput && !summary
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [logs.length])

  return (
    <Card
      className={cn(
        "relative w-full shadow-[0_0_10px_rgba(0,0,0,0.05)] border-2 border-foreground/10 bg-card rounded-3xl text-left overflow-hidden",
        empty ? "animate-pulse" : "",
      )}
      style={{ width: NODE_W }}
    >
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none truncate">
            {overall ? "Overall" : "Result"}
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-secondary/50">
            {loading ? "running" : node.status === "failed" ? "failed" : "completed"}
          </Badge>
        </div>

        {empty ? (
          <div className="min-h-[140px] rounded-xl bg-muted/30 border border-border/50 p-4 flex flex-col gap-3 justify-center">
            <div className="h-2.5 w-[85%] rounded-full bg-muted-foreground/20 animate-pulse" />
            <div className="h-2.5 w-[65%] rounded-full bg-muted-foreground/20 animate-pulse" />
            <div className="h-2.5 w-[40%] rounded-full bg-muted-foreground/20 animate-pulse" />
          </div>
        ) : (
          <div className="rounded-xl bg-muted/30 border border-border/50 p-3 flex flex-col gap-2">
            {stepOutput ? (
              <p className="text-xs text-foreground whitespace-pre-wrap">{stepOutput}</p>
            ) : null}
            {summary && summary !== stepOutput ? (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{summary}</p>
            ) : null}
            <div ref={listRef} className="max-h-[220px] overflow-y-auto flex flex-col gap-1.5 pr-1">
              {logs.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Waiting for logs…</p>
              ) : (
                logs.map((item) => (
                  <div key={item.id} className="text-[11px] leading-snug">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="uppercase tracking-wide">{logLabel(item)}</span>
                      <span className="ml-auto tabular-nums">{formatLogTime(item.created_at)}</span>
                    </div>
                    <p className="text-foreground/90 whitespace-pre-wrap break-words">{item.message || "—"}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
