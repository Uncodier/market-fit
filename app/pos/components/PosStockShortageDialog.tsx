"use client"

import { useRef, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import { toast } from "sonner"
import type { CatalogItem } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import type { PosInventorySnapshot } from "../inventory-availability"

type Props = {
  siteId: string
  item: CatalogItem
  quantity: number
  locationId: string
  currency: string
  inventory?: PosInventorySnapshot | null
  locations: { id: string; name?: string | null }[]
  onComplete: () => void
  onClose: () => void
}

export function PosStockShortageDialog({ siteId, item, quantity, locationId, currency,
  inventory, locations, onComplete, onClose }: Props) {
  const [requestId] = useState<string>(() => uuidv4())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [reviewRequired, setReviewRequired] = useState(false)
  const [created, setCreated] = useState<{ id: string; kind: "purchase" | "transfer" }>()
  // Keep an ambiguous retry on the exact same request; never create a second document silently.
  const [attempt, setAttempt] = useState<{ kind: "purchase" | "transfer"; sourceLocationId?: string } | null>(null)
  const pending = useRef(false)
  // A retry must have the exact same payload, even after background stock refreshes.
  // This is only a proposal; dispatch still validates the authoritative stock.
  const [sources] = useState(() => locations.map((location) => ({ ...location,
    quantity: Math.min(quantity, inventory?.levels.filter((level) => level.catalog_item_id === item.id && level.location_id === location.id)
      .reduce((total, level) => total + Number(level.quantity || 0), 0) || 0),
  })).filter((location) => location.id !== locationId && location.quantity > 0))

  const request = async (kind: "purchase" | "transfer", sourceLocationId?: string) => {
    if (pending.current || created || reviewRequired) return
    if (!navigator.onLine) { setError("Connect to the internet to request stock."); return }
    if (!locationId) { setError("Select an origin location before requesting stock."); return }
    if (attempt && (attempt.kind !== kind || attempt.sourceLocationId !== sourceLocationId)) return
    setAttempt({ kind, sourceLocationId })
    pending.current = true
    setBusy(true)
    setError(undefined)
    try {
      const { requestPosShortagePurchase, requestPosShortageTransfer } = await import("../shortage-replenishment")
      const input = { siteId, catalogItemId: item.id,
        quantity: kind === "transfer" ? sources.find((source) => source.id === sourceLocationId)!.quantity : quantity,
        locationId, requestId }
      const result = kind === "purchase"
        ? await requestPosShortagePurchase({ ...input, currency })
        : await requestPosShortageTransfer({ ...input, sourceLocationId: sourceLocationId! })
      if (result.reviewRequired) setReviewRequired(true)
      if (result.error || !result.id) {
        setError(result.error || "The request could not be confirmed. Review requests before trying again.")
        if (!result.id && !result.error && kind === "purchase") setReviewRequired(true)
        return
      }
      setCreated({ id: result.id, kind })
      toast.success(kind === "purchase" ? "Purchase requisition draft created" : "Transfer requested")
    } catch (cause) {
      if (kind === "purchase") setReviewRequired(true)
      setError(cause instanceof Error ? cause.message : "The request could not be confirmed. Retry the same action.")
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  const disabled = (kind: "purchase" | "transfer", sourceLocationId?: string) => busy || !!created || reviewRequired ||
    !!attempt && (attempt.kind !== kind || attempt.sourceLocationId !== sourceLocationId)

  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
    <DialogContent size="md" aria-busy={busy}>
      <DialogHeader>
        <DialogTitle>Insufficient stock</DialogTitle>
        <DialogDescription>{item.name}: {quantity} additional unit(s) needed at the selected location.</DialogDescription>
      </DialogHeader>
      <DialogBody className="space-y-4">
        {created ? <div role="status" className="space-y-2 text-sm">
          <p>{created.kind === "purchase" ? "Purchase requisition saved as a draft for review and submission." : "Transfer requested. Approval, dispatch and receipt are still required."}</p>
          <p>The cart has not changed. Add the item again after the stock is received.</p>
          <a className="underline" target="_blank" rel="noopener noreferrer"
            href={created.kind === "purchase" ? `/purchases/requests/${created.id}` : `/inventory/movements/${created.id}`}>
            Open {created.kind === "purchase" ? "requisition" : "transfer"}
          </a>
        </div> : <>
          <div className="space-y-2">
            <Button className="w-full" disabled={busy || !!attempt} onClick={onComplete}>Add as completed</Button>
            <p className="text-xs text-muted-foreground">Use only when the newly added item and its extras have already been fulfilled. They will not deduct stock again. Payment is still required.</p>
          </div>
          <Button variant="outline" className="w-full" disabled={disabled("purchase") || !locationId}
            onClick={() => void request("purchase")}>Create purchase requisition</Button>
          {sources.map((source) => <Button key={source.id} variant="outline" className="w-full"
            disabled={disabled("transfer", source.id) || !locationId}
            onClick={() => void request("transfer", source.id)}>Request transfer from {source.name || "another location"}{source.quantity < quantity ? ` (${source.quantity} units)` : ""}</Button>)}
          <p className="text-xs text-muted-foreground">Stock requests require an internet connection and the corresponding permissions. Requests do not reserve or receive inventory.</p>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {reviewRequired && <a href="/purchases/requests" target="_blank" rel="noopener noreferrer" className="text-sm underline">Review purchase requisitions before creating another request</a>}
      </DialogBody>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>{created ? "Done" : "Cancel"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}