"use client"

import { Badge } from "@/app/components/ui/badge"
import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/utils/supabase/client"

export function RequirementsBadge({ isActive = false }: { isActive?: boolean }) {
  const { currentSite } = useSite()
  const [reviewCount, setReviewCount] = useState(0)
  
  useEffect(() => {
    const countReviewRequirements = async () => {
      if (!currentSite?.id) {
        setReviewCount(0)
        return
      }

      try {
        const supabase = createClient()
        
        // Get all requirements for the current site
        const { data: requirements, error } = await supabase
          .from('requirements')
          .select('id, status')
          .eq('site_id', currentSite.id)
        
        if (error) {
          console.error('Error fetching requirements:', error)
          setReviewCount(0)
          return
        }

        // Count only requirements that are in review status
        const reviewRequirements = (requirements || []).filter(req => {
          return req.status === 'on-review'
        })

        setReviewCount(reviewRequirements.length)

      } catch (error) {
        console.error('Error counting review requirements:', error)
        setReviewCount(0)
      }
    }

    countReviewRequirements()
    
    // Refresh count every 30 seconds
    const interval = setInterval(countReviewRequirements, 30000)
    
    return () => clearInterval(interval)
  }, [currentSite?.id])
  
  // Don't show badge if there are no requirements in review
  if (reviewCount === 0) {
    return null
  }
  
  return (
    <Badge 
      className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black badge-gradient-green"
    >
      {reviewCount > 99 ? "99+" : reviewCount}
    </Badge>
  )
}

export function CampaignsBadge({ isActive = false }: { isActive?: boolean }) {
  const { currentSite } = useSite()
  const [pendingCampaignsCount, setPendingCampaignsCount] = useState(0)
  
  useEffect(() => {
    const countPendingCampaigns = async () => {
      if (!currentSite?.id) {
        setPendingCampaignsCount(0)
        return
      }

      try {
        const supabase = createClient()
        
        // Get all campaigns for the current site
        const { data: campaigns, error } = await supabase
          .from('campaigns')
          .select('id, status')
          .eq('site_id', currentSite.id)
        
        if (error) {
          console.error('Error fetching campaigns:', error)
          setPendingCampaignsCount(0)
          return
        }

        // Count only campaigns that are pending
        const pendingCampaigns = (campaigns || []).filter(campaign => {
          return campaign.status === 'pending'
        })

        setPendingCampaignsCount(pendingCampaigns.length)

      } catch (error) {
        console.error('Error counting pending campaigns:', error)
        setPendingCampaignsCount(0)
      }
    }

    countPendingCampaigns()
    
    // Refresh count every 30 seconds
    const interval = setInterval(countPendingCampaigns, 30000)
    
    return () => clearInterval(interval)
  }, [currentSite?.id])
  
  // Don't show badge if there are no pending campaigns
  if (pendingCampaignsCount === 0) {
    return null
  }
  
  return (
    <Badge 
      className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black badge-gradient-green"
    >
      {pendingCampaignsCount > 99 ? "99+" : pendingCampaignsCount}
    </Badge>
  )
} 