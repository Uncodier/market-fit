"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { upsertPromotion } from "../actions"
import useSWR from "swr"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"

interface CreatePromotionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

type FormData = {
  name: string
  code: string
  campaign_value: RelationSelectValue
  discount_type: 'percent' | 'fixed'
  discount_value: string
  applies_to: 'all' | 'selected_items'
}

export function CreatePromotionDialog({ open, onOpenChange, onSuccess }: CreatePromotionDialogProps) {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { data: campaigns } = useSWR(currentSite?.id ? ['campaigns', currentSite.id] : null, () => getCampaigns(currentSite!.id))

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      discount_type: 'percent',
      applies_to: 'all',
      campaign_value: null
    }
  })

  const discountType = watch('discount_type')
  const campaignValue = watch('campaign_value')

  const onSubmit = async (data: FormData) => {
    if (!currentSite || !user) return
    setIsSubmitting(true)

    try {
      const { id: resolvedCampaignId, error: campError } = await resolveRelationId("campaign", data.campaign_value, currentSite.id)
      if (campError) throw new Error(`Campaign error: ${campError}`)
      if (!resolvedCampaignId) throw new Error("Campaign is required")

      const res = await upsertPromotion({
        site_id: currentSite.id,
        user_id: user.id,
        name: data.name,
        code: data.code || undefined,
        campaign_id: resolvedCampaignId,
        discount_type: data.discount_type,
        discount_value: parseFloat(data.discount_value),
        applies_to: data.applies_to,
        status: 'draft'
      })

      if (res.error) throw new Error(res.error)

      toast.success('Promotion created successfully')
      reset()
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create promotion')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create Promotion</DialogTitle>
          <DialogDescription>
            Add a discount rule linked to a campaign.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Campaign</Label>
            <RelationSelect 
              options={campaigns?.data?.map(c => ({ id: c.id, label: c.title })) || []}
              value={campaignValue} 
              onValueChange={v => setValue('campaign_value', v)}
              placeholder="Select campaign..."
              emptyMessage="No campaigns found"
            />
            {!campaignValue && <p className="text-xs text-red-500">Campaign is required</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Summer Sale 20%" {...register("name", { required: "Name is required" })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Coupon Code (Optional)</Label>
            <Input id="code" placeholder="e.g. SUMMER20" className="uppercase" {...register("code")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <Select value={discountType} onValueChange={(v: any) => setValue('discount_type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount_value">Value</Label>
              <Input id="discount_value" type="number" step="0.01" min="0.01" {...register("discount_value", { required: "Value is required" })} />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !campaignValue}>
              {isSubmitting ? "Creating..." : "Create Promotion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
