"use client"

import { Badge } from "@/app/components/ui/badge"
import { useRobots } from "@/app/context/RobotsContext"

export function RobotsBadge({ isActive = false }: { isActive?: boolean }) {
  const { totalRunningRobots } = useRobots()
  
  // Don't show badge if there are no running robots
  if (totalRunningRobots === 0) {
    return null
  }
  
  return (
    <Badge 
      className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black badge-gradient-green"
    >
      {totalRunningRobots > 99 ? "99+" : totalRunningRobots}
    </Badge>
  )
}
