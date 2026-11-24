"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useAuthContext } from '@/app/components/auth/auth-context'
import { Button } from '@/app/components/ui/button'
import { SectionSkeleton } from '@/app/components/ui/section-skeleton'
import { useSite } from '@/app/context/SiteContext'
import { hasSettledSiteSettings } from '@/app/context/site-types'
import { useOptionalScreenAccess } from '@/app/context/ScreenAccessContext'
import { useLocalization } from '@/app/context/LocalizationContext'
import { getDemoSiteId } from '@/lib/demo-utils'
import { workspacePreviewRoute, type PreviewRoute } from './routes'
import { PREVIEW_LIMIT, WorkspacePreviewError, type WorkspacePreviewRow } from './types'

type Startup = { route: PreviewRoute; phase: 'checking' | 'preview' | 'denied' | 'missing' | 'unavailable';
  siteId?: string; actorId?: string; retry: () => void; syncFailed: boolean }
const StartupContext = createContext<Startup | null>(null)
export const useWorkspaceStartup = () => useContext(StartupContext)

export function WorkspaceStartupBoundary({ pathname, search, children }: { pathname: string; search: string; children: ReactNode }) {
  const route = useMemo(() => workspacePreviewRoute(pathname, search), [pathname, search])
  // No client/private reads or new prerequisites on POS, detail, editor, public,
  // demo, filtered or unregistered routes. They retain their own admission.
  if (!route) return children
  return <ReviewStartup route={route}>{children}</ReviewStartup>
}

function ReviewStartup({ route, children }: { route: PreviewRoute; children: ReactNode }) {
  const auth = useAuthContext()
  const site = useSite()
  const access = useOptionalScreenAccess()
  const actor = auth.isLoading || auth.user?.is_anonymous ? undefined : auth.user?.id
  const live = site.currentSite?.id
  const target = site.requestScope
  const matches = !!actor && target?.actorId === actor && (!live || live === target.siteId)
  const proof = access?.verifiedWorkspaceLists
  const confirmed = matches && proof?.actorId === actor && proof.siteId === target.siteId
  const blocked = !auth.isLoading && (!actor || (matches && (access?.screenScopeStatus === 'denied' ||
    (access?.isReady && !access.canAccessNavKey(route.screen)))))
  const rejectedScope = access?.screenScopeStatus === 'unavailable'
  const retry = useCallback(() => {
    if (rejectedScope) access?.retryScreenScope()
    else void site.refreshSites({ recoverMissingList: true })
  }, [rejectedScope, access, site])
  const demo = getDemoSiteId()
  if (demo && live === demo && !site.isLoading) return children
  // For settled legacy/location-scoped reads, defer to their original actors,
  // screen guards and backend permissions. A provisional read requires proof.
  const settledLegacy = access?.screenScopeStatus === 'legacy' && access.legacyWorkspaceListsAllowed && !site.error &&
    !!live && site.sites.some(row => row.id === live)
  const phase = demo ? 'checking' : blocked ? 'denied' : confirmed && access?.canAccessNavKey(route.screen) ? 'preview'
    : rejectedScope || (!site.isLoading && (site.error || (access?.screenScopeStatus === 'legacy' && !settledLegacy))) ? 'unavailable'
    : !auth.isLoading && !site.isLoading && !live && !target ? 'missing' : 'checking'
  const interactive = !demo && matches && live && !site.isLoading && hasSettledSiteSettings(site.currentSite) && !blocked &&
    (access?.screenScopeStatus === 'ready' || settledLegacy)
  return <StartupContext.Provider key={JSON.stringify([route.screen, actor, matches && target.siteId])}
    value={interactive ? null : { route, phase, retry, actorId: actor, siteId: matches ? target.siteId : undefined,
    syncFailed: !!site.error && !site.isLoading }}>{children}</StartupContext.Provider>
}

// A fast hydration costs zero preview requests. A slow one may run one bounded
// projection with its own access checks. It never populates the full page cache.
export const PREVIEW_DELAY_MS = 350
const DEADLINE_MS = 5_000
type Result = { phase: 'loading' | 'denied' | 'failed' | 'stalled' | 'timedOut' } | { phase: 'ready'; rows: WorkspacePreviewRow[] }

