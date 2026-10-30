'use client'

import { Button } from '@/app/components/ui/button'
import { DocumentTable } from '@/app/purchases/procurement/commerce/document-ui'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import type { Opportunity, SavedDraft } from './types'

export function DraftTable({ rows, loading, search, onResume }: {
  rows: SavedDraft[]; loading?: boolean; search: string; onResume: (row: Opportunity) => void
}) {
  const { t, formatDate } = useProcurementI18n()
  return <DocumentTable loading={loading} empty={t('procurement.portal.draft.empty')}
    rows={rows.filter(row => `${row.reference} ${row.opportunity?.title ?? ''}`.toLowerCase().includes(search.toLowerCase()))
      .map(row => ({ ...row, id: `${row.publication_id}:${row.publication_version}:${row.applicant_key}` }))}
    columns={[
      { label: t('procurement.portal.activity.tender'), render: row => row.opportunity?.title ?? '—' },
      { label: t('procurement.portal.draft.reference'), render: row => row.reference || '—' },
      { label: t('procurement.portal.draft.updated'), render: row => formatDate(row.updated_at) },
      { label: t('procurement.portal.draft.status'), render: row => t(row.attempted ? 'procurement.portal.draft.attempted' : 'procurement.portal.draft.editable') },
      { label: t('procurement.portal.activity.action'), render: row => row.can_resume && row.opportunity
        ? <Button variant="ghost" size="sm" onClick={() => { if (row.opportunity) onResume(row.opportunity) }}>{t('procurement.portal.draft.resume')}</Button>
        : <span className="text-sm text-muted-foreground">{t('procurement.portal.draft.unavailable')}</span> },
    ]} />
}