import { useAuthContext } from '@/app/components/auth/auth-context'
import { useOptionalPermissions } from '@/app/context/PermissionContext'
import { useOptionalScreenAccess } from '@/app/context/ScreenAccessContext'
import { useSite } from '@/app/context/SiteContext'
import { getDemoSiteId } from '@/lib/demo-utils'

/** Only the interactive site can open a form. A preview target is not a grant.
 * The key also retires already selected IDs, not just the option list. */
export function useTopbarDialogScope(screen: string) {
  const { currentSite, requestScope, isLoading } = useSite()
  const auth = useAuthContext()
  const permissions = useOptionalPermissions()
  const access = useOptionalScreenAccess()
  const siteId = currentSite?.id
  const demo = getDemoSiteId()
  const actor = !auth.isLoading && !auth.user?.is_anonymous ? auth.user?.id : undefined
  const identityReady = demo ? demo === siteId : !siteId?.startsWith('demo-') && actor &&
    requestScope?.actorId === actor && requestScope.siteId === siteId
  const scopeReady = !!siteId && !isLoading && !!identityReady &&
    (!access || (access.isReady && access.canAccessNavKey(screen))) &&
    (!permissions || (permissions.siteId === siteId && !!permissions.capabilities))
  const canOpen = scopeReady && (!permissions || permissions.can('insert'))
  return {
    siteId: canOpen ? siteId : null,
    scopeReady,
    key: JSON.stringify([screen, siteId, actor, demo, canOpen, permissions?.capabilities?.role]),
  }
}