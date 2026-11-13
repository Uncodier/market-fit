"use client"

import { startTransition, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { listLocations } from "@/app/inventory/actions"
import { siteMembersService } from "@/app/services/site-members-service"
import { readBillInventoryReceiptLines, receiveBillInventoryLines } from "../receive-inventory-actions"
import type { BillInventoryReceiptInput, BillInventoryReceiptLine } from "../receipt-schema"
import { clearPendingReceipt, pendingReceiptKey, readPendingReceipt, writePendingReceipt } from "../pending-receipt"
import type { Location, Purchase } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Skeleton } from "@/app/components/ui/skeleton"
import { useAuthContext } from "@/app/components/auth/auth-context"

export function ReceivePurchaseStockDialog({ siteId, purchase, open, onOpenChange, onSuccess }: {
  siteId: string; purchase: Purchase; open: boolean
  onOpenChange: (open: boolean) => void; onSuccess: () => void | Promise<void>
}) {
  const { user } = useAuthContext()
  const actorId = user?.id
  const [locations, setLocations] = useState<Location[]>([])
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [lines, setLines] = useState<BillInventoryReceiptLine[]>([])
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [locationId, setLocationId] = useState("")
  const [receiverId, setReceiverId] = useState("")
  const [storageKey, setStorageKey] = useState<string | null>(null)
  const [pending, setPending] = useState<BillInventoryReceiptInput | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)
  const submitting = useRef(false)

  useEffect(() => {
    if (!open) return
    let active = true
    startTransition(async () => {
      setLoading(true); setError(null); setStorageKey(null)
      setLocations([]); setMembers([]); setLines([]); setPending(null)
      try {
        if (!actorId) throw new Error("Not authenticated")
        const key = pendingReceiptKey(actorId, siteId, purchase.id)
        const restored = readPendingReceipt(key, siteId, purchase.id)
        if (!active) return
        setStorageKey(key); setPending(restored)
        if (restored) {
          setLocationId(restored.toLocationId); setReceiverId(restored.receivingUserId)
          setQuantities(Object.fromEntries(restored.lines.map(line => [line.purchaseItemId, String(line.quantity)])))
        }
        const [locationResult, lineResult, memberResult] = await Promise.all([
          listLocations(siteId), readBillInventoryReceiptLines(siteId, purchase.id),
          siteMembersService.getAssigneeOptions(siteId),
        ])
        if (!active) return
        if (locationResult.error || lineResult.error || lineResult.actorId !== actorId) {
          if (!restored) setStorageKey(null)
          throw new Error("Load failed")
        }
        const available = locationResult.data.filter(location => location.site_id === siteId && location.is_active)
        setLocations(available); setMembers(memberResult); setLines(lineResult.data)
        setStorageKey(key); setPending(restored)
        setLocationId(restored?.toLocationId || available.find(location => location.id === purchase.locationId)?.id || available.find(location => location.is_default)?.id || "")
        setReceiverId(restored?.receivingUserId || "")
        setQuantities(Object.fromEntries(lineResult.data.map(line => [line.id,
          String(restored ? restored.lines.find(item => item.purchaseItemId === line.id)?.quantity || 0 : 0)])))
      } catch {
        if (active) setError("Receipt data or pending receipt storage could not be loaded. Resolve storage or retry loading before receiving.")
      } finally { if (active) setLoading(false) }
    })
    return () => { active = false }
  }, [open, siteId, purchase.id, purchase.locationId, generation, actorId])

  const selected = lines.filter(line => Number(quantities[line.id]) > 0)
    .map(line => ({ purchaseItemId: line.id, quantity: Number(quantities[line.id]) }))
  const invalidQuantity = lines.some(line => {
    const quantity = Number(quantities[line.id])
    return !Number.isFinite(quantity) || quantity < 0 || quantity > Math.max(0, line.quantity - line.received_quantity) || quantity > 1_000_000_000
  })
  const canReceive = !!storageKey && (!!pending || (!invalidQuantity && selected.length > 0 && selected.length <= 100 &&
    locations.some(location => location.id === locationId) && members.some(member => member.id === receiverId)))

  async function receive() {
    if (submitting.current || loading || !canReceive || !storageKey) return
    submitting.current = true; setBusy(true); setError(null)
    const wasPending = !!pending
    try {
      const input = pending || { siteId, purchaseId: purchase.id, requestId: crypto.randomUUID(),
        toLocationId: locationId, receivingUserId: receiverId, lines: selected }
      writePendingReceipt(storageKey, input)
      setPending(input)
      const result = await receiveBillInventoryLines(input)
      if (!result.success) {
        // Only an initial definitive rejection may unlock editing. An uncertain request stays immutable.
        if (!wasPending && ([400, 403].includes(result.status) || result.code === "operation_rejected")) {
          clearPendingReceipt(storageKey); setPending(null)
        }
        setError(result.error || "Stock could not be received."); return
      }
      clearPendingReceipt(storageKey); setPending(null)
      toast.success(result.alreadyApplied ? "Stock receipt already applied" : "Stock received")
      onOpenChange(false)
      await onSuccess()
    } catch {
      setError("Stock receipt could not be confirmed. Retry the same saved request; do not create another receipt.")
    } finally { submitting.current = false; setBusy(false) }
  }

  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value) }}>
    <DialogContent className="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Receive stock</DialogTitle>
        <DialogDescription>Enter quantities received now for each bill product line and choose who receives them. Zero quantities are omitted. The server verifies remaining quantities and receiver eligibility.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {loading ? <Skeleton className="h-10 w-full" aria-label="Loading receipt data" /> : <>
          <div className="space-y-2">
            <Label htmlFor="bill-receive-location">Destination location</Label>
            <Select value={locationId} onValueChange={setLocationId} disabled={busy || !!pending || !locations.length}>
              <SelectTrigger id="bill-receive-location"><SelectValue placeholder="Choose a location" /></SelectTrigger>
              <SelectContent>{locations.map(location => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent>
            </Select>
            {!locations.length && <p className="text-sm text-muted-foreground">No active locations are available.</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="bill-receive-user">Receiving person</Label>
            <Select value={receiverId} onValueChange={setReceiverId} disabled={busy || !!pending || !members.length}>
              <SelectTrigger id="bill-receive-user"><SelectValue placeholder="Choose who receives" /></SelectTrigger>
              <SelectContent>{members.map(member => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent>
            </Select>
            {!members.length && <p className="text-sm text-muted-foreground">No active receiving people are available.</p>}
          </div>
          <div className="max-h-64 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <caption className="sr-only">Product quantities to receive</caption>
              <thead><tr className="border-b">{["Product", "Purchased", "Received", "Remaining", "Qty received now"].map(label => <th key={label} className="p-2 text-left">{label}</th>)}</tr></thead>
              <tbody>{lines.map(line => <tr key={line.id} className="border-b last:border-0">
                <td className="p-2">{line.name}</td><td className="p-2">{line.quantity}</td>
                <td className="p-2">{line.received_quantity}</td><td className="p-2">{Math.max(0, line.quantity - line.received_quantity)}</td>
                <td className="p-2"><Input type="number" min="0" step="any" max={Math.max(0, line.quantity - line.received_quantity)}
                  aria-label={`Qty received now for ${line.name}`} value={quantities[line.id] || ""}
                  disabled={busy || !!pending || line.received_quantity >= line.quantity}
                  onChange={event => setQuantities(value => ({ ...value, [line.id]: event.target.value }))} /></td>
              </tr>)}</tbody>
            </table>
          </div>
          {!lines.length && <p className="text-sm text-muted-foreground">No product lines to receive into inventory.</p>}
        </>}
        {pending && <p role="status" className="text-sm">A saved receipt is awaiting confirmation. Retry sends only the identical request, even if remaining quantities have changed.</p>}
        {invalidQuantity && !pending && <p className="text-sm text-destructive">Quantities must be between zero and the remaining quantity.</p>}
        {error && <div role="alert" className="text-sm text-destructive">{error}
          {!storageKey && !loading && <Button variant="link" onClick={() => setGeneration(value => value + 1)}>Retry loading receipt data</Button>}
        </div>}
      </div>
      <DialogFooter>
        <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={() => startTransition(receive)} disabled={busy || loading || !canReceive}>{busy ? "Receiving…" : pending ? "Retry saved receipt" : "Receive stock"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}
