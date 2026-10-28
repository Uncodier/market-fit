"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { TopBarPrimaryActions } from "@/app/components/navigation/topbar-primary-actions"
import { Dialog, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/app/components/ui/dialog"
import { Tabs, TabsContent } from "@/app/components/ui/tabs"
import { ResponsiveTabsList } from "@/app/components/ui/responsive-tabs-list"
import { EntityAvatar, StatusDot } from "@/app/components/documents/document-list"
import { ProcurementWorkspace, ProcurementState } from "@/app/purchases/procurement/ui/workspace"
import { humanize } from "@/app/purchases/procurement/components/form-fields"
import { ArrowLeft } from "@/app/components/ui/icons"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { emptySupplier, supplierInputSchema, type Supplier, type SupplierInput } from "../schema"
import { SupplierForm } from "./supplier-form"
import { RepresentativeManager } from "@/app/purchases/procurement/evidence/representative-manager"
import { SupplierActivity } from "./supplier-activity"
import { supplierDraft, supplierResponse } from "./client"

export function SupplierDetail({ siteId, id, onCancel }: { siteId: string; id: string; onCancel?: () => void }) {
  const router = useRouter()
  const creating = id === "new"
  const [draft, setDraft] = useState<SupplierInput | null>(creating ? emptySupplier : null)
  const [snapshot, setSnapshot] = useState<SupplierInput | null>(creating ? emptySupplier : null)
  const [canEdit, setCanEdit] = useState(creating)
  const [loading, setLoading] = useState(!creating)
  const [saving, setSaving] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [reload, setReload] = useState(0)
  const [confirmation, setConfirmation] = useState<"archive" | "reload" | "cancel" | null>(null)
  const [tab, setTab] = useState("about")
  const inFlight = useRef(false)
  const alive = useRef(true)
  const dirty = JSON.stringify(draft) !== JSON.stringify(snapshot)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (creating) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true); setError(""); setDraft(null); setCanEdit(false)
      try {
        const response = await fetch(`/api/procurement/suppliers/${id}?site_id=${siteId}`, { signal: controller.signal, cache: "no-store" })
        const data = await supplierResponse<{ supplier: Supplier; can_edit: boolean }>(response)
        if (controller.signal.aborted) return
        const next = supplierDraft(data.supplier)
        setDraft(next); setSnapshot(next); setCanEdit(data.can_edit); setBlocked(false)
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Unable to load supplier")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [siteId, id, creating, reload])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])
  const save = async (value = draft) => {
    if (!value || !canEdit || inFlight.current || blocked) return
    const parsed = supplierInputSchema.safeParse(value)
    if (!parsed.success) { setError(parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; ")); return }
    inFlight.current = true; setSaving(true); setError(""); setNotice("")
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
      setDraft(next); setSnapshot(next); setBlocked(false); setNotice("Supplier saved.")
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
  const saveButton = canEdit && <Button size="sm" form={creating ? undefined : "supplier-edit-form"} type="submit" disabled={saving || blocked || (!creating && !dirty)}>{saving ? "Saving…" : creating ? "Create supplier" : "Save changes"}</Button>
  const feedback = <>{error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="rounded-lg border p-3 text-sm">{notice}</p>}</>
  return <>
    {creating ? <Dialog open onOpenChange={open => { if (!open) cancel() }}>
      <DialogContent size="lg" busy={saving}>
        <DialogForm onSubmit={event => { event.preventDefault(); void save() }}>
          <DialogHeader><DialogTitle>Create supplier</DialogTitle><DialogDescription>Add a private supplier relationship. New suppliers start as prospects.</DialogDescription></DialogHeader>
          <DialogBody className="space-y-4">{feedback}{draft && <SupplierForm siteId={siteId} value={draft} onChange={updateDraft} disabled={!canEdit || saving || blocked} />}</DialogBody>
          <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={cancel}>Cancel</Button>{saveButton}</DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog> : <ProcurementWorkspace title={snapshot?.name ?? "Supplier details"} toolbar={<div className="flex w-full items-center justify-between gap-3 py-3">
      <Button variant="ghost" size="sm" onClick={cancel}><ArrowLeft className="mr-2 h-4 w-4" />Back to suppliers</Button>
      <div className="flex items-center gap-2">
        {draft && canEdit && <Button type="button" variant="ghost" size="sm" disabled={saving || blocked} onClick={() => setConfirmation("archive")}>{draft.status === "archived" ? "Restore supplier" : "Archive supplier"}</Button>}
        <Button variant="ghost" size="sm" disabled={saving || loading} onClick={() => dirty ? setConfirmation("reload") : setReload(value => value + 1)}>Reload latest version</Button>
      </div>
    </div>}>
      <TopBarPrimaryActions>{draft && saveButton}</TopBarPrimaryActions>
      <ProcurementState loading={loading} error={!draft ? error : undefined} onRetry={() => setReload(value => value + 1)} />
      {draft && <div className="space-y-6">
        <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="flex min-w-0 items-start gap-3"><EntityAvatar name={snapshot?.name} className="h-11 w-11 text-sm" /><div className="min-w-0">
            <h2 className="truncate text-xl font-semibold leading-tight">{snapshot?.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{draft.company_id ? "Company relationship" : "Independent supplier"} · Workspace private</p>
            <p className="mt-1 text-xs text-muted-foreground">Version {snapshot?.expected_version} · {draft.contacts.length} contacts</p>
          </div></div>
        </header>
        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-card px-5 py-3">
          <StatusDot status={draft.status === "approved" ? "active" : draft.status === "under_review" ? "review" : draft.status === "prospect" ? "new" : draft.status} label={humanize(draft.status)} />
          <span className="text-xs text-muted-foreground">Approval is specific to this workspace; it does not grant portal access.</span>
        </div>
        {feedback}
        {!canEdit && <p className="text-sm text-muted-foreground">Read-only access. Workspace editors can manage this supplier.</p>}
        {dirty && <p className="text-sm text-muted-foreground">Unsaved changes</p>}
        <Tabs value={tab} onValueChange={setTab}>
          <ResponsiveTabsList tabs={[{ value: "about", label: "About" }, { value: "contacts", label: "Contacts" }, { value: "representatives", label: "Representatives" }, { value: "activity", label: "Activity" }]} activeTab={tab} onTabChange={setTab} />
          <form id="supplier-edit-form" onSubmit={event => { event.preventDefault(); void save() }}>
          <TabsContent value="about" className="mt-6"><SupplierForm section="about" siteId={siteId} value={draft} onChange={updateDraft} disabled={!canEdit || saving || blocked} /></TabsContent>
          </form>
          <TabsContent value="contacts" className="mt-6"><SupplierForm section="contacts" siteId={siteId} value={draft} onChange={updateDraft} disabled={!canEdit || saving || blocked} /></TabsContent>
          <TabsContent value="representatives" className="mt-6"><RepresentativeManager key={`${siteId}:${id}`} siteId={siteId} supplierId={id} /></TabsContent>
          <TabsContent value="activity" className="mt-6">{snapshot && <SupplierActivity siteId={siteId} id={id} version={snapshot.expected_version} />}</TabsContent>
        </Tabs>
      </div>}
    </ProcurementWorkspace>}
    <ConfirmDialog open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null) }} loading={saving}
      title={confirmation === "archive" ? draft?.status === "archived" ? "Restore this supplier?" : "Archive this supplier?" : "Discard unsaved changes?"}
      description={confirmation === "archive" ? "This saves the current form and changes supplier availability. The relationship and its private details remain stored. Restoring returns the supplier to Prospect for a new review." : "Your unsaved edits will be discarded."}
      confirmLabel={confirmation === "archive" ? "Save status change" : "Discard changes"}
      onConfirm={async () => {
        if (confirmation === "archive" && draft) await save({ ...draft, status: draft.status === "archived" ? "prospect" : "archived" })
        else if (confirmation === "reload") setReload(value => value + 1)
        else leave()
      }} />
  </>
}