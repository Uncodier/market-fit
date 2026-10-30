'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { SubmissionShell } from '@/app/home/submissions/submission-shell'
import { SubmissionForm } from '@/app/home/submissions/submission-form'
import { readPortalJson, type Opportunity } from '@/app/home/submissions/types'
import { Button } from '@/app/components/ui/button'
import { ProcurementLoading } from '@/app/purchases/procurement/ui/loading'
import { applicantKey } from '@/app/home/submissions/applicant-picker'
import { usePortalDemo } from '@/app/home/demo-context'
import { DemoSubmissionPreview } from '@/app/home/submissions/demo-submission-preview'
import { demoPortalOpportunities } from '@/lib/demo-data/procurement-portal'

export function TenderSubmissionEntry({ publicationId, open, onClose, returnTo, onSubmitted }: {
  publicationId: string; open: boolean; onClose: () => void; returnTo: string; onSubmitted?: () => void
}) {
  const { user } = useAuthContext()
  const demo = usePortalDemo()
  if (demo) {
    const opportunity = demoPortalOpportunities.find(row => row.publication_id === publicationId)
    return opportunity ? <DemoSubmissionPreview opportunity={opportunity} open={open} onCancel={onClose} />
      : <SubmissionShell open={open} onClose={onClose} title="Demo preview" description="Real tender participation is disabled in demo mode.">
        <div className="p-6"><Button asChild><Link href="/tenders">Browse demo tenders</Link></Button></div>
      </SubmissionShell>
  }
  return <AccountEntry key={`${user?.id ?? 'guest'}:${publicationId}`} userId={user?.id} publicationId={publicationId} open={open} onClose={onClose} returnTo={returnTo} onSubmitted={onSubmitted} />
}

function AccountEntry({ userId, publicationId, open, onClose, returnTo, onSubmitted }: {
  userId?: string; publicationId: string; open: boolean; onClose: () => void; returnTo: string; onSubmitted?: () => void
}) {
  const { t, message } = useProcurementI18n()
  const [choice, setChoice] = useState<Opportunity | null>(null)
  const [drafts, setDrafts] = useState<Opportunity[]>([])
  const [submitted, setSubmitted] = useState(false)
  const { data, error, isLoading, mutate } = useSWR(userId && open ? ['supplier-opportunities', userId] : null,
    () => readPortalJson('/api/procurement/credentials/participation') as Promise<{ opportunities: Opportunity[] }>)
  const choices = data?.opportunities.filter(row => row.publication_id === publicationId) ?? []
  const selected = userId ? choice ?? choices.find(row => applicantKey(row) === 'personal') ?? choices[0] ?? null : null
  function changeApplicant(next: Opportunity) {
    setDrafts(current => {
      const retained = [...current]
      for (const row of [selected, next]) {
        if (row && !retained.some(item => applicantKey(item) === applicantKey(row))) retained.push(row)
      }
      return retained
    })
    setChoice(next)
  }
  // Keep the draft component mounted while the sheet closes or revalidates.
  const forms = [...drafts]
  if (selected && !forms.some(row => applicantKey(row) === applicantKey(selected))) forms.push(selected)
  return <>{userId && forms.map(row => <SubmissionForm key={applicantKey(row)} opportunity={row}
    open={open && !submitted && Boolean(selected && applicantKey(selected) === applicantKey(row))} onCancel={onClose}
    onSaved={onClose} onSubmitted={() => { setSubmitted(true); onSubmitted?.() }} applicantChoices={choices} onChangeApplicant={changeApplicant} />)}
  <SubmissionShell open={open && (!selected || submitted)} onClose={onClose} title={t('procurement.portal.public.submit')} description={t('procurement.portal.checkout.entryHint')}>
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-gray-50/30 p-6 dark:bg-gray-950">
      {!userId ? <Button asChild className="w-full"><Link href={`/auth?returnTo=${encodeURIComponent(returnTo)}`}>{t('procurement.portal.public.signIn')}</Link></Button>
        : submitted ? <><p role="status">{t('procurement.portal.activity.submittedNotice')}</p><Button asChild><Link href="/home/submissions">{t('procurement.portal.public.mySubmissions')}</Link></Button></>
        : isLoading ? <ProcurementLoading compact />
        : error ? <><p role="alert">{message(error.message)}</p><Button onClick={() => void mutate()}>{t('procurement.portal.activity.refresh')}</Button></>
        : !choices.length ? <><p role="alert">{t('procurement.portal.activity.unavailable')}</p><Button onClick={() => void mutate()}>{t('procurement.portal.activity.refresh')}</Button></>
        : null}
    </div>
  </SubmissionShell></>
}