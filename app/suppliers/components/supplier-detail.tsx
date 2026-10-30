"use client"

import { useRouter } from "next/navigation"
import { isDemoSiteId, isDemoModeActive } from '@/lib/demo-utils'
import { demoSuppliers } from '@/lib/demo-data/procurement-suppliers'
import { ProcurementDemoNotice } from '@/app/purchases/procurement/ui/demo-notice'
import { useEffect, useRef, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { TopBarPrimaryActions } from "@/app/components/navigation/topbar-primary-actions"
import { Dialog, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/app/components/ui/dialog"
import { Tabs, TabsContent } from "@/app/components/ui/tabs"
import { ResponsiveTabsList } from "@/app/components/ui/responsive-tabs-list"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { ProcurementWorkspace, ProcurementState } from "@/app/purchases/procurement/ui/workspace"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { emptySupplier, supplierInputSchema, type Supplier, type SupplierInput } from "../schema"
import { SupplierForm } from "./supplier-form"
import { RepresentativeManager } from "@/app/purchases/procurement/evidence/representative-manager"
import { SupplierActivity } from "./supplier-activity"
import { supplierDraft, supplierResponse, supplierIssueField } from "./client"
import type { ZodIssue } from 'zod'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { useSupplierCompany } from "./use-supplier-company"
import { SupplierContactActions } from "./supplier-contact-actions"
import { preferredSupplierContact } from "./contact-links"
import { SupplierStatusWidget } from "./supplier-status-widget"
import { SupplierDetailSkeleton } from './supplier-detail-skeleton'

export function SupplierDetail({ siteId, id, onCancel }: { siteId: string; id: string; onCancel?: () => void }) {
  const { t, message, valueLabel, formatNumber } = useProcurementI18n()
  const router = useRouter()
  const creating = id === "new"
  const demo = isDemoSiteId(siteId)
  const [draft, setDraft] = useState<SupplierInput | null>(creating ? emptySupplier : null)
  const [snapshot, setSnapshot] = useState<SupplierInput | null>(creating ? emptySupplier : null)
  const [supplierRecord, setSupplierRecord] = useState<Supplier | null>(null)
  const [canEdit, setCanEdit] = useState(creating && !demo && !isDemoModeActive())
  const [loading, setLoading] = useState(!creating)
  const [saving, setSaving] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState("")
  const [issues, setIssues] = useState<ZodIssue[]>([])
  const [notice, setNotice] = useState("")
  const [reload, setReload] = useState(0)
  const [confirmation, setConfirmation] = useState<"archive" | "reload" | "cancel" | null>(null)
  const [tab, setTab] = useState("about")
  const inFlight = useRef(false)
  const alive = useRef(true)
  const dirty = JSON.stringify(draft) !== JSON.stringify(snapshot)
  const companyDetails = useSupplierCompany(siteId, id, snapshot?.company_id, snapshot?.expected_version)
  const company = companyDetails.company?.id === draft?.company_id ? companyDetails.company : null
  const contact = preferredSupplierContact(draft?.contacts || [], company)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (demo) {
      const timer = setTimeout(() => {
        const supplier = demoSuppliers(siteId).find(item => item.id === (creating ? 'demo-supplier-northstar' : id))
        const next: SupplierInput | null = supplier ? {
          expected_version: creating ? 0 : supplier.version, name: supplier.name, status: creating ? 'prospect' : supplier.status,
          company_id: supplier.company_id, category_ids: supplier.category_ids, contacts: supplier.contacts,
          commercial_terms: supplier.commercial_terms, private_notes: supplier.private_notes,
        } : null
        setDraft(next); setSnapshot(next); setSupplierRecord(supplier || null); setCanEdit(false); setLoading(false)
        setError(supplier ? '' : 'This supplier is not available in the demo.')
      }, 0)
      return () => clearTimeout(timer)
    }
    if (isDemoModeActive()) return
    if (creating) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true); setError(""); setIssues([]); setDraft(null); setSupplierRecord(null); setCanEdit(false)
      try {
        const response = await fetch(`/api/procurement/suppliers/${id}?site_id=${siteId}`, { signal: controller.signal, cache: "no-store" })
        const data = await supplierResponse<{ supplier: Supplier; can_edit: boolean }>(response)
        if (controller.signal.aborted) return
        const next = supplierDraft(data.supplier)
        setDraft(next); setSnapshot(next); setSupplierRecord(data.supplier); setCanEdit(data.can_edit); setBlocked(false)
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load supplier")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [siteId, id, creating, reload, demo])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  const save = async (value = draft) => {
    if (demo || isDemoModeActive() || !value || !canEdit || inFlight.current || blocked) return
    const parsed = supplierInputSchema.safeParse(value)
    if (!parsed.success) { setIssues(parsed.error.issues); setError(''); return }
    inFlight.current = true; setSaving(true); setError(""); setIssues([]); setNotice("")
    try {
      const response = await fetch(`/api/procurement/suppliers${creating ? "" : `/${id}`}?site_id=${siteId}`, {
        method: creating ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
      })
      if (response.ok || response.status === 409 || response.status >= 500) setBlocked(true)
      const data = await supplierResponse<{ supplier: Supplier }>(response)
      if (!alive.current) return
      const next = supplierDraft(data.supplier)
      if (data.supplier.site_id !== siteId || next.expected_version !== value.expected_version + 1) {
        throw new Error("Supplier save could not be confirmed. Reload before retrying.")
      }
      setDraft(next); setSnapshot(next); setSupplierRecord(data.supplier); setBlocked(false); setNotice("Supplier saved.")
      if (creating) router.push(`/suppliers/${data.supplier.id}`)
    } catch (failure) {
      if (alive.current) {
        // Unknown transport failures must not be automatically retried as a new create.
        if (failure instanceof TypeError) setBlocked(true)
        setError(failure instanceof Error ? failure.message : "Unable to save supplier")
      }
    } finally { inFlight.current = false; if (alive.current) setSaving(false) }
  }
  const leave = () => { if (onCancel) onCancel(); else router.push("/suppliers") }
  const cancel = () => { if (!saving) { if (dirty) setConfirmation("cancel"); else leave() } }
  const updateDraft = (value: SupplierInput) => { if (!inFlight.current && canEdit && !blocked) setDraft(value) }
  const saveButton = canEdit && <Button size="sm" form={creating ? undefined : "supplier-edit-form"} type="submit" disabled={saving || blocked || (!creating && !dirty)}>{t(saving ? 'procurement.partners.actions.saving' : creating ? 'procurement.partners.suppliers.create' : 'procurement.partners.actions.save')}</Button>
  const validation = issues.map(issue => t('procurement.partners.validation.problem', { field: supplierIssueField(issue, t, formatNumber), message: message(issue.message) })).join('; ')
  const feedback = <>{(error || validation) && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{validation || message(error)}</p>}
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{t('procurement.partners.suppliers.saved')}</p>}</>
  if (loading && !creating) return <SupplierDetailSkeleton />
  return <>
    {creating ? <Dialog open onOpenChange={open => { if (!open) cancel() }}>
      <DialogContent size="lg" busy={saving}>
        <DialogForm onSubmit={event => { event.preventDefault(); void save() }}>
          <DialogHeader><DialogTitle>{t('procurement.partners.suppliers.create')}</DialogTitle><DialogDescription>{t('procurement.partners.suppliers.createHint')}</DialogDescription></DialogHeader>
          <DialogBody className="space-y-4">{feedback}{draft && <SupplierForm siteId={siteId} value={draft} onChange={updateDraft} disabled={!canEdit || saving || blocked} />}</DialogBody>
          <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={cancel}>{t('procurement.common.cancel')}</Button>{demo ? <Button type="submit" disabled>{t('procurement.partners.suppliers.create')}</Button> : saveButton}</DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog> : <Tabs value={tab} onValueChange={setTab} className="w-full min-w-0"><ProcurementWorkspace className="bg-background !px-4 !py-5 lg:!px-8" title={snapshot?.name ?? t('procurement.partners.suppliers.details')} toolbar={<div aria-label="Supplier navigation and status" className="flex w-full min-w-0 flex-nowrap items-center justify-between gap-3">
      <ResponsiveTabsList tabs={['about', 'contacts', 'representatives', 'activity'].map(value => ({ value, label: valueLabel(value) }))} activeTab={tab} onTabChange={setTab} containerClassName="min-w-0 flex-1" className="w-full min-w-0 max-w-full" />
      {draft && <SupplierStatusWidget status={draft.status} disabled={!canEdit || saving || blocked}
        onChange={status => updateDraft({ ...draft, status })} onArchive={() => setConfirmation("archive")} />}
    </div>}>
      <TopBarPrimaryActions>{draft && saveButton}</TopBarPrimaryActions>
      {demo && <ProcurementDemoNotice />}
      <ProcurementState loading={loading} error={!draft ? error : undefined} onRetry={() => setReload(value => value + 1)} />
      {draft && <div className="space-y-4">
        <header className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div className="flex min-w-0 items-start gap-3"><EntityAvatar name={snapshot?.name} className="h-11 w-11 text-sm" /><div className="min-w-0">
            <h2 title={snapshot?.name} className="truncate text-xl font-semibold leading-tight">{snapshot?.name}</h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{t(draft.company_id ? 'procurement.partners.suppliers.company' : 'procurement.partners.suppliers.independent')} · {t('procurement.partners.suppliers.private')}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground/80">{t('procurement.partners.suppliers.versionContacts', { version: formatNumber(snapshot?.expected_version ?? 0), count: formatNumber(draft.contacts.length) })}</p>
          </div></div>
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <SupplierContactActions email={contact.email} phone={contact.phone} />
            {canEdit && <Button type="button" variant="ghost" size="sm" className="h-8" disabled={saving || blocked} onClick={() => setConfirmation("archive")}>{t(draft.status === 'archived' ? 'procurement.partners.suppliers.restore' : 'procurement.partners.suppliers.archive')}</Button>}
            {blocked && <Button variant="outline" size="sm" disabled={saving || loading} onClick={() => dirty ? setConfirmation("reload") : setReload(value => value + 1)}>{t('procurement.partners.actions.reload')}</Button>}
          </div>
        </header>
        {feedback}
        {!canEdit && <p className="text-sm text-muted-foreground">{t('procurement.partners.suppliers.readOnlyDetail')}</p>}
        {dirty && <p className="text-sm text-muted-foreground">{t('procurement.partners.actions.unsaved')}</p>}
        <div className="!mt-5 flex flex-col border-t border-border/50 lg:flex-row">
          <div className="w-full min-w-0 pt-5 lg:flex-1 lg:pr-8">
            <TabsContent value="about" className="mt-0"><form onSubmit={event => { event.preventDefault(); void save() }}><SupplierForm section="relationship" siteId={siteId} value={draft} onChange={updateDraft} disabled={!canEdit || saving || blocked} /></form></TabsContent>
            <TabsContent value="contacts" className="mt-0"><SupplierForm section="contacts" siteId={siteId} value={draft} onChange={updateDraft} disabled={!canEdit || saving || blocked} /></TabsContent>
            <TabsContent value="representatives" className="mt-0"><RepresentativeManager key={`${siteId}:${id}`} siteId={siteId} supplierId={id} /></TabsContent>
            <TabsContent value="activity" className="mt-0">{snapshot && <SupplierActivity siteId={siteId} id={id} version={snapshot.expected_version} />}</TabsContent>
          </div>
          <aside aria-label={t('procurement.partners.form.identity')} className="w-full shrink-0 pt-5 lg:w-[340px] lg:border-l lg:border-border/50 lg:pl-8 xl:w-[380px]">
            <form id="supplier-edit-form" onSubmit={event => { event.preventDefault(); void save() }} className="min-w-0 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-var(--topbar-height,64px)-96px)] lg:overflow-y-auto"><SupplierForm section="identity" siteId={siteId} value={draft} onChange={updateDraft} disabled={!canEdit || saving || blocked} supplier={supplierRecord} company={company} companyLoading={companyDetails.loading} companyError={companyDetails.error} onRetryCompany={companyDetails.retry} /></form>
          </aside>
        </div>
      </div>}
    </ProcurementWorkspace></Tabs>}
    <ConfirmDialog open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null) }} loading={saving}
      title={t(confirmation === 'archive' ? draft?.status === 'archived' ? 'procurement.partners.suppliers.restoreTitle' : 'procurement.partners.suppliers.archiveTitle' : 'procurement.partners.actions.discardTitle')}
      description={t(confirmation === 'archive' ? 'procurement.partners.suppliers.archiveHint' : 'procurement.partners.actions.discardHint')}
      confirmLabel={t(confirmation === 'archive' ? 'procurement.partners.suppliers.saveStatus' : 'procurement.partners.actions.discard')} cancelLabel={t('procurement.common.cancel')}
      onConfirm={async () => {
        if (confirmation === "archive" && draft) await save({ ...draft, status: draft.status === "archived" ? "prospect" : "archived" })
        else if (confirmation === "reload") setReload(value => value + 1)
        else leave()
      }} />
  </>
}