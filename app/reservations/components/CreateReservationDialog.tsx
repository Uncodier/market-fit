"use client"

import { useState } from "react"
import { format } from "date-fns"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { upsertReservation } from "../actions"
import { assertReservationSlot } from "../availability"
import { getLeads } from "@/app/leads/actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { ReservationSlotPicker } from "@/app/components/commerce/ReservationSlotPicker"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { useDirtyDialogClose } from "@/app/components/ui/use-dirty-dialog-close"

interface CreateReservationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreateReservationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateReservationDialogProps) {
  const { currentSite } = useSite()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [catalogItemValue, setCatalogItemValue] = useState<RelationSelectValue>(null)
  const [leadValue, setLeadValue] = useState<RelationSelectValue>(null)
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null)
  const [notes, setNotes] = useState("")

  const { data: leadsData } = useSWR(
    open && currentSite ? ["leads", currentSite.id] : null,
    () => getLeads(currentSite!.id)
  )

  const { data: catalogData, isLoading: catalogLoading } = useSWR(
    open && currentSite ? ["catalog", currentSite.id, "reservable"] : null,
    () => listCatalogItems({ siteId: currentSite!.id, isReservation: true, pageSize: 100 })
  )

  const leads = leadsData?.leads || []
  const items = catalogData?.data || []
  const catalogItemId = catalogItemValue?.mode === "existing" ? catalogItemValue.id : ""

  const resetForm = () => {
    setCatalogItemValue(null)
    setLeadValue(null)
    setSelectedSlot(null)
    setNotes("")
  }

  const dirty = Boolean(catalogItemValue || leadValue || selectedSlot || notes.trim())

  const { discardOpen, setDiscardOpen, handleOpenChange, confirmDiscard } =
    useDirtyDialogClose({
      dirty,
      busy: isSubmitting,
      onOpenChange: (next) => {
        if (!next) resetForm()
        onOpenChange(next)
      },
    })

  const handleSubmit = async () => {
    if (!currentSite) return
    if (!selectedSlot) {
      toast.error("Select a time slot")
      return
    }

    setIsSubmitting(true)
    try {
      const { id: resolvedItemId, error: itemError } = await resolveRelationId(
        "catalog_item",
        catalogItemValue,
        currentSite.id
      )
      if (itemError) throw new Error(itemError)
      if (!resolvedItemId) throw new Error("Service is required")

      const { id: resolvedLeadId, error: leadError } = await resolveRelationId(
        "lead",
        leadValue,
        currentSite.id
      )
      if (leadError) throw new Error(leadError)
      if (!resolvedLeadId) throw new Error("Customer is required")

      await assertReservationSlot(
        currentSite.id,
        resolvedItemId,
        selectedSlot.start,
        selectedSlot.end,
        1,
        true
      )

      const res = await upsertReservation({
        site_id: currentSite.id,
        catalog_item_id: resolvedItemId,
        lead_id: resolvedLeadId,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        notes: notes.trim() || undefined,
        status: "confirmed",
      })
      if (res.error) throw new Error(res.error)

      toast.success("Reservation created successfully")
      resetForm()
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || "Failed to create reservation")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent size="lg" busy={isSubmitting}>
          <DialogHeader>
            <DialogTitle>Create reservation</DialogTitle>
            <DialogDescription>
              Book a reservable service for a customer.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-5">
            {catalogLoading ? (
              <p className="text-sm text-muted-foreground">Loading services...</p>
            ) : items.length === 0 ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <p className="font-medium">No reservable services</p>
                <p className="text-muted-foreground mt-1">
                  Create a reservable service in your catalog first.
                </p>
                <Button
                  type="button"
                  className="mt-3"
                  onClick={() => {
                    handleOpenChange(false)
                    router.push("/catalog")
                  }}
                >
                  Go to Catalog
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Service</Label>
                  <RelationSelect
                    options={items.map((item: { id: string; name: string }) => ({
                      id: item.id,
                      label: item.name,
                    }))}
                    value={catalogItemValue}
                    onValueChange={(value) => {
                      setCatalogItemValue(value)
                      setSelectedSlot(null)
                    }}
                    allowCreate={false}
                    placeholder="Select a reservable service..."
                    emptyMessage="No reservable services found"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <RelationSelect
                    options={leads.map((lead: { id: string; name?: string; email?: string }) => ({
                      id: lead.id,
                      label: lead.name || lead.email || lead.id,
                    }))}
                    value={leadValue}
                    onValueChange={setLeadValue}
                    placeholder="Select customer..."
                    emptyMessage="No customers found"
                  />
                </div>
                {catalogItemId ? (
                  <div className="space-y-2">
                    <Label>Time slot</Label>
                    <ReservationSlotPicker
                      key={catalogItemId}
                      catalogItemId={catalogItemId}
                      hideDetailsStep
                      onSelect={(start, end) => setSelectedSlot({ start, end })}
                    />
                    {selectedSlot ? (
                      <p className="text-sm text-muted-foreground">
                        Selected: {format(new Date(selectedSlot.start), "PPP p")}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="reservation-notes">Notes</Label>
                  <Textarea
                    id="reservation-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Any special requirements?"
                  />
                </div>
              </>
            )}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || items.length === 0 || !catalogItemId || !leadValue || !selectedSlot}
            >
              {isSubmitting ? "Creating..." : "Create reservation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard changes?"
        description="Your changes will be lost."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={confirmDiscard}
      />
    </>
  )
}
