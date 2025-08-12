"use client"

import { Badge } from "@/app/components/ui/badge"
import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/utils/supabase/client"

export function ChatsBadge({ isActive = false }: { isActive?: boolean }) {
  const { currentSite } = useSite()
  const [pendingConversationsCount, setPendingConversationsCount] = useState(0)
  
  useEffect(() => {
    const countPendingConversations = async () => {
      if (!currentSite?.id) {
        setPendingConversationsCount(0)
        return
      }

      try {
        const supabase = createClient()
        
        // Get all conversations with pending status for the current site
        const { data: conversations, error } = await supabase
          .from('conversations')
          .select('id, status')
          .eq('site_id', currentSite.id)
          .eq('status', 'pending')
          .eq('is_archived', false)
        
        if (error) {
          console.error('Error fetching pending conversations:', error)
          setPendingConversationsCount(0)
          return
        }

        const count = conversations?.length || 0
        setPendingConversationsCount(count)

      } catch (error) {
        console.error('Error counting pending conversations:', error)
        setPendingConversationsCount(0)
      }
    }

    countPendingConversations()
    
    // Refresh count every 10 seconds for real-time updates
    const interval = setInterval(countPendingConversations, 10000)
    
    return () => clearInterval(interval)
  }, [currentSite?.id])
  
  // Don't show badge if there are no pending conversations
  if (pendingConversationsCount === 0) {
    return null
  }
  
  return (
    <Badge 
      className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black"
      style={{
        background: 'linear-gradient(123deg, var(--token-ad13da1e-2041-4c58-8175-eb55a19eeb20, rgb(224, 255, 23)) -12%, rgb(209, 237, 28) 88.69031531531532%) !important'
      }}
    >
      {pendingConversationsCount > 99 ? "99+" : pendingConversationsCount}
    </Badge>
  )
} 