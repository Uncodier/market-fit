"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Checkbox } from "@/app/components/ui/checkbox"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { upsertPriceList } from "../actions"
import type { PriceList, PriceListChannel } from "@/app/types"
import {
  DEFAULT_PRICE_LIST_CHANNELS,
  PRICE_LIST_CHANNELS,
  normalizePriceListChannels,
} from "../price-list-channels"

interface PriceListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  /** When set, dialog edits this list instead of creating a new one. */
  list?: PriceList | null
}

type FormData = {
  name: string
  code: string
  currency: string
  is_default: boolean
  is_active: boolean
}

const CHANNEL_OPTIONS: {
  id: PriceListChannel
  labelKey: string
  labelFallback: string
  descriptionKey: string
  descriptionFallback: string
}[] = [
  {
    id: "pos",
    labelKey: "priceLists.channels.pos",
    labelFallback: "POS",
    descriptionKey: "priceLists.channels.posDesc",
    descriptionFallback: "Point of Sale registers and locations",
  },
  {
    id: "shop",
    labelKey: "priceLists.channels.shop",
    labelFallback: "Shop",
    descriptionKey: "priceLists.channels.shopDesc",
    descriptionFallback: "Online storefront for this site",
  },
  {
    id: "marketplace",
    labelKey: "priceLists.channels.marketplace",
    labelFallback: "Marketplace",
    descriptionKey: "priceLists.channels.marketplaceDesc",
    descriptionFallback: "Public marketplace listings and checkout",
  },
]

export function PriceListDialog({
  open,
  onOpenChange,
  onSuccess,
  list = null,
}: PriceListDialogProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [channels, setChannels] = useState<PriceListChannel[]>([
    ...DEFAULT_PRICE_LIST_CHANNELS,
  ])
  const isEdit = Boolean(list?.id)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      code: "",
      currency: "USD",
      is_default: false,
      is_active: true,
    },
  })

  useEffect(() => {
    if (!open) return
    if (list) {
      reset({
        name: list.name || "",
        code: list.code || "",
        currency: list.currency || "USD",
        is_default: Boolean(list.is_default),
        is_active: list.is_active !== false,
      })
      setChannels(normalizePriceListChannels(list.channels))
    } else {
      reset({
        name: "",
        code: "",
        currency: "USD",
        is_default: false,
        is_active: true,
      })
      setChannels([...DEFAULT_PRICE_LIST_CHANNELS])
    }
  }, [open, list, reset])

  const isDefault = watch("is_default")
  const isActive = watch("is_active")

  const toggleChannel = (channel: PriceListChannel, enabled: boolean) => {
    setChannels((prev) => {
      let next = enabled
        ? Array.from(new Set([...prev, channel]))
        : prev.filter((c) => c !== channel)
      if (next.length === 0) next = [channel]
      return next.filter((c): c is PriceListChannel =>
        (PRICE_LIST_CHANNELS as readonly string[]).includes(c)
      )
    })
  }

  const onSubmit = async (data: FormData) => {
    if (!currentSite) return
    setIsSubmitting(true)

    try {
      const res = await upsertPriceList({
        ...(list?.id ? { id: list.id } : {}),
        site_id: currentSite.id,
        name: data.name,
        code: data.code || undefined,
        currency: data.currency,
        is_default: data.is_default,
        is_active: data.is_active,
        channels: normalizePriceListChannels(channels),
      })

      if (res.error) throw new Error(res.error)

      toast.success(
        isEdit
          ? t("priceLists.toast.updated") || "Price list updated"
          : t("priceLists.toast.created") || "Price list created successfully"
      )
      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(
        error.message ||
          (isEdit
            ? t("priceLists.toast.updateFailed") || "Failed to update list"
            : t("priceLists.toast.createFailed") || "Failed to create list")
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? t("priceLists.editTitle") || "Edit Price List"
              : t("priceLists.createTitle") || "Create Price List"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("priceLists.editDescription") ||
                "Update this pricing tier and where it applies."
              : t("priceLists.createDescription") ||
                "Add a new pricing tier for your catalog items."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="price-list-name">
              {t("priceLists.name") || "Name"}
            </Label>
            <Input
              id="price-list-name"
              placeholder="e.g. Wholesale, VIP, Retail"
              {...register("name", { required: "Name is required" })}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price-list-code">
                {t("priceLists.codeOptional") || "Code (Optional)"}
              </Label>
              <Input
                id="price-list-code"
                placeholder="WHOLESALE"
                {...register("code")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price-list-currency">
                {t("priceLists.currency") || "Currency"}
              </Label>
              <Input
                id="price-list-currency"
                placeholder="USD"
                {...register("currency", { required: "Currency is required" })}
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div>
              <Label className="text-sm">
                {t("priceLists.channels.title") || "Apply on"}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("priceLists.channels.description") ||
                  "Choose where this price list can override catalog prices."}
              </p>
            </div>
            <div className="space-y-2">
              {CHANNEL_OPTIONS.map((option) => {
                const fieldId = `price-list-channel-${option.id}`
                const checked = channels.includes(option.id)
                return (
                  <div key={option.id} className="flex items-start space-x-2 py-1">
                    <Checkbox
                      id={fieldId}
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleChannel(option.id, !!value)
                      }
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <label
                        htmlFor={fieldId}
                        className="text-sm cursor-pointer font-medium"
                      >
                        {t(option.labelKey) || option.labelFallback}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {t(option.descriptionKey) || option.descriptionFallback}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="price-list-is-default"
                checked={isDefault}
                onCheckedChange={(checked) =>
                  setValue("is_default", checked as boolean)
                }
              />
              <Label htmlFor="price-list-is-default">
                {t("priceLists.setDefault") || "Set as default price list"}
              </Label>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="price-list-is-active"
                checked={isActive}
                onCheckedChange={(checked) =>
                  setValue("is_active", checked as boolean)
                }
              />
              <Label htmlFor="price-list-is-active">
                {t("priceLists.active") || "Active"}
              </Label>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? isEdit
                  ? t("common.saving") || "Saving..."
                  : t("priceLists.creating") || "Creating..."
                : isEdit
                  ? t("common.save") || "Save"
                  : t("priceLists.addList") || "Create List"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
