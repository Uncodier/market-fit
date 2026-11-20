import { useEffect, useState } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { savedListSnapshotSchema, type SavedListReference, type SavedListSnapshot } from './saved-list-types'

export function useSavedListMembers(list: SavedListReference | null) {
  const [cursor, setCursor] = useState<{ reference: SavedListReference; page: number } | null>(null)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{
    reference: SavedListReference; id: string; siteId: string; page: number; revision: number; loading: boolean; error: string | null;
    identityChanged: boolean; snapshot: SavedListSnapshot | null
  } | null>(null)
  const id = list?.id
  const siteId = list?.siteId
  const page = cursor && cursor.reference === list ? cursor.page : 1

  useEffect(() => {
    if (!id || !siteId || !list) return
    const client = createClient()
    const controller = new AbortController()
    let active = true
    let actor: string | null | undefined
    const base = { reference: list, id, siteId, page, revision, snapshot: null, identityChanged: false }
    const retireIdentity = () => {
      active = false
      controller.abort()
      setState({ ...base, loading: false, identityChanged: true, error: 'Your session changed. Select the list again.' })
    }
    const { data: listener } = client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!active) return
      const nextActor = event === 'SIGNED_OUT' ? null : session?.user?.id ?? null
      if (actor !== undefined && actor !== nextActor) retireIdentity()
      else actor = nextActor
    })
    const load = async () => {
      try {
        const session = await client.auth.getSession()
        if (!active) return
        const sessionActor = session.data.session?.user?.id ?? null
        if (actor !== undefined && actor !== sessionActor) { retireIdentity(); return }
        actor = sessionActor
        if (session.error || !actor) throw new Error('Authentication required')
        const params = new URLSearchParams({ site_id: siteId, page: String(page) })
        const response = await fetch(`/api/finder/lists/${encodeURIComponent(id)}/members?${params}`, {
          credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        })
        if (!active) return
        if (!response.ok) throw new Error('Members unavailable')
        const snapshot = savedListSnapshotSchema.parse(await response.json())
        if (!active) return
        if (snapshot.id !== id || snapshot.siteId !== siteId || snapshot.page !== page
          || snapshot.members.some(m => m.personId !== m.result.person.id) || snapshot.completed > snapshot.total) {
          throw new Error('Invalid list response')
        }
        setState({ ...base, loading: false, error: null, snapshot })
      } catch {
        if (active) setState({ ...base, loading: false, error: 'Could not load list members. Please try again.' })
      }
    }
    void load()
    return () => { active = false; controller.abort(); listener.subscription.unsubscribe() }
  }, [id, siteId, list, page, revision])

  const current = list && state?.reference === list && state.page === page && state.revision === revision ? state : null
  return {
    snapshot: current?.snapshot ?? null, page,
    loading: Boolean(list && (!current || current.loading)), error: current?.error ?? null,
    identityChanged: current?.identityChanged ?? false,
    refresh: () => setRevision(value => value + 1),
    onPageChange: (next: number) => {
      if (list && current && !current.identityChanged && (current.snapshot || next === 1)
        && Number.isSafeInteger(next) && next >= 1 && next <= 100_000) {
        setCursor({ reference: list, page: next })
      }
    },
  }
}