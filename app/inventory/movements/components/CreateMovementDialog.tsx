"use client"

import { useRef, useState } from "react"
import useSWR from "swr"
import { Dialog, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import type { RelationSelectValue } from "@/app/components/ui/relation-select"
import { MovementCatalogSelect } from "./MovementCatalogSelect"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { createInventoryMovement } from "../actions"
import { createTransferOrder } from "../order-actions"
import { demoMembers } from "../demo-data"
import { siteMembersService } from "@/app/services/site-members-service"
import { Plus, Trash2 } from "@/app/components/ui/icons"
import { toast } from "sonner"
import { useAuthContext } from "@/app/components/auth/auth-context"
import { clearPendingMovement, movementItems, pendingMovementKey, readPendingMovement, writePendingMovement, type PendingMovement } from "../pending-movement"

type DraftRow = { key: number; item: RelationSelectValue; quantity: string }

export function CreateMovementDialog({ open, onOpenChange, siteId, demo, locations, onSuccess, locationsError }: {
  open: boolean; onOpenChange: (open: boolean) => void; siteId?: string; demo: boolean;
  locations: { id: string; name: string }[]; onSuccess: () => void; locationsError?: string
}) {
  const { user } = useAuthContext()
  const storageKey = user?.id && siteId && !demo ? pendingMovementKey(user.id, siteId) : null
  const [restored] = useState(() => {
    try { return { input: storageKey ? readPendingMovement(storageKey, siteId!) : null, error: "" } }
    catch { return { input: null, error: "Pending movement storage is unavailable or invalid. Resolve storage before creating a movement." } }
  })
  const [pending, setPending] = useState<PendingMovement | null>(restored.input)
  const [rows, setRows] = useState<DraftRow[]>(() => restored.input ? movementItems(restored.input).map((item, key) => ({ key, item: { mode: "existing", id: item.catalogItemId, label: item.catalogItemId }, quantity: String(item.quantity) })) : [{ key: 0, item: null, quantity: "1" }])
  const nextRow = useRef(rows.length)
  const [from, setFrom] = useState(restored.input?.fromLocationId || "")
  const [to, setTo] = useState(restored.input?.toLocationId || "")
  const [notes, setNotes] = useState(restored.input?.notes || "")
  const [receiver, setReceiver] = useState(restored.input?.receivingUserId || "unassigned")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const submitting = useRef(false)
  const { data: membersData, error: membersError, isLoading: membersLoading } = useSWR(open && siteId && !demo ? ["movement-assignees", siteId] : null, () => siteMembersService.getAssigneeOptions(siteId!))
  const members = demo ? demoMembers : membersData || []
  const locked = saving || !!pending || !!restored.error
  const changeDraft = (change: () => void) => { if (!locked) { setError(""); change() } }
  const save = async (status: "draft" | "requested" = "requested") => {
    if (demo || !siteId || !storageKey || restored.error || submitting.current) return
    if (!pending) {
      if (rows.length < 1 || rows.length > 100) return setError("Include between 1 and 100 product lines.")
      for (const row of rows) {
        const item = row.item
        // A selected item need not belong to the current search page. Server validation is authoritative.
        if (item?.mode !== "existing" || !item.id) return setError("Please select an existing catalog item.")
        const qty = Number(row.quantity)
        if (!Number.isFinite(qty) || qty <= 0) return setError("Quantity must be greater than zero.")
        if (qty > 1_000_000_000) return setError("Quantity cannot exceed 1,000,000,000.")
      }
      if (new Set(rows.map(row => row.item?.mode === "existing" ? row.item.id : "")).size !== rows.length) return setError("Each catalog item can appear only once. Combine quantities for duplicate products.")
      if (!from || !to || from.toLowerCase() === to.toLowerCase() || ![from, to].every(id => locations.some(location => location.id === id))) return setError("Select different source and destination locations.")
      if (notes.trim().length > 1000) return setError("Notes cannot exceed 1,000 characters.")
      if (receiver !== "unassigned" && !members.some(member => member.id === receiver)) return setError("Select an available receiving responsible person.")
    }
    submitting.current = true
    setSaving(true)
    setError("")
    try {
      const input: PendingMovement = pending || { workflow: "transfer_order", status, siteId, requestId: crypto.randomUUID(), items: rows.map(row => ({ catalogItemId: row.item?.mode === "existing" ? row.item.id : "", quantity: Number(row.quantity) })), fromLocationId: from, toLocationId: to, ...(notes.trim() ? { notes: notes.trim() } : {}), ...(receiver !== "unassigned" ? { receivingUserId: receiver } : {}) }
      // Persist only validated input, immediately before send; never replay on mount.
      writePendingMovement(storageKey, input)
      setPending(input)
      // Legacy pending operations must replay their exact original API and payload.
      const result = input.workflow === "transfer_order" ? await createTransferOrder({ siteId: input.siteId, requestId: input.requestId, fromLocationId: input.fromLocationId, toLocationId: input.toLocationId, items: input.items, status: input.status, ...(input.notes !== undefined ? { notes: input.notes } : {}), ...(input.receivingUserId !== undefined ? { receivingUserId: input.receivingUserId } : {}) }) : await createInventoryMovement(input)
      if ("error" in result) {
        const failure = result as { error?: string; status?: number; code?: string }
        // Only the known atomic rejection is a definite 409. A request-ID
        // conflict may represent an already-applied different payload: keep it.
        const definiteConflict = failure.status === 409 && (failure.code === "operation_rejected" || failure.error === "Insufficient inventory or bill cannot be received")
        // A rejection on a retry cannot establish whether the earlier request
        // committed (access or resources may have changed in the meantime).
        if (!pending && (failure.status === 400 || failure.status === 403 || definiteConflict)) {
          clearPendingMovement(storageKey)
          setPending(null)
        }
        throw new Error(failure.error || "Unable to create movement.")
      }
      if (!result.success) throw new Error("Unable to create movement.")
      clearPendingMovement(storageKey)
      setPending(null)
      toast.success(input.workflow === "transfer_order" ? "Transfer order saved" : "Inventory movement created")
      onOpenChange(false)
      onSuccess()
      window.dispatchEvent(new CustomEvent("inventory:reload"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create movement.")
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }
  return <Dialog open={open} onOpenChange={value => { if (!submitting.current) onOpenChange(value) }}>
    <DialogContent size="md" busy={saving}>
      <DialogForm onSubmit={event => { event.preventDefault(); void save() }}>
        <DialogHeader><DialogTitle>New Transfer</DialogTitle><DialogDescription>Request a transfer between locations. Stock moves only when dispatched and received.</DialogDescription></DialogHeader>
        <DialogBody className="grid gap-4">
          {demo && <p className="text-sm text-muted-foreground">Demo preview only. Creating movements is disabled.</p>}
          {pending && <p role="status" className="text-sm text-muted-foreground">This movement is awaiting confirmation. Editing and new drafts are disabled. Retry the identical movement to confirm its result. Closing keeps it saved for this account and site in this browser tab; reopen to retry. No retry runs automatically.</p>}
          {restored.error && <p role="alert" className="text-sm text-destructive">{restored.error}</p>}
          <div className="space-y-3">
            {rows.map((row, index) => <div key={row.key} className="rounded-lg border p-3 space-y-3" role="group" aria-label={`Product line ${index + 1}`}>
              <MovementCatalogSelect key={`${user?.id}:${siteId}:${demo}`} siteId={siteId} actorId={user?.id} open={open} demo={demo} disabled={locked}
                label={rows.length === 1 ? "Catalog Item" : `Catalog Item ${index + 1}`} value={row.item}
                onValueChange={value => changeDraft(() => setRows(current => current.map(entry => entry.key === row.key ? { ...entry, item: value } : entry)))} />
              <div className="flex items-end gap-2">
                <div className="space-y-2 flex-1"><Label htmlFor={`movement-quantity-${row.key}`}>{rows.length === 1 ? "Quantity" : `Quantity ${index + 1}`}</Label><Input id={`movement-quantity-${row.key}`} type="number" min="0" max="1000000000" step="any" value={row.quantity} disabled={locked} onChange={event => changeDraft(() => setRows(current => current.map(entry => entry.key === row.key ? { ...entry, quantity: event.target.value } : entry)))} /></div>
                <Button type="button" variant="outline" size="icon" aria-label={`Remove product line ${index + 1}`} disabled={locked || rows.length === 1} onClick={() => changeDraft(() => setRows(current => current.filter(entry => entry.key !== row.key)))}><Trash2 size={16} /></Button>
              </div>
            </div>)}
            <Button type="button" variant="outline" disabled={locked || rows.length >= 100} onClick={() => changeDraft(() => setRows(current => [...current, { key: nextRow.current++, item: null, quantity: "1" }]))}><Plus size={16} className="mr-2" />Add product line</Button>
          </div>
          {([{ id: "movement-from", label: "Source Location", value: from, set: setFrom, other: to }, { id: "movement-to", label: "Destination Location", value: to, set: setTo, other: from }]).map(field => <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>{field.label}</Label>
            <Select value={field.value} onValueChange={value => changeDraft(() => field.set(value))} disabled={locked}>
              <SelectTrigger id={field.id}><SelectValue placeholder="Select a location" /></SelectTrigger>
              <SelectContent>{locations.map(location => <SelectItem key={location.id} value={location.id} disabled={location.id === field.other}>{location.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>)}
          <div className="space-y-2">
            <Label htmlFor="movement-receiver">Receiving responsible person (optional)</Label>
            <Select value={receiver} onValueChange={value => changeDraft(() => setReceiver(value))} disabled={locked || membersLoading || !!membersError}>
              <SelectTrigger id="movement-receiver" aria-label="Receiving responsible person (optional)"><SelectValue placeholder="Unassigned" /></SelectTrigger>
              <SelectContent><SelectItem value="unassigned">Unassigned</SelectItem>{members.map(member => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}{pending?.receivingUserId && !members.some(member => member.id === pending.receivingUserId) && <SelectItem value={pending.receivingUserId}>{pending.receivingUserId}</SelectItem>}</SelectContent>
            </Select>
            {membersError && <p className="text-sm text-destructive" role="alert">Unable to load receiving responsible people. You can create an unassigned movement.</p>}
          </div>
          <div className="space-y-2"><Label htmlFor="movement-notes">Notes (optional)</Label><Input id="movement-notes" value={notes} maxLength={1000} disabled={locked} onChange={event => changeDraft(() => setNotes(event.target.value))} /></div>
          {(error || locationsError) && <p role="alert" className="text-sm text-destructive">{error || locationsError}</p>}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{pending ? "Close (keep pending)" : "Cancel"}</Button>
          {!pending && <Button type="button" variant="outline" disabled={demo || locked || !!locationsError || !storageKey} onClick={() => void save("draft")}>Save Draft</Button>}
          <Button type="submit" disabled={demo || saving || !!restored.error || (!pending && !!locationsError) || !storageKey}>{saving ? "Saving..." : pending ? "Retry Movement" : "Request Transfer"}</Button>
        </DialogFooter>
      </DialogForm>
    </DialogContent>
  </Dialog>
}