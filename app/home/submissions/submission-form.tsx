'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { SubmissionShell } from './submission-shell'
import { DialogForm, DialogFooter } from '@/app/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/app/components/ui/select'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import { Label } from '@/app/components/ui/label'
import type { Credential } from '@/app/purchases/procurement/evidence/schema'
import { type Opportunity, readPortalJson } from './types'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { CredentialForm } from '@/app/home/profile/credential-form'
import { ProposalUpload } from './proposal-upload'
import { User, Building, Loader2 } from '@/app/components/ui/icons'
import { checkoutCard, checkoutHeading, checkoutInput, checkoutLabel } from './checkout-styles'
import { ApplicantPicker } from './applicant-picker'
import { useSubmissionDraft } from './use-submission-draft'
import { toast } from 'sonner'
import { usePortalDemo } from '../demo-context'
import { DemoSubmissionPreview } from './demo-submission-preview'
import { supplierSubmissionSchema } from '@/app/purchases/procurement/commerce/contracts'

// Registration supplies the only field that is not available at preflight.
const submissionPreflightSchema = supplierSubmissionSchema.omit({ supplier_id: true })

type SubmissionFormProps = { opportunity: Opportunity; onSubmitted: () => void; onSaved?: () => void; onCancel: () => void; onChangeApplicant?: (row: Opportunity) => void; applicantChoices?: Opportunity[]; open?: boolean; demo?: boolean }
export function SubmissionForm(props: SubmissionFormProps) {
  const demo = usePortalDemo()
  return demo || props.demo ? <DemoSubmissionPreview {...props} /> : <LiveSubmissionForm {...props} />
}

