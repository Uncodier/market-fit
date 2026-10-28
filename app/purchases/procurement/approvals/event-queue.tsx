'use client'

import { useEffect, useState } from 'react'
import { useSite } from '@/app/context/SiteContext'
import { isRealSiteId } from '@/lib/demo-utils'
import { EventApprovals } from './event-approvals'
import { ProcurementState } from '../ui/workspace'

export function EventApprovalQueue() {
  const { currentSite } = useSite()
  if (!currentSite || !isRealSiteId(currentSite.id)) return null
  return <Queue key={currentSite.id} siteId={currentSite.id} />
}
function Queue({ siteId }: { siteId: string }) {
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
    <h2 className="text-xl font-semibold">Publication and purchase commitments</h2>
    <p className="text-sm text-muted-foreground">Pending approvals among the latest 100 visible events. These are independent of requisition approvals.</p>
    <ProcurementState loading={loading} error={error} empty={!loading && !error && !targets.length} emptyTitle="No pending approvals" description="Publication and purchase commitment approvals assigned to you will appear here." />
    {targets.map(target => <EventApprovals key={target} siteId={siteId} targetId={target} />)}
  </section>
}