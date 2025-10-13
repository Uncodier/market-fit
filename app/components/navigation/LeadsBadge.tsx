"use client"

import { Badge } from "@/app/components/ui/badge"
import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/utils/supabase/client"
import { Lead } from "@/app/leads/types"

// Use company_id as the unique grouping key; fall back to lead id when absent
const getCompanyKey = (lead: Lead) => {
  if (lead.company_id) {
    return String(lead.company_id)
  }
  return `lead_${lead.id}`
}

export function LeadsBadge({ isActive = false }: { isActive?: boolean }) {
  const { currentSite } = useSite()
  const [newCompaniesCount, setNewCompaniesCount] = useState(0)
  
  useEffect(() => {
    const countNewCompanies = async () => {
      if (!currentSite?.id) {
        setNewCompaniesCount(0)
        return
      }

      try {
        const supabase = createClient()
        
        // Get all NEW leads for the current site (only need ids and company_id)
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('id, status, site_id, company_id')
          .eq('site_id', currentSite.id)
          .eq('status', 'new')
        
        if (leadsError) {
          console.error('Error fetching leads:', leadsError)
          setNewCompaniesCount(0)
          return
        }

        if (!leads || leads.length === 0) {
          setNewCompaniesCount(0)
          return
        }

        // Count unique companies among NEW leads (grouped by company_id, fallback to lead id)
        const companyKeys = new Set<string>()
        for (const lead of leads as unknown as Lead[]) {
          companyKeys.add(getCompanyKey(lead))
        }

        setNewCompaniesCount(companyKeys.size)

      } catch (error) {
        console.error('Error counting new companies:', error)
        setNewCompaniesCount(0)
      }
    }

    countNewCompanies()
    
    // Refresh count every 10 seconds (reduced from 30 seconds for faster updates)
    const interval = setInterval(countNewCompanies, 10000)
    
    return () => clearInterval(interval)
  }, [currentSite?.id])
  
  // Force immediate update when component mounts
  useEffect(() => {
    if (currentSite?.id) {
      setNewCompaniesCount(0) // Reset to trigger re-render
    }
  }, [])
  
  // Don't show badge if there are no new companies
  if (newCompaniesCount === 0) {
    return null
  }
  
  return (
    <Badge 
      className="badge-override h-5 min-w-[20px] px-1.5 text-xs font-semibold border-transparent text-black badge-gradient-green"
    >
      {newCompaniesCount > 99 ? "99+" : newCompaniesCount}
    </Badge>
  )
} 