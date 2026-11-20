import { useEffect, useRef, useState } from 'react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export type FinderScopeCheck = (requestActor?: string | null) => boolean

/** Retire workspace state on sign-out or account changes, not token refresh. */
export function useFinderSessionScope() {
  const [generation, setGeneration] = useState(0)
  const liveGeneration = useRef(0)
  const liveActor = useRef<string | null>(null)
  useEffect(() => {
    const auth = createClient()?.auth
    if (!auth) return
    let active = true
    let actor: string | null | undefined
    const observe = (event: AuthChangeEvent, session: Session | null) => {
      if (!active) return
      const next = event === 'SIGNED_OUT' ? null : session?.user?.id ?? null
      if (actor === next) return
      if (actor !== undefined || event === 'SIGNED_OUT') setGeneration(++liveGeneration.current)
      actor = next
      liveActor.current = next
    }
    const { data: { subscription } } = auth.onAuthStateChange(observe)
    void Promise.resolve(auth.getSession()).then(({ data, error }) => {
      if (!error && actor === undefined) observe('INITIAL_SESSION', data.session)
    }).catch(() => { /* Never turn a transport failure into a sign-out. */ })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  const isSessionCurrent: FinderScopeCheck = requestActor => liveGeneration.current === generation
    && (requestActor === undefined || (requestActor !== null && requestActor === liveActor.current))
  return { generation, isSessionCurrent }
}