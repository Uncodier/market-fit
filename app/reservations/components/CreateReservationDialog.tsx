"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import useSWR from "swr"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { upsertReservation } from "../actions"
import { getLeads } from "@/app/leads/actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"

interface CreateReservationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type FormData = {
  catalog_item_value: RelationSelectValue
  lead_value: RelationSelectValue
  start_time: string
  end_time: string
  notes?: string
}

export function CreateReservationDialog({ open, onOpenChange, onSuccess }: CreateReservationDialogProps) {
  const { currentSite } = useSite()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>()

  const catalogItemValue = watch('catalog_item_value')
  const leadValue = watch('lead_value')

  const { data: leadsData } = useSWR(
    open && currentSite ? ['leads', currentSite.id] : null,
    () => getLeads(currentSite!.id)
  )

  const { data: catalogData } = useSWR(
    open && currentSite ? ['catalog', currentSite.id, 'reservations'] : null,
    () => listCatalogItems({ siteId: currentSite!.id, isReservation: true, pageSize: 100 })
  )

  const leads = leadsData?.leads || []
  const items = catalogData?.data || []

  const onSubmit = async (data: FormData) => {
    if (!currentSite) return
    setIsSubmitting(true)

    try {
      const { id: resolvedLeadId, error: leadError } = await resolveRelationId("lead", data.lead_value, currentSite.id)
      if (leadError) throw new Error(`Lead error: ${leadError}`)

      const { id: resolvedCatalogItemId, error: catalogError } = await resolveRelationId(
        "catalog_item", 
        data.catalog_item_value, 
        currentSite.id,
        { kind: "service" } // defaults to service since it's a reservation
      )
      if (catalogError) throw new Error(`Catalog error: ${catalogError}`)

      if (!resolvedCatalogItemId || !resolvedLeadId) {
        throw new Error("Lead and Service/Product are required")
      }

      const res = await upsertReservation({
        site_id: currentSite.id,
        catalog_item_id: resolvedCatalogItemId,
        lead_id: resolvedLeadId,
        start_time: new Date(data.start_time).toISOString(),
        end_time: new Date(data.end_time).toISOString(),
        notes: data.notes,
        status: 'confirmed'
      })

      if (res.error) throw new Error(res.error)

      toast.success('Reservation created successfully')
      reset()
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create reservation')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Reservation</DialogTitle>
          <DialogDescription>
            Schedule a new appointment or booking manually.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="catalog_item_value">Service / Product</Label>
            <RelationSelect 
              options={items.map((i: any) => ({ id: i.id, label: i.name }))}
              value={catalogItemValue} 
              onValueChange={(val) => setValue('catalog_item_value', val, { shouldValidate: true })}
              placeholder="Select a service..."
              emptyMessage="No reservable services found"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead_value">Customer</Label>
            <RelationSelect 
              options={leads.map((l: any) => ({ id: l.id, label: l.name || l.email }))}
              value={leadValue} 
              onValueChange={(val) => setValue('lead_value', val, { shouldValidate: true })}
              placeholder="Select customer..."
              emptyMessage="No customers found"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input type="datetime-local" id="start_time" {...register("start_time", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time</Label>
              <Input type="datetime-local" id="end_time" {...register("end_time", { required: true })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" {...register("notes")} />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}