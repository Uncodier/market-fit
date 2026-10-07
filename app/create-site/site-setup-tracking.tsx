"use client"

import { useCallback, useSyncExternalStore } from 'react'
import { useAuth } from '@/app/hooks/use-auth'
import { siteSetupStore } from './site-setup-store'
import { SiteSetupNotice } from './site-setup-notice'

const serverSnapshot = () => null

export function SiteSetupTracking({ siteId }: { siteId: string }) {
  const { user } = useAuth()
  const userId = user?.id ?? ''
  const subscribe = useCallback((listener: () => void) => siteSetupStore.subscribe(userId, siteId, listener), [userId, siteId])
  const getSnapshot = useCallback(() => siteSetupStore.getSnapshot(userId, siteId), [userId, siteId])
  const feedback = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot)
  if (!feedback) return null
  return <SiteSetupNotice key={`${userId}:${siteId}`} feedback={feedback}
    onCheck={() => siteSetupStore.check(userId, siteId)} />
}