function LiveSubmissionForm({ opportunity, onSubmitted, onSaved, onCancel, onChangeApplicant, applicantChoices = [], open = true }: SubmissionFormProps) {
  const { t, message, formatDate, formatNumber, formatMoney } = useProcurementI18n()
  const { user } = useAuthContext()
  const draft = useSubmissionDraft(user?.id, opportunity)
  const { reference, setReference, prices, setPrices, evidence, setEvidence, key, attempted,
    registeredSupplier, setRegisteredSupplier, proposalRevision, setProposalRevision, holderName, setHolderName } = draft
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [proposalPending, setProposalPending] = useState(false)
  const [credentialFor, setCredentialFor] = useState<string | null>(null)
  const scrollTop = useRef(0)
  const actingAsSelf = !opportunity.acting_site_id && (opportunity.acting_as_self || !opportunity.supplier_id)
  const { data, error: credentialError, mutate } = useSWR(user ? ['submission-credentials', user.id] : null,
    () => readPortalJson('/api/procurement/credentials') as Promise<{ credentials: Credential[] }>)
  const revisions = data?.credentials.filter(credential => !credential.archived_at).flatMap(credential => credential.revisions.filter(revision => revision.state === 'ready' && revision.metadata.type !== 'tender_proposal')) ?? []
  async function saveDraft() {
    if (await draft.save()) { toast.success(t('procurement.portal.draft.saved')); if (onSaved) onSaved(); else onCancel() }
    else toast.error(t('procurement.portal.draft.saveFailed'))
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy || draft.saving || uploading || proposalPending || !draft.ready) return
    if (opportunity.requirements.some(line => !/^\d+$/.test(prices[line.id] ?? '') || !Number.isSafeInteger(Number(prices[line.id])) || Number(prices[line.id]) > 1000000000)) { setError('Enter a whole non-negative unit price for every requirement.'); return }
    setBusy(true); setError('')
    try {
      const preflight = submissionPreflightSchema.safeParse({
        tender_id: opportunity.tender_id, publication_id: opportunity.publication_id,
        reference, idempotency_key: key,
        ...(proposalRevision ? { proposal_revision_id: proposalRevision } : {}),
        lines: opportunity.requirements.map(line => ({ requirement_id: line.id, unit_net_minor: Number(prices[line.id]) })),
        evidence: Object.entries(evidence).filter(([, revision]) => revision).map(([requirement_id, revision_id]) => ({ requirement_id, revision_id })),
      })
      if (!preflight.success) throw new Error(preflight.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '))
      let supplierId = registeredSupplier ?? opportunity.supplier_id
      if (supplierId !== null) supplierSubmissionSchema.parse({ ...preflight.data, supplier_id: supplierId })
      if ((actingAsSelf || opportunity.acting_site_id) && !registeredSupplier) {
        const registration = await fetch('/api/procurement/credentials/participation/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publication_id: opportunity.publication_id, ...(opportunity.acting_site_id ? { acting_site_id: opportunity.acting_site_id } : {}) }),
        })
        const body = await registration.json()
        if (!registration.ok) throw new Error(body.error || 'Open tender registration is temporarily unavailable')
        supplierId = body.supplier_id
      }
      const payload = supplierSubmissionSchema.parse({ ...preflight.data, supplier_id: supplierId })
      setRegisteredSupplier(payload.supplier_id)
      try { await draft.recordAttempt(supplierId) } catch { throw new Error(t('procurement.portal.draft.saveFailed')) }
      const response = await fetch(`/api/procurement/commerce/submissions?site_id=${opportunity.site_id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Submission failed')
      if (!body.data?.quotation_id) throw new Error('Submission failed')
      toast.success(t('procurement.portal.activity.submittedNotice'))
      // Draft cleanup must not delay feedback for an already confirmed submission.
      void draft.clear().catch(() => { /* Retain the immutable retry key if cleanup fails. */ })
      onSubmitted()
    } catch (reason) {
      const failure = reason instanceof Error ? reason.message : 'Submission failed'
      setError(failure); toast.error(message(failure))
    }
    finally { setBusy(false) }
  }
  return <>{credentialFor !== null && <CredentialForm key={credentialFor} open={open} onCancel={() => setCredentialFor(null)} onSaved={result => {
    if (credentialFor) setEvidence(current => ({ ...current, [credentialFor]: result.revision_id }))
    setCredentialFor(null); void mutate()
  }} />}
  <SubmissionShell open={open && credentialFor === null} onClose={onCancel} busy={busy || uploading || draft.saving} title={t('procurement.portal.public.submit')} description={actingAsSelf ? t('procurement.portal.activity.self') : opportunity.supplier_name}>
    <DialogForm onSubmit={submit} onInvalid={event => toast.error((event.target as HTMLInputElement).validationMessage)} aria-busy={busy || draft.saving} className="min-h-0 flex-1"><div ref={node => { if (node) node.scrollTop = scrollTop.current }} onScroll={event => { scrollTop.current = event.currentTarget.scrollTop }} data-slot="dialog-body" className="min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto overscroll-contain bg-gray-50/30 p-6 dark:bg-gray-950 [overflow-wrap:anywhere] [&_fieldset]:min-w-0">
    <section className={checkoutCard}>
      <h2 className={checkoutHeading}>{t('procurement.portal.checkout.applicant')}</h2>
      <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-800">{actingAsSelf ? <User className="h-5 w-5" /> : <Building className="h-5 w-5" />}</span>
        <div className="min-w-0 flex-1"><p className="text-sm font-medium">{actingAsSelf ? t('procurement.portal.activity.self') : opportunity.supplier_name}</p><p className="text-xs text-muted-foreground">{user?.email}</p></div>
      </div>
      {onChangeApplicant && applicantChoices.length > 1 && <ApplicantPicker choices={applicantChoices} value={opportunity} onChange={onChangeApplicant} disabled={busy || draft.saving || !draft.ready || uploading || attempted || proposalPending} />}
    </section>
    <section className={checkoutCard}>
      <h2 className={checkoutHeading}>{opportunity.title}</h2>
      {opportunity.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{opportunity.description}</p>}
      <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border px-3 py-1">{t('procurement.portal.public.publishedVersion', { version: formatNumber(opportunity.version) })}</span><span className="rounded-full border px-3 py-1">{opportunity.currency}</span></div>
      <p className="text-sm">{t('procurement.portal.checkout.deadline', { date: formatDate(opportunity.participation_deadline) })}</p>
    </section>
    <fieldset disabled={busy || draft.saving || attempted || !draft.ready} className="space-y-6">
    <section className={checkoutCard}><h2 className={checkoutHeading}>{t('procurement.portal.checkout.offer')}</h2>
    <div><Label className={checkoutLabel} htmlFor="submission-reference">{t('procurement.portal.submission.reference')}</Label><Input className={checkoutInput} id="submission-reference" maxLength={120} required value={reference} onChange={event => setReference(event.target.value)} /></div>
    {proposalRevision ? <section className="space-y-2"><h3 className="text-sm font-semibold">{t('procurement.portal.submission.proposal')}</h3>
      <Button variant="link" asChild><a href={`/api/procurement/credentials/revisions/${proposalRevision}/file`}>{t('procurement.portal.submission.viewProposal')}</a></Button>
    </section> : <ProposalUpload disabled={busy || attempted || !draft.ready} holderName={holderName} onHolderName={setHolderName} onUploaded={setProposalRevision} onBusy={setUploading} onPending={setProposalPending} />}
    </section>
    <section className={checkoutCard}><h2 className={checkoutHeading}>{t('procurement.portal.checkout.requirements')}</h2>
    {opportunity.requirements.map(line => <div className="space-y-4 border-b border-gray-100 pb-5 last:border-0 last:pb-0 dark:border-gray-800" key={line.id}>
      <p className="font-semibold">{line.description}</p><p className="text-sm text-muted-foreground">{formatNumber(line.quantity)} {line.unit}</p>
      <div><Label className={checkoutLabel} htmlFor={`price-${line.id}`}>{t('procurement.portal.submission.price', { currency: opportunity.currency })}</Label>
      <Input className={checkoutInput} id={`price-${line.id}`} type="number" required min={0} max={1000000000} step={1} value={prices[line.id] ?? ''} onChange={event => setPrices({ ...prices, [line.id]: event.target.value })} /></div>
      <Label className={checkoutLabel} htmlFor={`evidence-${line.id}`}>{t('procurement.portal.submission.share')}</Label>
      <Select value={evidence[line.id] || 'none'} disabled={busy || attempted || !!credentialError} onValueChange={value => setEvidence({ ...evidence, [line.id]: value === 'none' ? '' : value })}>
        <SelectTrigger className={checkoutInput} id={`evidence-${line.id}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">{t('procurement.portal.submission.noShare')}</SelectItem>
          {revisions.map(revision => <SelectItem key={revision.id} value={revision.id}>{t('procurement.portal.submission.revision', { title: revision.metadata.title, revision: formatNumber(revision.revision), holder: revision.metadata.holder_name })}</SelectItem>)}
        </SelectContent></Select>
      <Button type="button" variant="outline" disabled={busy || attempted || uploading || proposalPending} onClick={() => setCredentialFor(line.id)}>{t('procurement.portal.submission.uploadCertification')}</Button>
    </div>)}</section>
    </fieldset>
    <details className="rounded-xl border p-4 text-sm"><summary className="cursor-pointer font-medium">{t('procurement.portal.checkout.disclosure')}</summary><p className="mt-3 text-muted-foreground">{t('procurement.portal.submission.disclosure', { when: opportunity.opening_policy === 'on_receipt' ? t('procurement.portal.submission.onReceipt') : t('procurement.portal.submission.afterOpening', { date: formatDate(opportunity.opening_at) }) })}</p></details>
    {attempted && <p className="text-sm">{t('procurement.portal.submission.locked')}</p>}
    {credentialError && <p role="alert">{t('procurement.portal.submission.credentialError', { error: message(credentialError.message) })}</p>}
    {error && <p role="alert" className="text-destructive">{message(error)}</p>}
    </div><DialogFooter className="flex-col gap-3 px-5 sm:flex-col sm:px-8">
      <p className="w-full text-xs text-muted-foreground" role="status">{t(draft.notice || 'procurement.portal.draft.databaseHint')}</p>
      {!draft.ready && draft.notice && <Button type="button" variant="outline" onClick={draft.reload}>{t('procurement.portal.activity.refresh')}</Button>}
      <div className="flex w-full items-center justify-between gap-4 text-sm"><span>{t('procurement.portal.checkout.netTotal')}</span><strong className="text-lg">{opportunity.requirements.every(line => /^\d+$/.test(prices[line.id] ?? '')) ? formatMoney(opportunity.requirements.reduce((total, line) => total + Number(prices[line.id]) * line.quantity, 0), opportunity.currency) : '—'}</strong></div>
      <p className="w-full text-xs text-muted-foreground">{t('procurement.portal.submission.taxHint')}</p>
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Button type="button" variant="outline" className="!h-12 min-h-12 shrink-0 rounded-xl !py-0" disabled={busy || draft.saving || uploading || proposalPending || !draft.ready} onClick={saveDraft}>{draft.saving && <Loader2 aria-hidden={true} className="mr-2 h-4 w-4 animate-spin" />}{t('procurement.portal.draft.save')}</Button>
        <Button type="submit" className="!h-12 min-h-12 w-full shrink-0 rounded-xl !py-0 font-bold sm:flex-1 sm:w-auto" disabled={busy || draft.saving || uploading || proposalPending || !draft.ready}>{busy && <Loader2 aria-hidden={true} className="mr-2 h-4 w-4 animate-spin" />}{t(busy ? 'procurement.portal.submission.submitting' : 'procurement.portal.submission.submit')}</Button>
      </div>
    </DialogFooter></DialogForm>
  </SubmissionShell></>
}