import { useState, useEffect, useMemo } from 'react'
import { useAuthContext } from '@/app/components/auth/auth-context'
import { useSite } from '@/app/context/SiteContext'
import { createClient } from '@/lib/supabase/client'
import { readVisibleProfiles, type VisibleProfile } from '@/app/services/read-visible-profile'

export function useUserData(userIds: string[]) {
  const { currentSite, isLoading } = useSite()
  const auth = useAuthContext()
  const key = currentSite && !isLoading && !auth.isLoading && auth.user && !auth.user.is_anonymous && userIds.length
    ? JSON.stringify([auth.user.id, currentSite.id, [...new Set(userIds)].sort()]) : null
  const scope = useMemo(() => key ? { ids: (JSON.parse(key) as [string, string, string[]])[2] } : null, [key])
  const [snapshot, setSnapshot] = useState<{ scope: object; data: Record<string, VisibleProfile> } | null>(null)
  useEffect(() => {
    if (!scope) return
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort(); setSnapshot({ scope, data: {} }) }, 5_000)
    void readVisibleProfiles(createClient(), scope.ids, controller.signal).then(
      data => { if (!controller.signal.aborted) setSnapshot({ scope, data }) },
      () => { if (!controller.signal.aborted) setSnapshot({ scope, data: {} }) },
    ).finally(() => clearTimeout(timer))
    return () => { clearTimeout(timer); controller.abort() }
  }, [scope])
  return { userData: snapshot?.scope === scope ? snapshot.data : {}, loading: !!scope && snapshot?.scope !== scope }
} 