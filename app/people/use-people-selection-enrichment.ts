import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { apiClient } from '@/app/services/api-client-service'
import type { PeoplePageState } from './use-people-page-state'
import type { FinderScopeCheck } from './use-finder-session-scope'

type Options = Pick<PeoplePageState, 'currentSite' | 'selectedPersonIds' | 'setSelectedPersonIds' | 'setIsEnriching' | 'setIsConfirmModalOpen'> & {
  captureResultScope: () => FinderScopeCheck
}

export function usePeopleSelectionEnrichment(options: Options) {
  const { currentSite, selectedPersonIds, setSelectedPersonIds, setIsEnriching, setIsConfirmModalOpen, captureResultScope } = options
  const confirmation = useRef<{ siteId: string; ids: string[]; current: FinderScopeCheck } | null>(null)
  const [confirmedCount, setConfirmedCount] = useState(0)
  const enriching = useRef(false)
  const openEnrichConfirmation = () => {
    if (!currentSite?.id || !selectedPersonIds.length || enriching.current) return
    const current = captureResultScope()
    if (!current()) return
    confirmation.current = { siteId: currentSite.id, ids: [...selectedPersonIds], current }
    setConfirmedCount(selectedPersonIds.length)
    setIsConfirmModalOpen(true)
  }
  const setEnrichConfirmationOpen = (open: boolean) => {
    if (open) return
    confirmation.current = null
    setConfirmedCount(0)
    setIsConfirmModalOpen(false)
  }
  const handleEnrich = async () => {
    const action = confirmation.current
    if (enriching.current || !action || !action.current() || action.siteId !== currentSite?.id) return
    enriching.current = true
    setIsEnriching(true)
    setEnrichConfirmationOpen(false)
    try {
      const completed = new Set<string>()
      let failures = 0
      for (const personId of action.ids) {
        if (!action.current()) break
        try {
          const response = await apiClient.post('/api/workflow/enrichLead', {
            site_id: action.siteId, person_id: personId,
          }, { includeAuth: true, canSend: action.current })
          if (response.success) completed.add(personId)
          else failures++
        } catch {
          failures++
        }
      }
      if (!action.current()) return
      if (completed.size) {
        toast.success(`Successfully enriched ${completed.size} ${completed.size === 1 ? 'person' : 'people'}`)
        setSelectedPersonIds(previous => previous.filter(id => !completed.has(id)))
      }
      if (failures) toast.error(`Failed to enrich ${failures} ${failures === 1 ? 'person' : 'people'}`)
    } finally {
      enriching.current = false
      setIsEnriching(false)
    }
  }
  return { handleEnrich, openEnrichConfirmation, setEnrichConfirmationOpen, confirmedCount }
}