function VerifiedPreview({ scope }: { scope: Startup & { actorId: string; siteId: string } }) {
  const { t } = useLocalization()
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result>({ phase: 'loading' })
  const { route, siteId, actorId } = scope
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let deadline: ReturnType<typeof setTimeout> | undefined
    const start = setTimeout(() => {
      deadline = setTimeout(() => { controller.abort(); setResult({ phase: 'stalled' }) }, DEADLINE_MS)
      void Promise.resolve().then(() => route.load({ actorId, siteId, signal: controller.signal })).then(rows => {
        if (controller.signal.aborted) return
        if (!Array.isArray(rows) || rows.length > PREVIEW_LIMIT || rows.some(r => !r || typeof r.id !== 'string' || !r.id ||
          typeof r.label !== 'string' || (r.detail !== undefined && typeof r.detail !== 'string'))) {
          throw new WorkspacePreviewError()
        }
        setResult({ phase: 'ready', rows })
      }).catch((error: unknown) => {
        if (!controller.signal.aborted) setResult({ phase: error instanceof WorkspacePreviewError && error.denied ? 'denied' : 'failed' })
      }).finally(() => {
        clearTimeout(deadline)
        if (active && controller.signal.aborted) setResult({ phase: 'timedOut' })
      })
    }, PREVIEW_DELAY_MS)
    return () => { active = false; clearTimeout(start); clearTimeout(deadline); controller.abort() }
  }, [route, siteId, actorId, attempt])

  const failed = result.phase === 'failed' || result.phase === 'timedOut'
  if (result.phase === 'loading' && !scope.syncFailed) return <SectionSkeleton />
  const canRetry = result.phase !== 'stalled' && result.phase !== 'denied' && (failed || scope.syncFailed)
  return <section aria-label={t('workspacePreview.title')} className="space-y-3 p-6" aria-busy={result.phase === 'loading'}>
    <p className="text-sm text-muted-foreground" role="status">{t(result.phase === 'stalled' ? 'workspacePreview.stalled' : result.phase === 'denied' ? 'workspacePreview.denied' : failed ? 'workspacePreview.failed'
      : scope.syncFailed ? 'workspacePreview.syncFailed' : 'workspacePreview.title')}</p>
    {result.phase === 'ready' && (result.rows.length ? <ul className="divide-y rounded-md border">{result.rows.map(row => <li key={row.id}
      className="flex items-center justify-between gap-4 px-4 py-2 text-sm"><span className="truncate">{row.label}</span>
      {row.detail && <span className="truncate text-muted-foreground">{row.detail}</span>}</li>)}</ul>
      : <p className="text-sm">{t('workspacePreview.empty')}</p>)}
    {canRetry && <Button type="button" variant="outline" size="sm" onClick={() => {
      if (failed) { setResult({ phase: 'loading' }); setAttempt(n => n + 1) }
      if (scope.syncFailed) scope.retry()
    }}>{t('common.retry')}</Button>}
    {(result.phase === 'stalled' || result.phase === 'timedOut') && <Button type="button" variant="outline" size="sm"
      onClick={() => window.location.reload()}>{t('workspacePreview.reload')}</Button>}
  </section>
}

export function WorkspaceStartupContent({ children }: { children: ReactNode }) {
  const scope = useWorkspaceStartup()
  const { t } = useLocalization()
  if (!scope) return children
  if (scope.phase === 'checking') return <SectionSkeleton />
  if (scope.phase === 'preview') return scope.actorId && scope.siteId ? <VerifiedPreview
    key={JSON.stringify([scope.route.screen, scope.actorId, scope.siteId])} scope={{ ...scope, actorId: scope.actorId, siteId: scope.siteId }} /> : <SectionSkeleton />
  return <div className="space-y-3 p-6 text-sm" role="status">
    {t(scope.phase === 'unavailable' ? 'workspacePreview.failed' : scope.phase === 'denied' ? 'workspacePreview.denied'
      : 'noSiteSelected')}
    {scope.phase === 'unavailable' && <div><Button size="sm" variant="outline" onClick={scope.retry}>{t('common.retry')}</Button></div>}
    {scope.phase === 'missing' && <div><Link href="/projects" prefetch={false} className="underline">{t('chat.workspace.choose')}</Link></div>}
  </div>
}