import { useEffect, useRef, useState } from 'react'
import type { AuthChangeEvent, AuthError, Session } from '@supabase/supabase-js'
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
  userId: string | null
  generation: number
  lists: SavedFinderList[]
  loading: boolean
  error: boolean
}

export function useSavedFinderLists(siteId: string | undefined, enabled: boolean) {
  const [state, setState] = useState<SavedListsState | null>(null)
  const generation = useRef(0)
  const identity = useRef<{ siteId: string; userId: string | null } | null>(null)
  const reload = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!enabled || !siteId) return
    let active = true
    let authEvents = 0
    let initialSessionResolved = false
    let deferredLoad: ReturnType<typeof setTimeout> | undefined
    const client = createClient()
    identity.current = { siteId, userId: null }

    const invalidate = (userId: string | null, error = false, loading = Boolean(userId)) => {
      const nextGeneration = ++generation.current
      identity.current = { siteId, userId }
      setState({ siteId, userId, generation: nextGeneration, lists: [], loading, error })
      return nextGeneration
    }

    // Hide snapshots immediately, and reject responses even if auth changes back to the same user.
    invalidate(null, false, true)

    const load = async () => {
      const userId = identity.current?.userId
      if (!active || !userId) return
      const requestGeneration = invalidate(userId)
      try {
        // The list belongs to the site directly; role_query_segments has no FK to icp_mining.
        // RLS is authoritative: do not substitute a client-side owner filter.
        const { data, error } = await client
          .from('icp_mining')
          .select('id, name, status, created_at, total_targets, role_query_id, processed_targets, found_matches, progress_percent')
          .eq('site_id', siteId)
          .order('created_at', { ascending: false })

        if (error) throw error
        if (!Array.isArray(data)) throw new Error('Invalid saved lists response')
        if (active && generation.current === requestGeneration) {
          setState({ siteId, userId, generation: requestGeneration, lists: data as SavedFinderList[], loading: false, error: false })
        }
      } catch (error) {
        if (!active || generation.current !== requestGeneration) return
        console.error('[People] Load saved lists error:', error)
        setState({ siteId, userId, generation: requestGeneration, lists: [], loading: false, error: true })
      }
    }

    const scheduleLoad = () => {
      clearTimeout(deferredLoad)
      // Supabase holds its auth lock during the callback. Query only after it returns.
      deferredLoad = setTimeout(() => { void load() }, 0)
    }
    const initialAuthEvents = authEvents
    const { data: { subscription } } = client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!active) return
      authEvents++
      const userId = session?.user.id ?? null
      // getSession can resolve before the SDK's INITIAL_SESSION callback. It
      // already started this exact RLS read. A real sign-in/update still retires it.
      if (event === 'INITIAL_SESSION' && initialSessionResolved && identity.current?.userId === userId) return
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' ||
          identity.current?.userId !== userId) {
        invalidate(event === 'SIGNED_OUT' ? null : userId)
        clearTimeout(deferredLoad)
        if (event !== 'SIGNED_OUT' && userId) scheduleLoad()
      }
    })

    void client.auth.getSession().then(({ data, error }: { data: { session: Session | null }; error: AuthError | null }) => {
      if (!active || authEvents !== initialAuthEvents) return
      if (error) throw error
      const userId = data.session?.user.id ?? null
      initialSessionResolved = true
      invalidate(userId)
      if (userId) void load()
    }).catch((error: unknown) => {
      if (!active || authEvents !== initialAuthEvents) return
      console.error('[People] Load saved lists session error:', error)
      invalidate(null, true)
    })

    const refresh = () => { void load() }
    reload.current = refresh
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    const interval = setInterval(refresh, 30_000)
    return () => {
      active = false
      identity.current = null
      reload.current = null
      clearTimeout(deferredLoad)
      clearInterval(interval)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
      subscription.unsubscribe()
    }
  }, [siteId, enabled])

  const currentState = enabled && siteId && state?.siteId === siteId ? state : null
  const refresh = () => reload.current?.()
  const remove = (id: string) => setState(previous =>
    enabled && previous && previous.siteId === siteId && previous.generation === generation.current
      ? { ...previous, lists: previous.lists.filter(list => list.id !== id) }
      : previous
  )
  const rename = (id: string, name: string) => setState(previous =>
    enabled && previous && previous.siteId === siteId && previous.generation === generation.current
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