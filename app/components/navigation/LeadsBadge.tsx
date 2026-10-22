"use client"

import type { FC } from "react"
import { Badge } from "@/app/components/ui/badge"
import { useBadgeCount } from "./use-badge-count"

export const LeadsBadge: FC<{ isActive?: boolean }> = () => {
  const count = useBadgeCount("leads")
  if (count === 0) return null
  return (
    <Badge className="badge-override h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black badge-gradient-green">
      {count > 99 ? "99+" : count}
    </Badge>
  )
}