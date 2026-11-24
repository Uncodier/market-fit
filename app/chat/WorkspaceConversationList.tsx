"use client"

import { useState, type ComponentProps, type ReactNode } from 'react'
import Link from 'next/link'
import { SWRConfig } from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-context'
import { ConversationListSkeleton } from '@/app/components/chat/conversation-list-skeleton'
import { ChatList } from '@/app/components/chat/chat-list'
import { Button } from '@/app/components/ui/button'
import { useLocalization } from '@/app/context/LocalizationContext'
import { useOptionalScreenAccess } from '@/app/context/ScreenAccessContext'
import { useSite } from '@/app/context/SiteContext'
import { ConversationListCacheOnly, ConversationListReadScope } from '@/app/providers/conversation-list-read-scope'
import { getDemoSiteId } from '@/lib/demo-utils'

type Props = Omit<ComponentProps<typeof ChatList>, 'siteId' | 'previewOnly'>
const coldCache = { provider: () => new Map(), keepPreviousData: false }

function Notice({ message, children }: { message: string; children?: ReactNode }) {
  return <div className="space-y-3 p-4 text-sm text-muted-foreground">
    <p role="status">{message}</p>{children}
  </div>
}

function StaleListNotice() {
  const { refreshSites } = useSite()
  const { t } = useLocalization()
  const [pending, setPending] = useState(false)
  return <Notice message={t('chat.list.stale')}>
    <Button variant="outline" size="sm" disabled={pending} onClick={async () => {
      setPending(true)
      try { await refreshSites({ recoverMissingList: true }) } finally { setPending(false) }
    }}>{t('common.retry')}</Button>
  </Notice>
}

/** Only this read-only projection may start before workspace settings. Private
 * threads, writes, review requests and all other workspace data keep their gates. */
export function WorkspaceConversationList(props: Props) {
  const auth = useAuthContext()
  const site = useSite()
  const access = useOptionalScreenAccess()
  const { t } = useLocalization()
  const actor = auth.user?.is_anonymous ? undefined : auth.user?.id
  const current = site.currentSite?.id
  const demo = current?.startsWith('demo-') && current === getDemoSiteId()
  if (current && demo && !site.isLoading) return <ChatList key={current} siteId={current} {...props} />

  const target = site.requestScope
  const verified = access?.verifiedListScope
  const sameActor = !!actor && !auth.isLoading && actor === target?.actorId
  const matches = sameActor && (!current || current === target.siteId)
  const proven = matches && verified?.actorId === actor && verified.siteId === target.siteId
  // During a staggered deployment never use the hint for early access if the
  // verification RPC is absent. The settled legacy selector + nav gates still apply.
  const legacyScope = matches && !!current && access?.screenScopeStatus === 'legacy' &&
    access.legacyListAllowed && site.sites.some(row => row.id === current)
  const legacy = legacyScope && !site.isLoading && !site.error
  const cacheOnly = !!(legacyScope && !legacy && access.conversationListCache?.hasSnapshot())

  if (target && (proven || legacy || cacheOnly)) {
    return <ConversationListReadScope.Provider value={proven ? target : null}>
      <ConversationListCacheOnly.Provider value={cacheOnly}>
        {cacheOnly && site.error && !site.isLoading && <StaleListNotice />}
        <SWRConfig key={access?.conversationListCache?.key ?? `${actor}:${target.siteId}`}
          value={access?.conversationListCache ?? coldCache}>
          <fieldset className="contents" disabled={cacheOnly}>
            <ChatList {...props} siteId={target.siteId} previewOnly={cacheOnly || !current || site.isLoading} />
          </fieldset>
        </SWRConfig>
      </ConversationListCacheOnly.Provider>
    </ConversationListReadScope.Provider>
  }

  if (auth.isLoading) return <ConversationListSkeleton label={t('chat.list.loading')} />
  if (!actor || (matches && (access?.screenScopeStatus === 'denied' || (access?.screenScopeStatus === 'ready' && !proven) ||
    (access?.isReady && !access.canAccessNavKey('chat'))))) return <Notice message={t('chat.workspace.denied')} />
  const failedCheck = matches && access?.screenScopeStatus === 'unavailable'
  const legacyRejected = matches && access?.screenScopeStatus === 'legacy' && site.sitesLoaded && !legacy
  const checkingAccess = matches && access?.screenScopeStatus === 'loading'
  if (failedCheck || (!checkingAccess && !site.isLoading && (site.error || legacyRejected))) return <Notice message={t('chat.workspace.unavailable')}>
    <Button variant="outline" size="sm" onClick={() => {
      if (failedCheck || (legacyRejected && !site.error && !access.legacyListAllowed)) access.retryScreenScope()
      else void site.refreshSites({ recoverMissingList: true })
    }}>{t('common.retry')}</Button>
  </Notice>
  if (!target && !site.isLoading) return <Notice message={t('noSiteSelected')}>
    <Link href="/projects" prefetch={false} className="underline">{t('chat.workspace.choose')}</Link>
  </Notice>
  return <ConversationListSkeleton label={t('chat.list.loading')} />
}