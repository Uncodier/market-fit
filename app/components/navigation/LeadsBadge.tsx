"use client"

import { Badge } from "@/app/components/ui/badge"
import { useState, useEffect } from "react"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/utils/supabase/client"
import { Lead } from "@/app/leads/types"

// Función para obtener el nombre de la compañía (misma lógica que en leads/page.tsx)
const getCompanyName = (lead: Lead) => {
  if (lead.companies && lead.companies.name) {
    return lead.companies.name
  }
  if (lead.company && typeof lead.company === 'object' && lead.company.name) {
    return lead.company.name
  }
  if (typeof lead.company === 'string') {
    return lead.company
  }
  // Si no hay compañía, usar el nombre del lead como "compañía"
  return lead.name
}

// Función para obtener una clave única por empresa (misma lógica que en leads/page.tsx)
const getCompanyKey = (lead: Lead) => {
  // Si hay compañía real, usar el nombre de la compañía
  if ((lead.companies && lead.companies.name) || 
      (lead.company && typeof lead.company === 'object' && lead.company.name) ||
      (typeof lead.company === 'string')) {
    const companyName = getCompanyName(lead)
    return companyName.toLowerCase().trim()
  }
  
  // Si no hay compañía, usar el ID del lead para asegurar unicidad
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
        
        // Get all leads for the current site with company information
        const { data: leads, error: leadsError } = await supabase
          .from('leads')
          .select('id, status, site_id, name, company, companies(name)')
          .eq('site_id', currentSite.id)
        
        if (leadsError) {
          console.error('Error fetching leads:', leadsError)
          setNewCompaniesCount(0)
          return
        }

        if (!leads || leads.length === 0) {
          setNewCompaniesCount(0)
          return
        }

        // Get journey stages for all leads to find "unaware" ones
        const leadIds = leads.map(lead => lead.id)
        const { data: tasks, error: tasksError } = await supabase
          .from('tasks')
          .select('lead_id, stage, status')
          .in('lead_id', leadIds)
          .in('status', ['completed', 'in_progress'])
          .eq('site_id', currentSite.id)

        // Group tasks by lead_id and find the highest stage for each lead
        const stageOrder = ["referral", "retention", "purchase", "decision", "consideration", "awareness"]
        const leadStages: Record<string, string> = {}
        
        const tasksByLead = tasks?.reduce((acc, task) => {
          if (!acc[task.lead_id]) acc[task.lead_id] = []
          acc[task.lead_id].push(task)
          return acc
        }, {} as Record<string, any[]>) || {}

        leads.forEach(lead => {
          const leadTasks = tasksByLead[lead.id] || []
          
          if (leadTasks.length === 0) {
            leadStages[lead.id] = "not_contacted"
          } else {
            // Find the highest stage
            const highestStage = leadTasks
              .sort((a, b) => {
                const aIndex = stageOrder.indexOf(a.stage)
                const bIndex = stageOrder.indexOf(b.stage)
                return aIndex - bIndex
              })[0]?.stage || "not_contacted"
            
            leadStages[lead.id] = highestStage
          }
        })

        // Group leads by company
        const companiesByKey: Record<string, any[]> = {}
        
        leads.forEach(lead => {
          const companyKey = getCompanyKey(lead as unknown as Lead)
          if (!companiesByKey[companyKey]) {
            companiesByKey[companyKey] = []
          }
          companiesByKey[companyKey].push(lead)
        })
        
        // Count companies that have at least one "new" lead (matches what users see in New tab)
        const relevantCompanies = new Set<string>()
        
        Object.entries(companiesByKey).forEach(([companyKey, companyLeads]) => {
          // Check if company has at least one "new" lead
          const hasNewLead = companyLeads.some(lead => lead.status === 'new')
          
          // Company counts ONLY if it has at least one new lead (matches New tab filter)
          if (hasNewLead) {
            relevantCompanies.add(companyKey)
          }
        })
        
        setNewCompaniesCount(relevantCompanies.size)

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