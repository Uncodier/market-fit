'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSite } from '@/app/context/SiteContext'
import { isRealSiteId } from '@/lib/demo-utils'
import { RequestEditor } from '../request-editor'
import type { RequestDocument } from '../schema'

export default function Page() {
  const { currentSite } = useSite()
  if (!currentSite || !isRealSiteId(currentSite.id)) return <p className="p-6">Select a real workspace to create a request.</p>
  return <CreateRequest key={currentSite.id} siteId={currentSite.id} />
}
function CreateRequest({ siteId }: { siteId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(document: RequestDocument) {
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/procurement/requests?site_id=${siteId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_revision: 0, document }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      router.push(`/purchases/requests/${result.id}`)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create request') }
    finally { setBusy(false) }
  }
  return <RequestEditor siteId={siteId} busy={busy} onSave={save} serverError={error} onCancel={() => router.push('/purchases/requests')} />
}
