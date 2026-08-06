"use client"

import { useEffect, useRef } from "react"
import { Loader2, Sparkles } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import { cn } from "@/lib/utils"
import type { DynamicQuoteProgressLog } from "@/app/quotations/dynamic-quote-progress"

export function DynamicQuoteProgressFeed({
  logs,
  className,
}: {
  logs: DynamicQuoteProgressLog[]
  className?: string
}) {
  const { t } = useLocalization()
  const bottomRef = useRef<HTMLDivElement>(null)
  const visibleLogs = logs.slice(-4)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [visibleLogs.length, visibleLogs[visibleLogs.length - 1]?.id])

  if (!logs.length) return null

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-muted/30 overflow-hidden",
        className
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium">
          {t("pdp.dynamicQuote.workingOnQuote") || "Working on your quote"}
        </span>
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground ml-auto animate-pulse" />
      </div>

      <div className="max-h-36 overflow-y-auto px-4 py-3 space-y-2.5">
        {visibleLogs.map((log, index) => {
          const isLatest = index === visibleLogs.length - 1
          return (
            <div
              key={log.id}
              className={cn(
                "flex gap-2.5 text-sm transition-all duration-300",
                isLatest ? "opacity-100" : "opacity-60"
              )}
            >
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  log.logType === "thinking" && "bg-sky-500",
                  log.logType === "tool_call" && "bg-violet-500",
                  log.logType === "agent_action" && "bg-emerald-500",
                  log.logType === "status" && "bg-muted-foreground",
                  isLatest && "animate-pulse"
                )}
              />
              <p
                className={cn(
                  "leading-snug",
                  isLatest ? "text-foreground" : "text-muted-foreground",
                  log.logType === "tool_call" && "font-medium"
                )}
              >
                {log.text}
              </p>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
