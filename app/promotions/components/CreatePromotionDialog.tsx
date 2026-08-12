"use client"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { setPromotionCategories, setPromotionItems, setPromotionRequiredItems, setPromotionRequiredCategories, upsertPromotion } from "../actions"
import useSWR from "swr"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { useAuthContext as useAuth } from "@/app/components/auth/auth-provider"
import { RelationSelect } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { DEFAULT_PROMOTION_CHANNELS } from "../promotion-channels"
import { resolvePromotionCurrency } from "../promotion-currency"
import { PromotionChannelsFields } from "./PromotionChannelsFields"
import { PromotionCurrencyField } from "./PromotionCurrencyField"
import { PromotionTargetPicker } from "./PromotionTargetPicker"
import { PromotionRestrictionsFields, type RequiredPromoItemDraft, type RequiredPromoCategoryDraft } from "./PromotionRestrictionsFields"
import { PromotionMerchandisingFields, type PromotionMerchandisingValue } from "./PromotionMerchandisingFields"
import { EMPTY_CREATE_PROMOTION_FORM, type CreatePromotionFormData as FormData } from "./create-promotion-form"

interface CreatePromotionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function CreatePromotionDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreatePromotionDialogProps) {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [requiredItems, setRequiredItems] = useState<RequiredPromoItemDraft[]>([])
  const [requiredCategories, setRequiredCategories] = useState<
    RequiredPromoCategoryDraft[]
  >([])
  const [merchandising, setMerchandising] =
    useState<PromotionMerchandisingValue>({
      image_url: null,
      show_on_shop: false,
      show_on_marketplace: false,
    })

  const siteTimezone =
    currentSite?.settings?.business_hours?.[0]?.timezone || null

