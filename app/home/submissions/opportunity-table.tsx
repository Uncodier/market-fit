'use client'

import { Button } from '@/app/components/ui/button'
import { DocumentTable } from '@/app/purchases/procurement/commerce/document-ui'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { applicantKey } from './applicant-picker'
import type { Opportunity } from './types'

export function OpportunityTable({ rows, publicOpportunities, loading, search, onPrepare }: {
  rows: Opportunity[]; publicOpportunities?: boolean; loading?: boolean; search: string
  onPrepare: (row: Opportunity) => void
}) {
  const { t, formatDate, formatNumber } = useProcurementI18n()
  const filtered = rows.filter(row => `${row.title} ${row.supplier_name}`.toLowerCase().includes(search.toLowerCase()))
  return <DocumentTable loading={loading} empty={t('procurement.portal.activity.emptyOpportunities')}
    rows={filtered.map(row => ({ ...row, id: `${row.publication_id}:${applicantKey(row)}` }))} columns={[
      { label: t('procurement.portal.activity.tender'), render: row => <><p className="font-medium">{row.title}</p><p className="text-muted-foreground">{t('procurement.portal.version', { version: formatNumber(row.version) })} · {row.currency}</p></> },
      ...(publicOpportunities ? [] : [{ label: t('procurement.portal.activity.representing'), render: (row: Opportunity) => applicantKey(row) === 'personal' ? t('procurement.portal.activity.self') : row.supplier_name }]),
      { label: t('procurement.portal.activity.participation'), render: row => t(row.directly_invited ? 'procurement.portal.activity.invitationOnly' : publicOpportunities ? 'procurement.portal.activity.openParticipation' : row.participation === 'approved_suppliers' ? 'procurement.portal.activity.approvedParticipation' : 'procurement.portal.activity.invitationOnly') },
      { label: t('procurement.portal.activity.closes'), render: row => formatDate(row.participation_deadline) },
      { label: t('procurement.portal.activity.action'), render: row => <Button variant="ghost" size="sm" onClick={() => onPrepare(row)}>{t('procurement.portal.activity.prepare')}</Button> },
    ]} />
}