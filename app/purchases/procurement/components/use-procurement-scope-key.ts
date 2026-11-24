import { useContext, useEffect, useState } from 'react'
import { AuthContext } from '@/app/components/auth/auth-context'
import { onScreenScopeChanged } from '@/lib/permissions/screen-scope-invalidation'
import { isProcurementDemo } from '../ui/is-demo'

/** Retire private view state on an account/permission change, not a grant to read it. */
export function useProcurementScopeKey(siteId?: string) {
  const actor = useContext(AuthContext)?.user?.id
  const demo = isProcurementDemo(siteId)
  const [revision, setRevision] = useState(0)
  useEffect(() => siteId && !demo ? onScreenScopeChanged(siteId, () => setRevision(n => n + 1)) : undefined, [siteId, demo])
  return JSON.stringify([actor, siteId, demo, revision])
}