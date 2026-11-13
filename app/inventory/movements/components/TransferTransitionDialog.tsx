"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogForm, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import type { TransferOrderDetail } from "../order-types"
import type { TransferTransitionInput } from "../order-schema"
import { outstanding, transferLabel } from "../transfer-presentation"

export function TransferTransitionDialog({ order, action, busy, onClose, onSubmit }: {
  order: TransferOrderDetail; action: TransferTransitionInput["action"]; busy: boolean; onClose: () => void;
  onSubmit: (payload: Pick<TransferTransitionInput, "lines" | "notes">) => Promise<void>
}) {
  const [values, setValues] = useState<Record<string, { quantity: string; returned: string; writtenOff: string }>>({})
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const needsLines = ["dispatch", "receive", "reconcile"].includes(action)
  const defaults = { quantity: "0", returned: "0", writtenOff: "0" }
  const submit = async () => {
    setError("")
    const lines: NonNullable<TransferTransitionInput["lines"]> = []
    if (needsLines) for (const line of order.lines) {
      const entry = values[line.id] || defaults
      const nums = [entry.quantity, entry.returned, entry.writtenOff].map(Number)
      if (nums.some(value => !Number.isFinite(value) || value < 0)) return setError("Enter valid non-negative quantities.")
      const [quantity, returnedQuantity, writtenOffQuantity] = nums
      const max = action === "dispatch" ? line.requested_quantity : outstanding(line)
      if ((action === "reconcile" ? returnedQuantity + writtenOffQuantity : quantity) > max) return setError(`${line.item_name}: quantity cannot exceed ${max}.`)
      if (action === "reconcile" && returnedQuantity + writtenOffQuantity > 0) lines.push({ lineId: line.id, returnedQuantity, writtenOffQuantity })
      else if (action === "dispatch" || (action === "receive" && quantity > 0)) lines.push({ lineId: line.id, quantity })
    }
    if (needsLines && !lines.length) return setError("Enter a quantity for at least one line.")
    if (action === "dispatch" && !lines.some(line => (line.quantity || 0) > 0)) return setError("Dispatch at least one product.")
    if (action === "reconcile" && !notes.trim()) return setError("A reason is required for returned or written-off quantities.")
    await onSubmit({ ...(needsLines ? { lines } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}) })
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}><DialogContent size="lg" busy={busy}><DialogForm onSubmit={event => { event.preventDefault(); void submit() }}>
    <DialogHeader><DialogTitle>{transferLabel(action)} Transfer</DialogTitle><DialogDescription>{action === "dispatch" ? "Enter actual dispatched totals per line, up to the requested quantity. Zero means not dispatched; at least one product must be dispatched." : action === "receive" ? "Enter additional quantities received now. Remaining units stay in transit; partial receipts do not close the transfer." : action === "reconcile" ? "Return outstanding units to origin or write them off. A reason is required. Unresolved units remain in transit." : action === "cancel" ? "Cancel this transfer before dispatch. No stock will move." : `Confirm ${action} for this transfer.`}</DialogDescription></DialogHeader>
    <DialogBody className="space-y-4">
      {needsLines && order.lines.map(line => {
        const value = values[line.id] || defaults
        const max = action === "dispatch" ? line.requested_quantity : outstanding(line)
        const fields = action === "reconcile" ? [["returned", "Return"], ["writtenOff", "Write off"]] as const : [["quantity", action === "dispatch" ? "Dispatch total" : "Receive now"]] as const
        return <fieldset key={line.id} disabled={busy || max === 0} className="rounded-lg border p-3 space-y-2"><legend className="px-1 text-sm font-medium">{line.item_name}</legend><p className="text-xs text-muted-foreground">{action === "dispatch" ? "Requested" : "Outstanding"}: {max}</p><div className="flex gap-3">{fields.map(([field, label]) => <div key={field} className="flex-1 space-y-1"><Label htmlFor={`${line.id}-${field}`}>{label}</Label><Input id={`${line.id}-${field}`} aria-label={`${line.item_name} ${label}`} type="number" step="any" min={0} max={max} value={value[field]} onChange={event => setValues(current => ({ ...current, [line.id]: { ...value, [field]: event.target.value } }))} /></div>)}</div></fieldset>
      })}
      <div className="space-y-1"><Label htmlFor="transfer-reason">{action === "reconcile" ? "Reason (required)" : "Notes (optional)"}</Label><Input id="transfer-reason" value={notes} maxLength={1000} disabled={busy} onChange={event => setNotes(event.target.value)} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </DialogBody><DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Back</Button><Button type="submit" disabled={busy}>{busy ? "Submitting..." : `Confirm ${transferLabel(action).toLowerCase()}`}</Button></DialogFooter>
  </DialogForm></DialogContent></Dialog>
}