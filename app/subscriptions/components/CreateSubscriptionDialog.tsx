"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import useSWR from "swr"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { upsertSubscription } from "../actions"
import { getLeads } from "@/app/leads/actions"
import { listCatalogItems } from "@/app/catalog/actions"

interface CreateSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type FormData = {
  catalog_item_id: string
  lead_id: string
  amount: string
  start_date: string
}

export function CreateSubscriptionDialog({ open, onOpenChange, onSuccess }: CreateSubscriptionDialogProps) {
  const { currentSite } = useSite()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>()

  const catalogItemId = watch('catalog_item_id')
  const leadId = watch('lead_id')

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
      const res = await upsertSubscription({
        site_id: currentSite.id,
        catalog_item_id: data.catalog_item_id,
        lead_id: data.lead_id,
        start_date: new Date(data.start_date).toISOString(),
        amount: parseFloat(data.amount),
        status: 'active'
      })

      if (res.error) throw new Error(res.error)

      toast.success('Subscription created successfully')
      reset()
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Subscription</DialogTitle>
          <DialogDescription>
            Create a manual subscription record for a customer.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="catalog_item_id">Service / Product</Label>
            <Select 
              value={catalogItemId || ''} 
              onValueChange={(val: any) => setValue('catalog_item_id', val, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a recurring plan..." />
              </SelectTrigger>
              <SelectContent>
                {items.length === 0 ? (
                  <SelectItem value="none" disabled>No recurring plans found</SelectItem>
                ) : (
                  items.map((item: any) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <input type="hidden" {...register("catalog_item_id", { required: true })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead_id">Customer</Label>
            <Select 
              value={leadId || ''} 
              onValueChange={(val: any) => setValue('lead_id', val, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer..." />
              </SelectTrigger>
              <SelectContent>
                {leads.length === 0 ? (
                  <SelectItem value="none" disabled>No customers found</SelectItem>
                ) : (
                  leads.map((lead: any) => (
                    <SelectItem key={lead.id} value={lead.id}>{lead.name || lead.email}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <input type="hidden" {...register("lead_id", { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input type="date" id="start_date" {...register("start_date", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Billing Amount</Label>
              <Input type="number" step="0.01" id="amount" {...register("amount", { required: true })} />
            </div>
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