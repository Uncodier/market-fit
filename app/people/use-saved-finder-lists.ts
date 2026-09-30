import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface SavedFinderList {
  id: string
  name: string | null
  status: string | null
  role_query_id: string
  total_targets: number | null
  processed_targets: number | null
  found_matches: number | null
  progress_percent: string | null
}

interface SavedListsState {
  siteId: string
  lists: SavedFinderList[]
  loading: boolean
  error: boolean
}

export function useSavedFinderLists(siteId: string | undefined, enabled: boolean) {
  const [state, setState] = useState<SavedListsState | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    if (!enabled || !siteId) return
    let active = true
    setState({ siteId, lists: [], loading: true, error: false })

    const load = async () => {
      try {
        // The list belongs to the site directly; role_query_segments has no FK to icp_mining.
        const { data, error } = await createClient()
          .from('icp_mining')
          .select('id, name, status, created_at, total_targets, role_query_id, processed_targets, found_matches, progress_percent')
          .eq('site_id', siteId)
          .order('created_at', { ascending: false })

        if (error) throw error
        if (!Array.isArray(data)) throw new Error('Invalid saved lists response')
        if (active) setState({ siteId, lists: data as SavedFinderList[], loading: false, error: false })
      } catch (error) {
        console.error('[People] Load saved lists error:', error)
        if (active) setState({ siteId, lists: [], loading: false, error: true })
      }
    }

    void load()
    return () => { active = false }
  }, [siteId, enabled, retryCount])

  const currentState = enabled && siteId && state?.siteId === siteId ? state : null
  const refresh = () => setRetryCount(count => count + 1)
  const remove = (id: string) => setState(previous =>
    previous && previous.siteId === siteId
      ? { ...previous, lists: previous.lists.filter(list => list.id !== id) }
      : previous
  )
  const rename = (id: string, name: string) => setState(previous =>
    previous && previous.siteId === siteId
      ? { ...previous, lists: previous.lists.map(list => list.id === id ? { ...list, name } : list) }
      : previous
  )

  return {
    lists: currentState?.lists || [],
    loading: Boolean(enabled && siteId && (!currentState || currentState.loading)),
    error: Boolean(currentState?.error),
    refresh,
    remove,
    rename,
  }
}