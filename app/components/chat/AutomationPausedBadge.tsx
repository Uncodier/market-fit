"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/app/components/ui/badge"
import { isAutomationPaused } from "@/lib/chat/automation-snooze"

export function AutomationPausedBadge({ until }: { until?: string | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!until) return
    const remaining = Date.parse(until) - Date.now()
    if (!Number.isFinite(remaining) || Date.parse(until) <= now) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, Math.min(remaining + 1, 2_147_483_647)))
    return () => clearTimeout(timer)
  }, [until, now])
  if (!isAutomationPaused(until, now) || !until) return null
  const label = new Date(until).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short",
  })
  return (
    <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-400 border-amber-500/30 whitespace-normal" title={`Automation paused until ${label}`}>
      Paused until <time dateTime={until} className="ml-1">{label}</time>
    </Badge>
  )
}