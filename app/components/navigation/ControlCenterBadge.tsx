"use client"

import { Badge } from "@/app/components/ui/badge"
import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/utils/supabase/client"

export function ControlCenterBadge({ isActive = false }: { isActive?: boolean }) {
  const { currentSite } = useSite()
  const [pendingTasksCount, setPendingTasksCount] = useState(0)
  
  useEffect(() => {
    const countPendingTasks = async () => {
      if (!currentSite?.id) {
        setPendingTasksCount(0)
        return
      }

      try {
        const supabase = createClient()
        
        // Get all tasks with pending status for the current site
        const { data: tasks, error } = await supabase
          .from('tasks')
          .select('id, status')
          .eq('site_id', currentSite.id)
          .eq('status', 'pending')
        
        if (error) {
          console.error('Error fetching pending tasks:', error)
          setPendingTasksCount(0)
          return
        }

        setPendingTasksCount(tasks?.length || 0)

      } catch (error) {
        console.error('Error counting pending tasks:', error)
        setPendingTasksCount(0)
      }
    }

    countPendingTasks()
    
    // Refresh count every 30 seconds
    const interval = setInterval(countPendingTasks, 30000)
    
    return () => clearInterval(interval)
  }, [currentSite?.id])
  
  // Don't show badge if there are no pending tasks
  if (pendingTasksCount === 0) {
    return null
  }
  
  return (
    <Badge 
      className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black"
      style={{
        background: 'linear-gradient(123deg, var(--token-ad13da1e-2041-4c58-8175-eb55a19eeb20, rgb(224, 255, 23)) -12%, rgb(209, 237, 28) 88.69031531531532%) !important'
      }}
    >
      {pendingTasksCount > 99 ? "99+" : pendingTasksCount}
    </Badge>
  )
} 