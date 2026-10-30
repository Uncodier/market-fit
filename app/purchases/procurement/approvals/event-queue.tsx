'use client'

import { useEffect, useState } from 'react'
import { useSite } from '@/app/context/SiteContext'
import { isRealSiteId } from '@/lib/demo-utils'
import { EventApprovals } from './event-approvals'
import { ProcurementState } from '../ui/workspace'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'

export function EventApprovalQueue() {
  const { currentSite } = useSite()
  if (!currentSite || !isRealSiteId(currentSite.id)) return null
  return <Queue key={currentSite.id} siteId={currentSite.id} />
}
function Queue({ siteId }: { siteId: string }) {
  const { t, message } = useProcurementI18n()
  const [targets, setTargets] = useState<string[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/procurement/approvals?site_id=${siteId}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load publication and commerce approvals')
        const data: { approvals: { target_id: string; status: string }[] } = await response.json()
        if (!controller.signal.aborted) setTargets([...new Set(data.approvals.filter(row => row.status === 'pending').map(row => row.target_id))])
      }).catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [siteId])
  return <section className="space-y-6">
    <h2 className="text-xl font-semibold">{t('procurement.partners.approvals.queueTitle')}</h2>
    <p className="text-sm text-muted-foreground">{t('procurement.partners.approvals.queueHint')}</p>
    <ProcurementState loading={loading} error={message(error)} empty={!loading && !error && !targets.length} emptyTitle={t('procurement.partners.approvals.queueEmpty')} description={t('procurement.partners.approvals.queueEmptyHint')} />
    {targets.map(target => <EventApprovals key={target} siteId={siteId} targetId={target} />)}
  </section>
}