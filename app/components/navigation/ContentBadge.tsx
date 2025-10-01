"use client"

import { Badge } from "@/app/components/ui/badge"
import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/utils/supabase/client"

export function ContentBadge({ isActive = false }: { isActive?: boolean }) {
  const { currentSite } = useSite()
  const [reviewContentCount, setReviewContentCount] = useState(0)
  
  useEffect(() => {
    const countReviewContent = async () => {
      if (!currentSite?.id) {
        setReviewContentCount(0)
        return
      }

      try {
        const supabase = createClient()
        
        // Get all content items with review status for the current site
        const { data: content, error } = await supabase
          .from('content')
          .select('id, status')
          .eq('site_id', currentSite.id)
          .eq('status', 'review')
        
        if (error) {
          console.error('Error fetching review content:', error)
          setReviewContentCount(0)
          return
        }

        setReviewContentCount(content?.length || 0)

      } catch (error) {
        console.error('Error counting review content:', error)
        setReviewContentCount(0)
      }
    }

    countReviewContent()
    
    // Refresh count every 30 seconds
    const interval = setInterval(countReviewContent, 30000)
    
    return () => clearInterval(interval)
  }, [currentSite?.id])
  
  // Don't show badge if there are no content items in review
  if (reviewContentCount === 0) {
    return null
  }
  
  return (
    <Badge 
      className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black badge-gradient-green"
    >
      {reviewContentCount > 99 ? "99+" : reviewContentCount}
    </Badge>
  )
} 