'use client'

import { SubmissionsSkeleton } from '../portal-skeletons'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import Link from 'next/link'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { Button } from '@/app/components/ui/button'
import { DocumentToolbar, DocumentTable } from '@/app/purchases/procurement/commerce/document-ui'
import { SubmissionForm } from './submission-form'
import { applicantKey } from './applicant-picker'
import { groupOpportunities } from './opportunity-groups'
import { OpportunityTable } from './opportunity-table'
import { DraftTable } from './draft-table'
import { type Opportunity, type SavedDraft, type Submission, readPortalJson } from './types'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { usePortalDemo } from '../demo-context'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { demoPortalOpportunities, demoPortalDrafts, demoPortalSubmissions } from '@/lib/demo-data/procurement-portal'

export default function SubmissionsPage() {
  const { user } = useAuthContext()
  const demo = usePortalDemo()
  return user || demo ? <Suspense fallback={<SubmissionsSkeleton />}><AccountSubmissions key={demo ? 'demo' : user?.id} demo={demo} /></Suspense> : <SubmissionsSkeleton />
}

function AccountSubmissions({ demo }: { demo: boolean }) {
  const { t, message, formatDate, formatMoney } = useProcurementI18n()
  const { user } = useAuthContext()
  const requestedPublication = useSearchParams().get('publication')
  const [drafts, setDrafts] = useState<Opportunity[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const draftId = (row: Opportunity) => `${row.publication_id}:${row.version}:${applicantKey(row)}`
  function prepare(row: Opportunity) {
    setDrafts(current => current.some(item => draftId(item) === draftId(row)) ? current : [...current, row])
    setSelected(draftId(row)); setNotice('')
  }
  const [tab, setTab] = useState('opportunities')
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const opportunities = useSWR(!demo && user ? ['supplier-opportunities', user.id] : null,
    () => readPortalJson('/api/procurement/credentials/participation') as Promise<{ opportunities: Opportunity[] }>)
  const submissions = useSWR(!demo && user ? ['supplier-submissions', user.id] : null,
    async () => {
      const result = await readPortalJson('/api/procurement/commerce/submissions') as { data: Submission[] }
      return { submissions: result.data }
    })
  const savedDrafts = useSWR(!demo && user ? ['supplier-drafts', user.id] : null,
    () => readPortalJson('/api/procurement/credentials/drafts/list') as Promise<{ drafts: SavedDraft[] }>)
  const available = (demo ? demoPortalOpportunities : opportunities.data?.opportunities)?.filter(opportunity => !requestedPublication || opportunity.publication_id === requestedPublication)
  const grouped = groupOpportunities(available ?? [])
  const openedPublication = useRef<string | null>(null)
  useEffect(() => {
    if (!requestedPublication || openedPublication.current === requestedPublication || !available?.length) return
    const row = available.find(item => applicantKey(item) === 'personal') ?? available[0]
    const timer = setTimeout(() => {
      openedPublication.current = requestedPublication
      setDrafts(current => current.some(item => draftId(item) === draftId(row)) ? current : [...current, row])
      setSelected(draftId(row))
    }, 0)
    return () => clearTimeout(timer)
  }, [requestedPublication, available])
  return <section className="space-y-6">
    {demo && <ProcurementDemoNotice />}
    <header><h1 className="text-3xl font-semibold">{t('procurement.portal.activity.title')}</h1><p className="text-muted-foreground">{t('procurement.portal.activity.description')}</p></header>
    {tab === 'opportunities' && opportunities.error && <div role="alert" className="space-y-2 text-destructive">
      <p>{message(opportunities.error.message)}</p>
      <Button variant="outline" onClick={() => void opportunities.mutate()}>{t('procurement.portal.activity.refresh')}</Button>
    </div>}
    {tab === 'drafts' && savedDrafts.error && <div role="alert" className="space-y-2 text-destructive">
      <p>{t('procurement.portal.draft.loadFailed')}</p>
      <Button variant="outline" onClick={() => void savedDrafts.mutate()}>{t('procurement.portal.activity.refresh')}</Button>
    </div>}
    {tab === 'submissions' && submissions.error && <div role="alert" className="space-y-2 text-destructive">
      <p>{message(submissions.error.message)}</p>
      <Button variant="outline" onClick={() => void submissions.mutate()}>{t('procurement.portal.activity.refresh')}</Button>
    </div>}
    {notice && <p role="status">{t(notice)}</p>}
    {drafts.map(draft => <SubmissionForm key={draftId(draft)} demo={demo} open={selected === draftId(draft)} opportunity={draft}
      applicantChoices={grouped.choices.get(draft.publication_id) ?? []} onChangeApplicant={prepare}
      onSaved={() => { setSelected(null); setTab('drafts'); setNotice('procurement.portal.draft.saved'); void savedDrafts.mutate() }}
      onCancel={() => setSelected(null)} onSubmitted={() => {
      setSelected(null); setTab('submissions'); setDrafts(current => current.filter(row => draftId(row) !== draftId(draft))); setNotice('procurement.portal.activity.submittedNotice'); void submissions.mutate(); void savedDrafts.mutate()
    }} />)}
    <DocumentToolbar transparent tabs={[{ value: 'opportunities', label: t('procurement.portal.activity.opportunities') }, { value: 'drafts', label: t('procurement.portal.draft.list') }, { value: 'submissions', label: t('procurement.portal.activity.quotations') }]} value={tab} onChange={setTab} search={search} onSearch={setSearch}
      actions={<Button variant="ghost" size="sm" asChild><Link href="/home/profile">{t('procurement.portal.activity.manageCredentials')}</Link></Button>} />
    {requestedPublication && <p>{t('procurement.portal.activity.requestedOnly')} <Button variant="link" asChild><Link href="/home/submissions">{t('procurement.portal.activity.viewAll')}</Link></Button></p>}
    {requestedPublication && !opportunities.isLoading && !opportunities.error && !available?.length && <p role="alert">{t('procurement.portal.activity.unavailable')} <Button variant="outline" onClick={() => void opportunities.mutate()}>{t('procurement.portal.activity.refresh')}</Button></p>}
    {tab === 'opportunities' ? !opportunities.error && <div className="space-y-8">
      <section className="space-y-3"><h2 className="text-xl font-semibold">{t('procurement.portal.activity.invitations')}</h2>
        <p className="text-sm text-muted-foreground">{t('procurement.portal.activity.invitationsHint')}</p>
        <OpportunityTable rows={(available ?? []).filter(row => row.directly_invited === true)} loading={opportunities.isLoading} search={search} onPrepare={prepare} />
      </section>
    </div> : tab === 'drafts' ? !savedDrafts.error && <DraftTable rows={demo ? demoPortalDrafts : savedDrafts.data?.drafts ?? []} loading={savedDrafts.isLoading} search={search} onResume={prepare} />
      : !submissions.error && <DocumentTable loading={submissions.isLoading} empty={t('procurement.portal.activity.emptyQuotations')} rows={(demo ? demoPortalSubmissions : submissions.data?.submissions ?? []).filter(row => `${row.tender_title} ${row.reference}`.toLowerCase().includes(search.toLowerCase()))} columns={[
        { label: t('procurement.portal.activity.tenderReference'), render: row => <>{row.tender_title}<p>{row.reference}</p></> },
        { label: t('procurement.portal.activity.netTax'), render: row => t('procurement.portal.activity.amounts', { currency: row.currency, net: formatMoney(row.net_amount_minor, row.currency), tax: row.tax_amount_minor == null ? t('procurement.common.taxesPending') : formatMoney(row.tax_amount_minor, row.currency) }) },
        { label: t('procurement.portal.activity.submitted'), render: row => formatDate(row.submitted_at) },
        { label: t('procurement.portal.activity.receipt'), render: row => row.id },
      ]} />}

  </section>
}