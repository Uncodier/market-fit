'use client'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import { useEffect, useState } from 'react'
import { Input } from '@/app/components/ui/input'
import type { RequestDocument } from './schema'

export function ServiceEstimate({ siteId, line, onChange }: {
  siteId: string; line: RequestDocument['lines'][number]; onChange: (line: RequestDocument['lines'][number]) => void;
}) {
  const { t, message, formatNumber } = useProcurementI18n()
  const [taxes, setTaxes] = useState<{ id: string; name: string; rate: number }[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    if (isDemoSiteId(siteId) || isDemoModeActive()) return
    const controller = new AbortController()
    fetch(`/api/procurement/requests/taxes?site_id=${siteId}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); return body })
      .then(body => { if (!controller.signal.aborted) setTaxes(body.taxes) })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message || 'Unable to load taxes') })
    return () => controller.abort()
  }, [siteId])
  return <div className="space-y-2">
    <label className="block">{t('procurement.workflow.service.estimate')}<Input type="number" min={0} step={1} max={Number.MAX_SAFE_INTEGER} value={line.unit_estimate_minor ?? ''}
      onChange={event => onChange({ ...line, unit_estimate_minor: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
    <p className="text-xs text-muted-foreground">{t('procurement.workflow.service.description')}</p>
    {error && <p role="alert" className="text-destructive">{message(error)}</p>}
    <fieldset className="space-y-1"><legend>{t('procurement.workflow.service.taxSelection')}</legend>
      {taxes.map(tax => <label className="flex items-center gap-2" key={tax.id}><input type="checkbox" checked={line.tax_ids?.includes(tax.id) ?? false}
        onChange={event => onChange({ ...line, tax_ids: event.target.checked ? [...(line.tax_ids ?? []), tax.id] : line.tax_ids?.filter(id => id !== tax.id) })} />{tax.name} ({formatNumber(tax.rate)}%)</label>)}
      <label className="flex items-center gap-2"><input type="checkbox" checked={line.tax_ids?.length === 0}
        onChange={event => onChange({ ...line, tax_ids: event.target.checked ? [] : undefined })} />{t('procurement.workflow.service.noTaxes')}</label>
    </fieldset>
  </div>
}
