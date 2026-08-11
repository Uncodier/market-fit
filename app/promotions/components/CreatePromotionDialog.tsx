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
import { setPromotionCategories, setPromotionItems, upsertPromotion } from "../actions"
import useSWR from "swr"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import type { PromotionChannel } from "@/app/types"
import { DEFAULT_PROMOTION_CHANNELS } from "../promotion-channels"
import { PromotionChannelsFields } from "./PromotionChannelsFields"
import { PromotionTargetPicker } from "./PromotionTargetPicker"

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
  channels: PromotionChannel[]
  location_ids: string[]
}

const EMPTY_FORM: FormData = {
  name: '',
  code: '',
  campaign_value: null,
  discount_type: 'percent',
  discount_value: '',
  applies_to: 'all',
  channels: [...DEFAULT_PROMOTION_CHANNELS],
  location_ids: [],
}

export function CreatePromotionDialog({ open, onOpenChange, onSuccess }: CreatePromotionDialogProps) {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  
  const { data: campaigns } = useSWR(currentSite?.id ? ['campaigns', currentSite.id] : null, () => getCampaigns(currentSite!.id))

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: EMPTY_FORM,
  })

  const discountType = watch('discount_type')
  const campaignValue = watch('campaign_value')
  const appliesTo = watch('applies_to')
  const channels = watch('channels')
  const locationIds = watch('location_ids')

  const resetForm = () => {
    reset(EMPTY_FORM)
    setSelectedItemIds([])
    setSelectedCategoryIds([])
  }

  const onSubmit = async (data: FormData) => {
    if (!currentSite || !user) return
    setIsSubmitting(true)

    try {
      const { id: resolvedCampaignId, error: campError } = await resolveRelationId("campaign", data.campaign_value, currentSite.id)
      if (campError) throw new Error(`Campaign error: ${campError}`)
      if (!resolvedCampaignId) throw new Error("Campaign is required")

      if (
        data.applies_to === 'selected_items' &&
        selectedItemIds.length === 0 &&
        selectedCategoryIds.length === 0
      ) {
        throw new Error("Select at least one product or category")
      }

      const channels = data.channels?.length ? data.channels : [...DEFAULT_PROMOTION_CHANNELS]
      const location_ids = channels.includes("pos") ? (data.location_ids || []) : []

      const res = await upsertPromotion({
        site_id: currentSite.id,
        user_id: user.id,
        name: data.name,
        code: data.code || undefined,
        campaign_id: resolvedCampaignId,
        discount_type: data.discount_type,
        discount_value: parseFloat(data.discount_value),
        applies_to: data.applies_to,
        channels,
        location_ids,
        status: 'draft'
      })

      if (res.error) throw new Error(res.error)
      if (!res.data?.id) throw new Error("Failed to create promotion")

      if (data.applies_to === 'selected_items') {
        const itemsRes = await setPromotionItems(res.data.id, currentSite.id, selectedItemIds)
        if (itemsRes.error) throw new Error(itemsRes.error)
        const catsRes = await setPromotionCategories(res.data.id, currentSite.id, selectedCategoryIds)
        if (catsRes.error) throw new Error(catsRes.error)
      }

      toast.success('Promotion created successfully')
      resetForm()
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to create promotion')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next) resetForm()
      onOpenChange(next)
    }}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
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
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
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
          
          <div className="space-y-2">
            <Label>Applies To</Label>
            <Select value={appliesTo} onValueChange={v => setValue('applies_to', v as 'all'|'selected_items')}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entire Order</SelectItem>
                <SelectItem value="selected_items">Specific products or categories</SelectItem>
              </SelectContent>
            </Select>
            {appliesTo === 'selected_items' && (
              <div className="pt-2">
                <PromotionTargetPicker
                  siteId={currentSite?.id}
                  selectedItemIds={selectedItemIds}
                  selectedCategoryIds={selectedCategoryIds}
                  onItemsChange={setSelectedItemIds}
                  onCategoriesChange={setSelectedCategoryIds}
                  compact
                />
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t">
            <Label>Channels</Label>
            <p className="text-xs text-muted-foreground">
              Choose where this promotion can be redeemed.
            </p>
            <PromotionChannelsFields
              siteId={currentSite?.id}
              channels={channels}
              locationIds={locationIds}
              compact
              idPrefix="create-promo-channel"
              onChange={({ channels: nextChannels, location_ids }) => {
                setValue('channels', nextChannels)
                setValue('location_ids', location_ids)
              }}
            />
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
