"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import {
  setPromotionCategories,
  setPromotionItems,
  setPromotionRequiredItems,
  setPromotionRequiredCategories,
  upsertPromotion,
} from "../actions"
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
import {
  PromotionRestrictionsFields,
  type RequiredPromoItemDraft,
  type RequiredPromoCategoryDraft,
} from "./PromotionRestrictionsFields"
import {
  PromotionMerchandisingFields,
  type PromotionMerchandisingValue,
} from "./PromotionMerchandisingFields"
import {
  EMPTY_CREATE_PROMOTION_FORM,
  type CreatePromotionFormData as FormData,
} from "./create-promotion-form"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { useDirtyDialogClose } from "@/app/components/ui/use-dirty-dialog-close"
import { CreatePromotionFields } from "./create-promotion-fields"

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
    formState: { errors, isDirty },
  } = useForm<FormData>({
    defaultValues: EMPTY_CREATE_PROMOTION_FORM,
  })

  const siteDefaultCurrency = resolvePromotionCurrency(
    null,
    currentSite?.settings?.currency
  )

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

  const extraDirty =
    selectedItemIds.length > 0 ||
    selectedCategoryIds.length > 0 ||
    requiredItems.length > 0 ||
    requiredCategories.length > 0 ||
    Boolean(merchandising.image_url) ||
    merchandising.show_on_shop ||
    merchandising.show_on_marketplace

  const { discardOpen, setDiscardOpen, handleOpenChange, confirmDiscard } =
    useDirtyDialogClose({
      dirty: isDirty || extraDirty,
      busy: isSubmitting,
      onOpenChange: (next) => {
        if (!next) resetForm()
        onOpenChange(next)
      },
    })

  useEffect(() => {
    if (!open) return
    setValue("currency", siteDefaultCurrency)
  }, [open, siteDefaultCurrency, setValue])

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

  const campaignValue = watch("campaign_value")

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg" busy={isSubmitting}>
        <DialogHeader>
          <DialogTitle>Create promotion</DialogTitle>
          <DialogDescription>
            Add a discount with schedule and consumption conditions.
          </DialogDescription>
        </DialogHeader>

        <DialogForm onSubmit={handleSubmit(onSubmit)}>
          <DialogBody className="space-y-6">
            <CreatePromotionFields
              campaigns={campaigns?.data || []}
              currentSite={currentSite}
              siteTimezone={siteTimezone}
              siteDefaultCurrency={siteDefaultCurrency}
              register={register}
              setValue={setValue}
              watch={watch}
              errors={errors}
              selectedItemIds={selectedItemIds}
              selectedCategoryIds={selectedCategoryIds}
              onItemsChange={setSelectedItemIds}
              onCategoriesChange={setSelectedCategoryIds}
              requiredItems={requiredItems}
              onRequiredItemsChange={setRequiredItems}
              requiredCategories={requiredCategories}
              onRequiredCategoriesChange={setRequiredCategories}
              merchandising={merchandising}
              onMerchandisingChange={(patch) =>
                setMerchandising((prev) => ({ ...prev, ...patch }))
              }
            />
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !campaignValue}>
              {isSubmitting ? "Creating..." : "Create promotion"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard changes?"
        description="Your changes will be lost."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={confirmDiscard}
        dataPermission="allow"
      />
    </Dialog>
  )
}
