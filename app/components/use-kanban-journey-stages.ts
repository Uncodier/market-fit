import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import type { Lead } from "@/app/leads/types"

const leadJourneyStagesCache: Record<string, string> = {};
export function useKanbanJourneyStages(leads: Lead[], currentSite: { id: string } | null) {
  const [leadJourneyStages, setLeadJourneyStages] = useState<Record<string, string>>({})
  const [isLoadingJourneyStages, setIsLoadingJourneyStages] = useState(false) // Iniciamos en false
  const leadsKey = useMemo(() => {
    return leads.map(lead => lead.id).sort().join(',')
  }, [leads])
  
  // Organizamos los leads por estado con paginación
  useEffect(() => {
    const fetchJourneyStagesForLeads = async () => {
      if (!currentSite?.id || leads.length === 0) {
        setIsLoadingJourneyStages(false)
        return
      }
      
      // Verificar si todos los leads ya están en cache
      const leadIds = leads.map(lead => lead.id)
      const allLeadsInCache = leadIds.every(id => leadJourneyStagesCache[id])
      
      if (allLeadsInCache) {
        // Si todos están en cache, usar los valores cacheados sin mostrar loading
        const stages: Record<string, string> = {}
        leads.forEach(lead => {
          stages[lead.id] = leadJourneyStagesCache[lead.id]
        })
        setLeadJourneyStages(stages)
        setIsLoadingJourneyStages(false)
        return
      }
      
      // Solo mostrar loading si realmente necesitamos hacer la consulta
      const uncachedLeads = leads.filter(lead => !leadJourneyStagesCache[lead.id])
      if (uncachedLeads.length === 0) {
        setIsLoadingJourneyStages(false)
        return
      }
      
      setIsLoadingJourneyStages(true)
      const stages: Record<string, string> = {}
      
      // Primero, llenar con datos del cache
      leads.forEach(lead => {
        if (leadJourneyStagesCache[lead.id]) {
          stages[lead.id] = leadJourneyStagesCache[lead.id]
        }
      })
      
      try {
        // Solo consultar para leads que no están en cache
        const supabase = createClient()
        const uncachedLeadIds = uncachedLeads.map(lead => lead.id)
        
        // If no uncached leads, skip the query
        if (uncachedLeadIds.length === 0) {
          setLeadJourneyStages(stages)
          setIsLoadingJourneyStages(false)
          return
        }
        
        console.log('🔍 KanbanView: Journey stages query params:', {
          uncachedLeadIds,
          siteId: currentSite.id,
          leadCount: uncachedLeadIds.length
        })

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
            console.warn('KanbanView: Cannot access tasks table:', testQuery.error)
            throw new Error(`Tasks table access denied: ${testQuery.error.message}`)
          }

          // If test passes, do the full query
          const fullQuery = await supabase
            .from('tasks')
            .select('lead_id, stage, status')
            .in('lead_id', uncachedLeadIds)
            .eq('status', 'completed')
            .eq('site_id', currentSite.id)

          allTasks = fullQuery.data
          error = fullQuery.error

        } catch (queryError) {
          error = queryError
          console.warn('KanbanView: Query execution failed:', queryError)
        }

        console.log('🔍 KanbanView: Journey stages query result:', { 
          dataCount: allTasks?.length,
          hasError: !!error,
          errorType: typeof error
        })
        
        if (error) {
          console.warn('⚠️ KanbanView: Journey stages fetch failed, using fallback. Error details:', {
            error,
            message: (error as any)?.message || 'Unknown error',
            code: (error as any)?.code || 'Unknown code',
            details: (error as any)?.details || 'No details',
            hint: (error as any)?.hint || 'No hint',
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
          // Procesar las tasks para encontrar la etapa más alta por lead
          const stageOrder = ["referral", "retention", "purchase", "decision", "consideration", "awareness"]
          
          // Agrupar tasks por lead_id
          const tasksByLead = allTasks?.reduce((acc, task) => {
            if (!task.lead_id) return acc
            if (!acc[task.lead_id]) acc[task.lead_id] = []
            acc[task.lead_id].push(task)
            return acc
          }, {} as Record<string, any[]>) || {}
          
          // Procesar solo leads no cacheados
          uncachedLeads.forEach(lead => {
            const leadTasks = tasksByLead[lead.id] || []
            
            if (leadTasks.length === 0) {
              stages[lead.id] = "not_contacted"
            } else {
              // Encontrar la etapa más alta
              const highestStage = leadTasks
                .sort((a, b) => {
                  const aIndex = stageOrder.indexOf(a.stage)
                  const bIndex = stageOrder.indexOf(b.stage)
                  return aIndex - bIndex
                })[0]?.stage || "not_contacted"
              
              stages[lead.id] = highestStage
            }
            
            // Cachear el resultado
            leadJourneyStagesCache[lead.id] = stages[lead.id]
          })
        }
      } catch (error) {
        console.warn('⚠️ KanbanView: Journey stages processing failed, using fallback:', {
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
    }
    
    fetchJourneyStagesForLeads()
  }, [leadsKey, currentSite?.id]) // Usar leadsKey en lugar de leads
  
  // Obtener el nombre legible de una etapa

return { leadJourneyStages, isLoadingJourneyStages }
}
