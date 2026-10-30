'use client'

import { Label } from '@/app/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { checkoutInput, checkoutLabel } from './checkout-styles'
import type { Opportunity } from './types'

export const applicantKey = (row: Opportunity) => row.acting_site_id ? `business:${row.acting_site_id}` : row.acting_as_self || !row.supplier_id ? 'personal' : `supplier:${row.supplier_id}`

export function ApplicantPicker({ choices, value, onChange, disabled }: {
  choices: Opportunity[]; value: Opportunity; onChange: (row: Opportunity) => void; disabled?: boolean
}) {
  const { t } = useProcurementI18n()
  return <div className="space-y-2">
    <Label className={checkoutLabel} htmlFor="proposal-applicant">{t('procurement.portal.checkout.applicant')}</Label>
    <Select value={applicantKey(value)} disabled={disabled} onValueChange={key => {
      const row = choices.find(item => applicantKey(item) === key)
      if (row) onChange(row)
    }}>
      <SelectTrigger id="proposal-applicant" className={checkoutInput}><SelectValue /></SelectTrigger>
      <SelectContent>{choices.map(row => <SelectItem key={applicantKey(row)} value={applicantKey(row)}>
        {applicantKey(row) === 'personal' ? t('procurement.portal.checkout.personalAccount') : row.supplier_name}
      </SelectItem>)}</SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground">{t('procurement.portal.checkout.applicantHint')}</p>
  </div>
}