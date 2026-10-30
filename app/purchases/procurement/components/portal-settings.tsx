'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { z } from 'zod'
import { toast } from 'sonner'
import { SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader } from '@/app/components/ui/section-card'
import { Button } from '@/app/components/ui/button'
import { Toggle } from './form-fields'
import { useProcurementI18n } from '../i18n/use-procurement-i18n'
import { PortalSettingsSkeleton } from '../ui/settings-skeleton'
import { useSite } from '@/app/context/SiteContext'
import { toSiteSlug } from '@/app/book/site-slug'
import { isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'

const portalSchema = z.object({ enabled: z.boolean(), slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/).nullable() })
type Portal = z.infer<typeof portalSchema>

export function PortalSettings({ siteId, disabled = false }: { siteId: string; disabled?: boolean }) {
  return <WorkspacePortal key={siteId} siteId={siteId} disabled={disabled} />
}

function WorkspacePortal({ siteId, disabled }: { siteId: string; disabled: boolean }) {
  const demo = isDemoSiteId(siteId)
  const { t, valueLabel } = useProcurementI18n()
  const { currentSite } = useSite()
  const publicSlug = currentSite?.id === siteId ? toSiteSlug(currentSite.name) : ''
  const [saved, setSaved] = useState<Portal | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const inFlight = useRef(false)
  const active = useRef(true)
  const saveRequest = useRef<AbortController | null>(null)
  const url = `/api/procurement/tenders/portal?site_id=${encodeURIComponent(siteId)}`

  useEffect(() => {
    active.current = true
    return () => { active.current = false; saveRequest.current?.abort() }
  }, [])

  useEffect(() => {
    if (demo) {
      const timer = setTimeout(() => {
        setSaved({ enabled: true, slug: 'demo-workplace' }); setEnabled(true); setLoading(false);
      }, 0)
      return () => clearTimeout(timer)
    }
    if (isDemoModeActive()) return
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('load')
        const portal = portalSchema.parse(await response.json())
        if (!cancelled) { setSaved(portal); setEnabled(portal.enabled) }
      } catch { if (!cancelled) setError('procurement.policy.portal.loadError') }
      finally { clearTimeout(timer); if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true; clearTimeout(timer); controller.abort() }
  }, [url, refresh, demo])

  async function save() {
    if (demo || isDemoModeActive() || disabled || !saved || inFlight.current || enabled === saved.enabled) return
    inFlight.current = true; setSaving(true); setError('')
    const controller = new AbortController()
    saveRequest.current = controller
    const timer = setTimeout(() => controller.abort(), 15000)
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }), signal: controller.signal })
      if (!response.ok) throw new Error('save')
      const portal = portalSchema.parse(await response.json())
      if (portal.enabled !== enabled || !portal.slug) throw new Error('unconfirmed')
      if (active.current) { setSaved(portal); setEnabled(portal.enabled); toast.success(t('procurement.policy.portal.saved')) }
    } catch {
      if (active.current) { setError('procurement.policy.portal.saveError'); setSaved(null) }
    } finally {
      clearTimeout(timer); inFlight.current = false
      if (active.current) setSaving(false)
    }
  }

  if (loading) return <PortalSettingsSkeleton />
  return <SectionCard id="procurement-settings-portal" className="scroll-mt-36">
    <SectionCardHeader title={t('procurement.workflow.tender.workspacePortal')} description={t('procurement.policy.portal.description')} />
    <SectionCardContent>
      {error && <div role="alert" className="space-y-2"><p>{t(error)}</p>
        <Button type="button" variant="outline" disabled={loading || saving} onClick={() => {
          setLoading(true); setError(''); setSaved(null); setRefresh(value => value + 1)
        }}>{t('procurement.common.retry')}</Button>
      </div>}
      {saved && <>
        <p>{t('procurement.workflow.tender.portalDescription', { status: valueLabel(saved.enabled ? 'enabled' : 'disabled') })}</p>
        <fieldset disabled={demo || disabled || saving || loading}>
          <Toggle label={t('procurement.workflow.tender.enablePortal')} checked={enabled} onChange={setEnabled} />
        </fieldset>
        {saved.slug && <Link className="block break-all text-sm underline" href={demo ? '/purchases/tenders' : `/tenders/${publicSlug || saved.slug}`}>{demo ? 'Preview demo tenders' : `/tenders/${publicSlug || saved.slug}`}</Link>}
      </>}
      <p className="text-sm text-muted-foreground">{t('procurement.policy.portal.separate')}</p>
    </SectionCardContent>
    <SectionCardFooter onSave={() => void save()} saving={saving} dirty={!!saved && enabled !== saved.enabled}
      saveDisabled={demo || disabled || loading || saving || !saved || enabled === saved.enabled}
      saveLabel={t('procurement.policy.portal.save')} savingLabel={t('procurement.policy.page.saving')} />
  </SectionCard>
}