"use client"

import { Badge } from "@/app/components/ui/badge"
import { useRobots } from "@/app/context/RobotsContext"

export function RobotsBadge({ isActive = false }: { isActive?: boolean }) {
  const { totalActiveRobots } = useRobots()
  
  // Don't show badge if there are no active robots
  if (totalActiveRobots === 0) {
    return null
  }
  
  return (
    <Badge 
      className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black"
      style={{
        background: 'linear-gradient(123deg, var(--token-ad13da1e-2041-4c58-8175-eb55a19eeb20, rgb(224, 255, 23)) -12%, rgb(209, 237, 28) 88.69031531531532%) !important'
      }}
    >
      {totalActiveRobots > 99 ? "99+" : totalActiveRobots}
    </Badge>
  )
}
