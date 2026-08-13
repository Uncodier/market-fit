"use client"

import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { RelationSelect } from "@/app/components/ui/relation-select"
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
import type { CreatePromotionFormData as FormData } from "./create-promotion-form"

type CampaignOption = { id: string; title: string }

export function CreatePromotionFields({
  campaigns,
  currentSite,
  siteTimezone,
  siteDefaultCurrency,
  register,
  setValue,
  watch,
  errors,
  selectedItemIds,
  selectedCategoryIds,
  onItemsChange,
  onCategoriesChange,
  requiredItems,
  onRequiredItemsChange,
  requiredCategories,
  onRequiredCategoriesChange,
  merchandising,
  onMerchandisingChange,
}: {
  campaigns: CampaignOption[]
  currentSite: { id: string; name?: string } | null
  siteTimezone: string | null
  siteDefaultCurrency: string
  register: UseFormRegister<FormData>
  setValue: UseFormSetValue<FormData>
  watch: UseFormWatch<FormData>
  errors: FieldErrors<FormData>
  selectedItemIds: string[]
  selectedCategoryIds: string[]
  onItemsChange: (ids: string[]) => void
  onCategoriesChange: (ids: string[]) => void
  requiredItems: RequiredPromoItemDraft[]
  onRequiredItemsChange: (items: RequiredPromoItemDraft[]) => void
  requiredCategories: RequiredPromoCategoryDraft[]
  onRequiredCategoriesChange: (cats: RequiredPromoCategoryDraft[]) => void
  merchandising: PromotionMerchandisingValue
  onMerchandisingChange: (patch: Partial<PromotionMerchandisingValue>) => void
}) {
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

  return (
    <>
      <div className="space-y-2">
        <Label>Campaign</Label>
        <RelationSelect
          options={campaigns.map((c) => ({ id: c.id, label: c.title }))}
          value={campaignValue}
          onValueChange={(v) =>
            setValue("campaign_value", v, { shouldDirty: true })
          }
          placeholder="Select campaign..."
          emptyMessage="No campaigns found"
        />
        {!campaignValue && (
          <p className="text-xs text-destructive">Campaign is required</p>
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
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Coupon code (optional)</Label>
        <Input
          id="code"
          placeholder="e.g. SUMMER20"
          className="uppercase"
          {...register("code")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Discount type</Label>
          <Select
            value={discountType}
            onValueChange={(v: FormData["discount_type"]) =>
              setValue("discount_type", v, { shouldDirty: true })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Percentage (%)</SelectItem>
              <SelectItem value="fixed">Fixed amount</SelectItem>
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
              {...register("discount_value", { required: "Value is required" })}
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
        onChange={(val) => setValue("currency", val, { shouldDirty: true })}
      />

      {discountType === "bogo" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  Math.max(1, parseInt(e.target.value, 10) || 1),
                  { shouldDirty: true }
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
                  Math.max(1, parseInt(e.target.value, 10) || 1),
                  { shouldDirty: true }
                )
              }
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Applies to</Label>
        <Select
          value={appliesTo}
          onValueChange={(v) =>
            setValue("applies_to", v as "all" | "selected_items", {
              shouldDirty: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Entire order</SelectItem>
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
              onItemsChange={onItemsChange}
              onCategoriesChange={onCategoriesChange}
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
              setValue("starts_at", patch.starts_at || undefined, {
                shouldDirty: true,
              })
            }
            if ("ends_at" in patch) {
              setValue("ends_at", patch.ends_at || undefined, {
                shouldDirty: true,
              })
            }
            if ("active_weekdays" in patch) {
              setValue("active_weekdays", patch.active_weekdays || [], {
                shouldDirty: true,
              })
            }
            if ("min_order_amount" in patch) {
              setValue(
                "min_order_amount",
                patch.min_order_amount ?? undefined,
                { shouldDirty: true }
              )
            }
            if ("required_items_mode" in patch && patch.required_items_mode) {
              setValue("required_items_mode", patch.required_items_mode, {
                shouldDirty: true,
              })
            }
          }}
          requiredItems={requiredItems}
          onRequiredItemsChange={onRequiredItemsChange}
          requiredCategories={requiredCategories}
          onRequiredCategoriesChange={onRequiredCategoriesChange}
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
            setValue("channels", nextChannels, { shouldDirty: true })
            setValue("location_ids", location_ids, { shouldDirty: true })
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
          onChange={onMerchandisingChange}
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
    </>
  )
}
