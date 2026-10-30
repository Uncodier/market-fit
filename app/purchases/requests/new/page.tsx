'use client'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProcurementEditorLoading } from '../../procurement/ui/editor-loading'
import { useSite } from '@/app/context/SiteContext'
import { isRealSiteId, isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import { RequestEditor } from '../request-editor'
import { demoRequestDocument } from '@/lib/demo-data/procurement-workflow'
import type { RequestDocument } from '../schema'

export default function Page() {
  const { t } = useProcurementI18n()
  const { currentSite } = useSite()
  if (!currentSite) return <ProcurementEditorLoading />
  if (!isRealSiteId(currentSite.id) && !isDemoSiteId(currentSite.id)) return <p className="p-6">{t('procurement.workflow.request.selectCreateWorkspace')}</p>
  return <CreateRequest key={currentSite.id} siteId={currentSite.id} />
}
function CreateRequest({ siteId }: { siteId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(document: RequestDocument) {
    if (isDemoSiteId(siteId) || isDemoModeActive()) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/procurement/requests?site_id=${siteId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_revision: 0, document }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      router.push(`/purchases/requests/${result.id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create request') }
    finally { setBusy(false) }
  }
  return <RequestEditor creating initial={isDemoSiteId(siteId) || isDemoModeActive() ? demoRequestDocument : undefined} siteId={siteId} busy={busy} onSave={save} serverError={error} onCancel={() => router.push('/purchases/requests')} />
}
