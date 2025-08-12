"use client"

import { Badge } from "@/app/components/ui/badge"
import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/utils/supabase/client"

export function RobotsBadge({ isActive = false }: { isActive?: boolean }) {
  const { currentSite } = useSite()
  const [activeRobotsCount, setActiveRobotsCount] = useState(0)
  
  useEffect(() => {
    const countActiveRobots = async () => {
      if (!currentSite?.id) {
        setActiveRobotsCount(0)
        return
      }

      try {
        const supabase = createClient()
        
        // Get all robot instances with active status for the current site
        const { data: robots, error } = await supabase
          .from('remote_instances')
          .select('id, status')
          .eq('site_id', currentSite.id)
          .in('status', ['running', 'active', 'starting', 'pending', 'initializing'])
        
        if (error) {
          console.error('Error fetching active robots:', error)
          setActiveRobotsCount(0)
          return
        }

        setActiveRobotsCount(robots?.length || 0)

      } catch (error) {
        console.error('Error counting active robots:', error)
        setActiveRobotsCount(0)
      }
    }

    countActiveRobots()
    
    // Refresh count every 30 seconds
    const interval = setInterval(countActiveRobots, 30000)
    
    return () => clearInterval(interval)
  }, [currentSite?.id])

  // Setup real-time monitoring for robot instances
  useEffect(() => {
    if (!currentSite?.id) return

    const supabase = createClient()
    
    const robotsSubscription = supabase
      .channel(`robots_badge_${currentSite.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'remote_instances',
          filter: `site_id=eq.${currentSite.id}`
        },
        () => {
          // Refresh count when any robot instance changes
          const countActiveRobots = async () => {
            try {
              const { data: robots, error } = await supabase
                .from('remote_instances')
                .select('id, status')
                .eq('site_id', currentSite.id)
                .in('status', ['running', 'active', 'starting', 'pending', 'initializing'])
              
              if (!error) {
                setActiveRobotsCount(robots?.length || 0)
              }
            } catch (error) {
              console.error('Error counting active robots in real-time:', error)
            }
          }
          countActiveRobots()
        }
      )
      .subscribe()

    return () => {
      robotsSubscription.unsubscribe()
    }
  }, [currentSite?.id])
  
  // Don't show badge if there are no active robots
  if (activeRobotsCount === 0) {
    return null
  }
  
  return (
    <Badge 
      className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black"
      style={{
        background: 'linear-gradient(123deg, var(--token-ad13da1e-2041-4c58-8175-eb55a19eeb20, rgb(224, 255, 23)) -12%, rgb(209, 237, 28) 88.69031531531532%) !important'
      }}
    >
      {activeRobotsCount > 99 ? "99+" : activeRobotsCount}
    </Badge>
  )
}