  const { data: campaigns } = useSWR(
    currentSite?.id ? ["campaigns", currentSite.id] : null,
    () => getCampaigns(currentSite!.id)
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: EMPTY_CREATE_PROMOTION_FORM,
  })

  const discountType = watch("discount_type")
  const bogoBuyQty = watch("bogo_buy_qty")
  const bogoGetQty = watch("bogo_get_qty")
  const currency = watch("currency")
  const campaignValue = watch("campaign_value")
  const appliesTo = watch("applies_to")
  const channels = watch("channels")
  const locationIds = watch("location_ids")
  const minOrderAmount = watch("min_order_amount")
  const requiredItemsMode = watch("required_items_mode")
  const startsAt = watch("starts_at")
  const endsAt = watch("ends_at")
  const activeWeekdays = watch("active_weekdays")

  const siteDefaultCurrency = resolvePromotionCurrency(
    null,
    currentSite?.settings?.currency,
  )

  useEffect(() => {
    if (!open) return
    setValue("currency", siteDefaultCurrency)
  }, [open, siteDefaultCurrency, setValue])

  const resetForm = () => {
    reset({
      ...EMPTY_CREATE_PROMOTION_FORM,
      currency: siteDefaultCurrency,
    })
    setSelectedItemIds([])
    setSelectedCategoryIds([])
    setRequiredItems([])
    setRequiredCategories([])
    setMerchandising({
      image_url: null,
      show_on_shop: false,
      show_on_marketplace: false,
    })
  }

  const onSubmit = async (data: FormData) => {
    if (!currentSite || !user) return
    setIsSubmitting(true)

    try {
      const { id: resolvedCampaignId, error: campError } =
        await resolveRelationId("campaign", data.campaign_value, currentSite.id)
      if (campError) throw new Error(`Campaign error: ${campError}`)
      if (!resolvedCampaignId) throw new Error("Campaign is required")

      if (
        data.applies_to === "selected_items" &&
        selectedItemIds.length === 0 &&
        selectedCategoryIds.length === 0
      ) {
        throw new Error("Select at least one product or category")
      }

      const channels = data.channels?.length
        ? data.channels
        : [...DEFAULT_PROMOTION_CHANNELS]
      const location_ids = channels.includes("pos")
        ? data.location_ids || []
        : []

      const isBogo = data.discount_type === "bogo"
      const res = await upsertPromotion({
        site_id: currentSite.id,
        user_id: user.id,
        name: data.name,
        code: data.code || undefined,
        campaign_id: resolvedCampaignId,
        discount_type: data.discount_type,
        discount_value: isBogo ? 0 : parseFloat(data.discount_value),
        bogo_buy_qty: isBogo ? Math.max(1, Math.floor(data.bogo_buy_qty || 1)) : 1,
        bogo_get_qty: isBogo ? Math.max(1, Math.floor(data.bogo_get_qty || 1)) : 1,
        currency: data.currency || siteDefaultCurrency,
        applies_to: data.applies_to,
        channels,
        location_ids,
        min_order_amount: data.min_order_amount,
        required_items_mode: data.required_items_mode,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        active_weekdays: data.active_weekdays || [],
        image_url: merchandising.image_url || null,
        show_on_shop: Boolean(merchandising.show_on_shop),
        show_on_marketplace: Boolean(merchandising.show_on_marketplace),
        status: "draft",
      })

      if (res.error) throw new Error(res.error)
      if (!res.data?.id) throw new Error("Failed to create promotion")

      if (data.applies_to === "selected_items") {
        const itemsRes = await setPromotionItems(
          res.data.id,
          currentSite.id,
          selectedItemIds
        )
        if (itemsRes.error) throw new Error(itemsRes.error)
        const catsRes = await setPromotionCategories(
          res.data.id,
          currentSite.id,
          selectedCategoryIds
        )
        if (catsRes.error) throw new Error(catsRes.error)
      }

      if (requiredItems.length > 0) {
        const reqRes = await setPromotionRequiredItems(
          res.data.id,
          currentSite.id,
          requiredItems.map((i) => ({
            catalog_item_id: i.catalog_item_id,
            min_quantity: i.min_quantity,
          }))
        )
        if (reqRes.error) throw new Error(reqRes.error)
      }

      if (requiredCategories.length > 0) {
        const reqCatsRes = await setPromotionRequiredCategories(
          res.data.id,
          currentSite.id,
          requiredCategories.map((c) => ({
            catalog_category_id: c.catalog_category_id,
            min_quantity: c.min_quantity,
          }))
        )
        if (reqCatsRes.error) throw new Error(reqCatsRes.error)
      }

      toast.success("Promotion created successfully")
      resetForm()
      onSuccess()
      onOpenChange(false)
      router.push(`/promotions/${res.data.id}`)
    } catch (error: any) {
      toast.error(error.message || "Failed to create promotion")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm()
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Promotion</DialogTitle>
          <DialogDescription>
            Add a discount with schedule and consumption conditions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Campaign</Label>
            <RelationSelect
              options={
                campaigns?.data?.map((c) => ({ id: c.id, label: c.title })) || []
              }
              value={campaignValue}
              onValueChange={(v) => setValue("campaign_value", v)}
              placeholder="Select campaign..."
              emptyMessage="No campaigns found"
            />
            {!campaignValue && (
              <p className="text-xs text-red-500">Campaign is required</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g. Summer Sale 20%"
              {...register("name", { required: "Name is required" })}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">Coupon Code (Optional)</Label>
            <Input
              id="code"
              placeholder="e.g. SUMMER20"
              className="uppercase"
              {...register("code")}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <Select
                value={discountType}
                onValueChange={(v: any) => setValue("discount_type", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                  <SelectItem value="bogo">Buy X Get Y</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {discountType !== "bogo" ? (
              <div className="space-y-2">
                <Label htmlFor="discount_value">Value</Label>
                <Input
                  id="discount_value"
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...register("discount_value", {
                    required: "Value is required",
                  })}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Preview</Label>
                <div className="flex h-10 items-center rounded-md border px-3 text-sm text-muted-foreground">
                  {bogoBuyQty === 1 && bogoGetQty === 1
                    ? "2x1 (cheapest unit free)"
                    : `Buy ${bogoBuyQty} Get ${bogoGetQty} (cheapest free)`}
                </div>
              </div>
            )}
          </div>

          <PromotionCurrencyField
            value={currency || siteDefaultCurrency}
            onChange={(val) => setValue("currency", val)}
          />

          {discountType === "bogo" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bogo_buy_qty">Buy quantity</Label>
                <Input
                  id="bogo_buy_qty"
                  type="number"
                  min={1}
                  step={1}
                  value={bogoBuyQty}
                  onChange={(e) =>
                    setValue(
                      "bogo_buy_qty",
                      Math.max(1, parseInt(e.target.value, 10) || 1)
                    )
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bogo_get_qty">Get free</Label>
                <Input
                  id="bogo_get_qty"
                  type="number"
                  min={1}
                  step={1}
                  value={bogoGetQty}
                  onChange={(e) =>
                    setValue(
                      "bogo_get_qty",
                      Math.max(1, parseInt(e.target.value, 10) || 1)
                    )
                  }
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Applies To</Label>
            <Select
              value={appliesTo}
              onValueChange={(v) =>
                setValue("applies_to", v as "all" | "selected_items")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entire Order</SelectItem>
                <SelectItem value="selected_items">
                  Specific products or categories
                </SelectItem>
              </SelectContent>
            </Select>
            {appliesTo === "selected_items" && (
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

          <div className="space-y-3 pt-4 border-t">
            <div>
              <Label>Restrictions</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Turn on only the limits you need
              </p>
            </div>
            <PromotionRestrictionsFields
              siteId={currentSite?.id}
              siteTimezone={siteTimezone}
              idPrefix="create-promo"
              value={{
                starts_at: startsAt,
                ends_at: endsAt,
                active_weekdays: activeWeekdays,
                min_order_amount: minOrderAmount,
                required_items_mode: requiredItemsMode,
              }}
              onChange={(patch) => {
                if ("starts_at" in patch) {
                  setValue("starts_at", patch.starts_at || undefined)
                }
                if ("ends_at" in patch) {
                  setValue("ends_at", patch.ends_at || undefined)
                }
                if ("active_weekdays" in patch) {
                  setValue("active_weekdays", patch.active_weekdays || [])
                }
                if ("min_order_amount" in patch) {
                  setValue(
                    "min_order_amount",
                    patch.min_order_amount ?? undefined
                  )
                }
                if ("required_items_mode" in patch && patch.required_items_mode) {
                  setValue("required_items_mode", patch.required_items_mode)
                }
              }}
              requiredItems={requiredItems}
              onRequiredItemsChange={setRequiredItems}
              requiredCategories={requiredCategories}
              onRequiredCategoriesChange={setRequiredCategories}
            />
          </div>

          <div className="space-y-3 pt-4 border-t">
            <div>
              <Label>Channels</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Optional. Off means all channels and locations.
              </p>
            </div>
            <PromotionChannelsFields
              siteId={currentSite?.id}
              channels={channels}
              locationIds={locationIds}
              idPrefix="create-promo-channel"
              onChange={({ channels: nextChannels, location_ids }) => {
                setValue("channels", nextChannels)
                setValue("location_ids", location_ids)
              }}
            />
          </div>

          <div className="space-y-3 pt-4 border-t">
            <div>
              <Label>Merchandising</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Optional image and storefront placement
              </p>
            </div>
            <PromotionMerchandisingFields
              value={merchandising}
              onChange={(patch) =>
                setMerchandising((prev) => ({ ...prev, ...patch }))
              }
              name={watch("name")}
              discount_type={discountType}
              discount_value={
                discountType === "bogo"
                  ? 0
                  : parseFloat(watch("discount_value") || "0")
              }
              bogo_buy_qty={bogoBuyQty}
              bogo_get_qty={bogoGetQty}
              siteName={currentSite?.name}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
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
