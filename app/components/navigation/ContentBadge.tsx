"use client"

import { Badge } from "@/app/components/ui/badge"
import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/utils/supabase/client"

export function ContentBadge({ isActive = false }: { isActive?: boolean }) {
  const { currentSite } = useSite()
  const [draftContentCount, setDraftContentCount] = useState(0)
  
  useEffect(() => {
    const countDraftContent = async () => {
      if (!currentSite?.id) {
        setDraftContentCount(0)
        return
      }

      try {
        const supabase = createClient()
        
        // Get all content items with draft status for the current site
        const { data: content, error } = await supabase
          .from('content')
          .select('id, status')
          .eq('site_id', currentSite.id)
          .eq('status', 'draft')
        
        if (error) {
          console.error('Error fetching draft content:', error)
          setDraftContentCount(0)
          return
        }

        setDraftContentCount(content?.length || 0)

      } catch (error) {
        console.error('Error counting draft content:', error)
        setDraftContentCount(0)
      }
    }

    countDraftContent()
    
    // Refresh count every 30 seconds
    const interval = setInterval(countDraftContent, 30000)
    
    return () => clearInterval(interval)
  }, [currentSite?.id])
  
  // Don't show badge if there are no draft content items
  if (draftContentCount === 0) {
    return null
  }
  
  return (
    <Badge 
      className={`h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent hover:bg-yellow-500 ${
        isActive 
          ? "bg-yellow-400 text-black dark:bg-yellow-400 dark:text-black" 
          : "bg-yellow-400 text-muted-foreground dark:bg-yellow-400 dark:text-black"
      }`}
    >
      {draftContentCount > 99 ? "99+" : draftContentCount}
    </Badge>
  )
} 