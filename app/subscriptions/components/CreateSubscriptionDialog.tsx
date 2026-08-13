"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import useSWR from "swr"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogForm,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { upsertSubscription } from "../actions"
import { getLeads } from "@/app/leads/actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { BuyerUserEmailField, BuyerUser } from "@/app/components/commerce/BuyerUserEmailField"
import { findOrCreateLeadForBuyer } from "@/app/commerce/resolve-buyer-lead"

interface CreateSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type FormData = {
  catalog_item_value: RelationSelectValue
  lead_value: RelationSelectValue
  amount: string
  start_date: string
  end_date?: string
}

export function CreateSubscriptionDialog({ open, onOpenChange, onSuccess }: CreateSubscriptionDialogProps) {
  const { currentSite } = useSite()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [buyerUser, setBuyerUser] = useState<BuyerUser | null>(null)
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>()

  const catalogItemValue = watch('catalog_item_value')
  const leadValue = watch('lead_value')

  const { data: leadsData } = useSWR(
    open && currentSite ? ['leads', currentSite.id] : null,
    () => getLeads(currentSite!.id)
  )

  const { data: catalogData } = useSWR(
    open && currentSite ? ['catalog', currentSite.id, 'subscriptions'] : null,
    () => listCatalogItems({ siteId: currentSite!.id, isRecurring: true, pageSize: 100 })
  )

  const leads = leadsData?.leads || []
  const items = catalogData?.data || []

  const onSubmit = async (data: FormData) => {
    if (!currentSite) return
    setIsSubmitting(true)

    try {
      let finalLeadId: string | null = null
      let finalBuyerUserId: string | null = null

      if (buyerUser) {
        // If a buyer user was selected, resolve/create their lead
        const res = await findOrCreateLeadForBuyer({
          siteId: currentSite.id,
          email: buyerUser.email,
          name: buyerUser.name,
          buyerUserId: buyerUser.buyerUserId
        })
        if (res.error) throw new Error(`Buyer lead error: ${res.error}`)
        finalLeadId = res.lead?.id || null
        finalBuyerUserId = res.lead?.buyer_user_id || null
      }

      if (!finalLeadId) {
        // Fallback to the regular relation select
        const { id: resolvedLeadId, error: leadError } = await resolveRelationId("lead", data.lead_value, currentSite.id)
        if (leadError) throw new Error(`Lead error: ${leadError}`)
        finalLeadId = resolvedLeadId

        // See if this lead has a buyer_user_id we can copy
        if (finalLeadId) {
          const matchingLead = leads.find((l: any) => l.id === finalLeadId)
          if (matchingLead?.buyer_user_id) {
            finalBuyerUserId = matchingLead.buyer_user_id
          }
        }
      }

      const { id: resolvedCatalogItemId, error: catalogError } = await resolveRelationId(
        "catalog_item", 
        data.catalog_item_value, 
        currentSite.id,
        { kind: "digital_asset" } // defaults to a digital asset since it's recurring
      )
      if (catalogError) throw new Error(`Catalog error: ${catalogError}`)

      if (!resolvedCatalogItemId || !finalLeadId) {
        throw new Error("Lead and Service/Product are required")
      }

      const res = await upsertSubscription({
        site_id: currentSite.id,
        catalog_item_id: resolvedCatalogItemId,
        lead_id: finalLeadId,
        buyer_user_id: finalBuyerUserId || undefined,
        start_date: new Date(data.start_date).toISOString(),
        end_date: data.end_date ? new Date(data.end_date).toISOString() : null,
        amount: parseFloat(data.amount),
        status: 'active'
      })

      if (res.error) throw new Error(res.error)

      toast.success('Subscription created successfully')
      reset()
      setBuyerUser(null)
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create subscription')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" busy={isSubmitting}>
        <DialogForm onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create Subscription</DialogTitle>
            <DialogDescription>
              Create a manual subscription record for a customer.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="catalog_item_value">Service / Product</Label>
              <RelationSelect
                options={items.map((i: any) => ({ id: i.id, label: i.name }))}
                value={catalogItemValue}
                onValueChange={(val) => setValue('catalog_item_value', val, { shouldValidate: true })}
                placeholder="Select a recurring plan..."
                emptyMessage="No recurring plans found"
              />
            </div>
            <div className="grid gap-2">
              <Label>Buyer</Label>
              <BuyerUserEmailField
                value={buyerUser}
                onChange={setBuyerUser}
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lead_value">Customer</Label>
              <RelationSelect
                options={leads.map((l: any) => ({ id: l.id, label: l.name || l.email }))}
                value={leadValue}
                onValueChange={(val) => setValue('lead_value', val, { shouldValidate: true })}
                placeholder={buyerUser ? "Optional: Customer will be auto-created" : "Select customer..."}
                emptyMessage="No customers found"
                disabled={!!buyerUser}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start_date">Start date</Label>
                <Input type="date" id="start_date" className="h-12" {...register("start_date", { required: true })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end_date">End date</Label>
                <Input type="date" id="end_date" className="h-12" {...register("end_date")} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Billing amount</Label>
              <Input type="number" step="0.01" id="amount" className="h-12" {...register("amount", { required: true })} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}