"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Lead } from "../types"

// Keep the existing shared journey-stage cache across page mounts.
const leadJourneyStagesCache: Record<string, string> = {}

export function useLeadJourneyStages(dbLeads: Lead[], currentSite: { id: string } | null) {
  const [forceReload, setForceReload] = useState(0)

  const [leadJourneyStages, setLeadJourneyStages] = useState<Record<string, string>>({})
  const [isLoadingJourneyStages, setIsLoadingJourneyStages] = useState(false)
  const [reloadingLeads, setReloadingLeads] = useState<Set<string>>(new Set())

  const invalidateJourneyStageCache = (leadId: string) => {
    delete leadJourneyStagesCache[leadId]
    setForceReload(prev => prev + 1)
  }

  useEffect(() => {
    if (currentSite?.id) {
      setForceReload(prev => prev + 1)
    }
  }, [currentSite])
  
  useEffect(() => {
    const fetchJourneyStagesForLeads = async () => {
      if (!currentSite?.id || dbLeads.length === 0) {
        setIsLoadingJourneyStages(false)
        return
      }
      
      const leadIds = dbLeads.map(lead => lead.id)
      const allLeadsInCache = leadIds.every(id => leadJourneyStagesCache[id])
      
      if (allLeadsInCache && forceReload === 0) {
        const stages: Record<string, string> = {}
        dbLeads.forEach(lead => {
          stages[lead.id] = leadJourneyStagesCache[lead.id]
        })
        setLeadJourneyStages(stages)
        setIsLoadingJourneyStages(false)
        return
      }
      
      const uncachedLeads = dbLeads.filter(lead => !leadJourneyStagesCache[lead.id])
      
      if (uncachedLeads.length === 0 && forceReload === 0) {
        setIsLoadingJourneyStages(false)
        return
      }
      
      setIsLoadingJourneyStages(true)
      const stages: Record<string, string> = {}
      
      dbLeads.forEach(lead => {
        if (leadJourneyStagesCache[lead.id]) {
          stages[lead.id] = leadJourneyStagesCache[lead.id]
        }
      })
      
      try {
        // Only query leads that are not cached.
        const supabase = createClient()
        const uncachedLeadIds = uncachedLeads.map(lead => lead.id)
        
        // If no uncached leads, skip the query
        if (uncachedLeadIds.length === 0) {
          setLeadJourneyStages(stages)
          setIsLoadingJourneyStages(false)
          return
        }
        
        // Try a simpler query first to test connection
        let allTasks = null
        let error = null

        try {
          // First, test if we can access the tasks table at all
          const testQuery = await supabase
            .from('tasks')
            .select('id')
            .eq('site_id', currentSite.id)
            .limit(1)

          if (testQuery.error) {
            console.error('Cannot access tasks table:', testQuery.error)
            throw new Error(`Tasks table access denied: ${testQuery.error.message}`)
          }

          // If test passes, do the full query
          const fullQuery = await supabase
            .from('tasks')
            .select('lead_id, stage, status, created_at, title, type')
            .in('lead_id', uncachedLeadIds)
            .in('status', ['completed', 'in_progress'])
            .eq('site_id', currentSite.id)

          allTasks = fullQuery.data
          error = fullQuery.error

        } catch (queryError) {
          error = queryError
          console.error('Query execution failed:', queryError)
        }
        
        if (error) {
          console.warn('⚠️ Journey stages fetch failed, using fallback. Error details:', {
            error,
            message: error?.message || 'Unknown error',
            code: error?.code || 'Unknown code',
            details: error?.details || 'No details',
            hint: error?.hint || 'No hint',
            uncachedLeadIds,
            siteId: currentSite.id
          })
          
          // Set default stage for uncached leads (fallback behavior)
          uncachedLeads.forEach(lead => {
            stages[lead.id] = "not_contacted"
            leadJourneyStagesCache[lead.id] = "not_contacted"
          })
          
          // Don't throw or stop execution, just continue with defaults
        } else {
          const stageOrder = ["referral", "retention", "purchase", "decision", "consideration", "awareness"]
          
          const tasksByLead = allTasks?.reduce((acc: Record<string, any[]>, task: any) => {
            if (!acc[task.lead_id]) acc[task.lead_id] = []
            acc[task.lead_id].push(task)
            return acc
          }, {} as Record<string, any[]>) || {}
          
          uncachedLeads.forEach(lead => {
            const leadTasks = tasksByLead[lead.id] || []
            
            if (leadTasks.length === 0) {
              stages[lead.id] = "not_contacted"
            } else {
              const highestStage = leadTasks
                .sort((a: any, b: any) => {
                  const aIndex = stageOrder.indexOf(a.stage)
                  const bIndex = stageOrder.indexOf(b.stage)
                  return aIndex - bIndex
                })[0]?.stage || "not_contacted"
              
              stages[lead.id] = highestStage
            }
            
            leadJourneyStagesCache[lead.id] = stages[lead.id]
          })
        }
      } catch (error) {
        console.warn('⚠️ Journey stages processing failed, using fallback:', {
          error,
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          type: typeof error,
          uncachedLeadsCount: uncachedLeads.length,
          siteId: currentSite.id
        })
        // Set default stage for uncached leads
        uncachedLeads.forEach(lead => {
          stages[lead.id] = "not_contacted"
          leadJourneyStagesCache[lead.id] = "not_contacted"
        })
      }
      
      setLeadJourneyStages(stages)
      setIsLoadingJourneyStages(false)
      
      setReloadingLeads(prev => {
        const newSet = new Set(prev)
        Object.keys(stages).forEach(leadId => {
          if (stages[leadId]) {
            newSet.delete(leadId)
          }
        })
        return newSet
      })
    }
    
    fetchJourneyStagesForLeads()
  }, [dbLeads, currentSite?.id, forceReload])

  return { forceReload, leadJourneyStages, isLoadingJourneyStages, reloadingLeads, invalidateJourneyStageCache }
}
