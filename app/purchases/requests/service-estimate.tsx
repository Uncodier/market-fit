'use client'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { Input } from '@/app/components/ui/input'
import type { RequestDocument } from './schema'
import { useProcurementOptions } from '../procurement/components/use-procurement-options'

type TaxOption = { id: string; name: string; rate: number }
async function readTaxes(url: string, signal: AbortSignal): Promise<TaxOption[]> {
  const response = await fetch(url, { signal, cache: 'no-store' })
  const body = await response.json()
  if (!response.ok || !Array.isArray(body.taxes)) throw new Error(body.error || 'Unable to load taxes')
  return body.taxes
}
export function useServiceTaxes(siteId: string | null) {
  return useProcurementOptions(siteId ? `/api/procurement/requests/taxes?site_id=${encodeURIComponent(siteId)}` : null, readTaxes)
}

export function ServiceEstimate({ taxes, line, onChange }: {
  taxes: TaxOption[]; line: RequestDocument['lines'][number]; onChange: (line: RequestDocument['lines'][number]) => void;
}) {
  const { t, formatNumber } = useProcurementI18n()
  return <div className="space-y-2">
    <label className="block">{t('procurement.workflow.service.estimate')}<Input type="number" min={0} step={1} max={Number.MAX_SAFE_INTEGER} value={line.unit_estimate_minor ?? ''}
      onChange={event => onChange({ ...line, unit_estimate_minor: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
    <p className="text-xs text-muted-foreground">{t('procurement.workflow.service.description')}</p>
    <fieldset className="space-y-1"><legend>{t('procurement.workflow.service.taxSelection')}</legend>
      {taxes.map(tax => <label className="flex items-center gap-2" key={tax.id}><input type="checkbox" checked={line.tax_ids?.includes(tax.id) ?? false}
        onChange={event => onChange({ ...line, tax_ids: event.target.checked ? [...(line.tax_ids ?? []), tax.id] : line.tax_ids?.filter(id => id !== tax.id) })} />{tax.name} ({formatNumber(tax.rate)}%)</label>)}
      <label className="flex items-center gap-2"><input type="checkbox" checked={line.tax_ids?.length === 0}
        onChange={event => onChange({ ...line, tax_ids: event.target.checked ? [] : undefined })} />{t('procurement.workflow.service.noTaxes')}</label>
    </fieldset>
  </div>
}
