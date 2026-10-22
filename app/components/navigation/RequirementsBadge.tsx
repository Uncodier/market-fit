"use client"

import type { FC } from "react"
import { Badge } from "@/app/components/ui/badge"
import { useBadgeCount } from "./use-badge-count"

export const RequirementsBadge: FC<{ isActive?: boolean }> = () => {
  const count = useBadgeCount("requirements")
  if (count === 0) return null
  return (
    <Badge className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black badge-gradient-green">
      {count > 99 ? "99+" : count}
    </Badge>
  )
}

export const CampaignsBadge: FC<{ isActive?: boolean }> = () => {
  const count = useBadgeCount("campaigns")
  if (count === 0) return null
  return (
    <Badge className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black badge-gradient-green">
      {count > 99 ? "99+" : count}
    </Badge>
  )
}