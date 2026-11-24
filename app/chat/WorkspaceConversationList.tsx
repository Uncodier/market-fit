"use client"

import { type ComponentProps, type ReactNode } from 'react'
import Link from 'next/link'
import { SWRConfig } from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-context'
import { ConversationListSkeleton } from '@/app/components/chat/conversation-list-skeleton'
import { ChatList } from '@/app/components/chat/chat-list'
import { Button } from '@/app/components/ui/button'
import { useLocalization } from '@/app/context/LocalizationContext'
import { useOptionalScreenAccess } from '@/app/context/ScreenAccessContext'
import { useSite } from '@/app/context/SiteContext'
import { ConversationListReadScope } from '@/app/providers/conversation-list-read-scope'
import { getDemoSiteId } from '@/lib/demo-utils'

type Props = Omit<ComponentProps<typeof ChatList>, 'siteId' | 'previewOnly'>
const listCache = { provider: () => new Map(), keepPreviousData: false }

function Notice({ message, children }: { message: string; children?: ReactNode }) {
  return <div className="space-y-3 p-4 text-sm text-muted-foreground">
    <p role="status">{message}</p>{children}
  </div>
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
  const legacy = matches && !!current && !site.isLoading && !site.error && access?.screenScopeStatus === 'legacy' &&
    access.legacyListAllowed && site.sites.some(row => row.id === current)

  if (proven || legacy) {
    return <ConversationListReadScope.Provider value={proven ? target : null}>
      <SWRConfig key={`${actor}:${target.siteId}`} value={listCache}>
        <ChatList {...props} siteId={target.siteId} previewOnly={!current || site.isLoading} />
      </SWRConfig>
    </ConversationListReadScope.Provider>
  }

  if (auth.isLoading) return <ConversationListSkeleton label={t('chat.list.loading')} />
  if (!actor || (matches && (access?.screenScopeStatus === 'denied' || (access?.screenScopeStatus === 'ready' && !proven) ||
    (access?.isReady && !access.canAccessNavKey('chat'))))) return <Notice message={t('chat.workspace.denied')} />
  const failedCheck = matches && access?.screenScopeStatus === 'unavailable'
  if (failedCheck || site.error || (matches && access?.screenScopeStatus === 'legacy' && !site.isLoading && !legacy)) return <Notice message={t('chat.workspace.unavailable')}>
    <Button variant="outline" size="sm" onClick={() => {
      if (failedCheck) access.retryScreenScope()
      else void site.refreshSites({ recoverMissingList: true })
    }}>{t('common.retry')}</Button>
  </Notice>
  if (!target && !site.isLoading) return <Notice message={t('noSiteSelected')}>
    <Link href="/projects" prefetch={false} className="underline">{t('chat.workspace.choose')}</Link>
  </Notice>
  return <ConversationListSkeleton label={t('chat.list.loading')} />
}