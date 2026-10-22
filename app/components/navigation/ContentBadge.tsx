"use client"

import type { FC } from "react"
import { Badge } from "@/app/components/ui/badge"
import { useBadgeCount } from "./use-badge-count"

export const ContentBadge: FC<{ isActive?: boolean }> = () => {
  const count = useBadgeCount("content")
  if (count === 0) return null
  return (
    <Badge className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black badge-gradient-green">
      {count > 99 ? "99+" : count}
    </Badge>
  )
}