"use client"

import { Badge } from "@/app/components/ui/badge"
import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/utils/supabase/client"

export function RequirementsBadge({ isActive = false }: { isActive?: boolean }) {
  const { currentSite } = useSite()
  const [backlogPendingCount, setBacklogPendingCount] = useState(0)
  
  useEffect(() => {
    const countBacklogPendingRequirements = async () => {
      if (!currentSite?.id) {
        setBacklogPendingCount(0)
        return
      }

      try {
        const supabase = createClient()
        
        // Get all requirements for the current site
        const { data: requirements, error } = await supabase
          .from('requirements')
          .select('id, completion_status, status')
          .eq('site_id', currentSite.id)
        
        if (error) {
          console.error('Error fetching requirements:', error)
          setBacklogPendingCount(0)
          return
        }

        // Count only requirements that are in backlog and pending:
        // - status = 'backlog' (not yet started)
        // - completion_status = 'pending' (not completed)
        const backlogPendingRequirements = (requirements || []).filter(req => {
          const isBacklog = req.status === 'backlog'
          const isPending = req.completion_status === 'pending'
          
          const shouldCount = isBacklog && isPending
          
          return shouldCount
        })

        setBacklogPendingCount(backlogPendingRequirements.length)

      } catch (error) {
        console.error('Error counting backlog pending requirements:', error)
        setBacklogPendingCount(0)
      }
    }

    countBacklogPendingRequirements()
    
    // Refresh count every 30 seconds
    const interval = setInterval(countBacklogPendingRequirements, 30000)
    
    return () => clearInterval(interval)
  }, [currentSite?.id])
  
  // Don't show badge if there are no backlog pending requirements
  if (backlogPendingCount === 0) {
    return null
  }
  
  return (
    <Badge 
      className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black"
      style={{
        background: 'linear-gradient(123deg, var(--token-ad13da1e-2041-4c58-8175-eb55a19eeb20, rgb(224, 255, 23)) -12%, rgb(209, 237, 28) 88.69031531531532%) !important'
      }}
    >
      {backlogPendingCount > 99 ? "99+" : backlogPendingCount}
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
      className="h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black"
      style={{
        background: 'linear-gradient(123deg, var(--token-ad13da1e-2041-4c58-8175-eb55a19eeb20, rgb(224, 255, 23)) -12%, rgb(209, 237, 28) 88.69031531531532%) !important'
      }}
    >
      {pendingCampaignsCount > 99 ? "99+" : pendingCampaignsCount}
    </Badge>
  )
} 