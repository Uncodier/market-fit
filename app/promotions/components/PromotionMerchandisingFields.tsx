"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { ImageUpload } from "@/app/components/ui/image-upload"
import { generatePromotionImage } from "../generate-promotion-image"
import { toast } from "sonner"
import { Loader2, Sparkles } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export type PromotionMerchandisingValue = {
  image_url?: string | null
  show_on_shop?: boolean
  show_on_marketplace?: boolean
}

type Props = {
  value: PromotionMerchandisingValue
  onChange: (patch: Partial<PromotionMerchandisingValue>) => void
  name: string
  discount_type: string
  discount_value?: number | null
  bogo_buy_qty?: number | null
  bogo_get_qty?: number | null
  siteName?: string | null
}

export function PromotionMerchandisingFields({
  value,
  onChange,
  name,
  discount_type,
  discount_value,
  bogo_buy_qty,
  bogo_get_qty,
  siteName,
}: Props) {
  const { t } = useLocalization()
  const [generating, setGenerating] = useState(false)

  const ensureImage = async (): Promise<string | null> => {
    if (value.image_url) return value.image_url
    setGenerating(true)
    try {
      const res = await generatePromotionImage({
        name: name || "Promotion",
        discount_type,
        discount_value,
        bogo_buy_qty,
        bogo_get_qty,
        siteName,
      })
      if ("error" in res) {
        toast.error(res.error)
        return null
      }
      return res.imageUrl
    } finally {
      setGenerating(false)
    }
  }

  const handleShowToggle = async (
    key: "show_on_shop" | "show_on_marketplace",
    checked: boolean,
  ) => {
    if (checked && !value.image_url) {
      const imageUrl = await ensureImage()
      if (!imageUrl) {
        toast.message(
          t("promotions.merchandising.needImage") ||
            "Add or generate an image to show this promotion",
        )
        return
      }
      // Single patch so image_url is not dropped by a follow-up toggle update
      onChange({ image_url: imageUrl, [key]: checked })
      return
    }
    onChange({ [key]: checked })
  }

  const handleGenerate = async () => {
    const imageUrl = await ensureImage()
    if (imageUrl) {
      toast.success(
        t("promotions.merchandising.imageReady") || "Promotion image ready",
      )
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>
            {t("promotions.merchandising.image") || "Merchandising image"}
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={generating || !name?.trim()}
            onClick={() => void handleGenerate()}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1.5" />
            )}
            {t("promotions.merchandising.generateAi") || "Generate with AI"}
          </Button>
        </div>
        <ImageUpload
          value={value.image_url || ""}
          onChange={(url) => onChange({ image_url: url })}
          onRemove={() =>
            onChange({
              image_url: null,
              show_on_shop: false,
              show_on_marketplace: false,
            })
          }
        />
        <p className="text-xs text-muted-foreground">
          {t("promotions.merchandising.imageHint") ||
            "Used for shop carousel, category cards, and marketplace Discounts."}
        </p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label htmlFor="show_on_shop">
            {t("promotions.merchandising.showShop") || "Show on Shop"}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("promotions.merchandising.showShopHint") ||
              "Carousel, category cards, or product flags in your shop."}
          </p>
        </div>
        <Switch
          id="show_on_shop"
          checked={Boolean(value.show_on_shop)}
          onCheckedChange={(checked) =>
            void handleShowToggle("show_on_shop", checked)
          }
          disabled={generating}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label htmlFor="show_on_marketplace">
            {t("promotions.merchandising.showMarketplace") ||
              "Show on Marketplace"}
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("promotions.merchandising.showMarketplaceHint") ||
              "Discounts category feed and product flags in marketplace."}
          </p>
        </div>
        <Switch
          id="show_on_marketplace"
          checked={Boolean(value.show_on_marketplace)}
          onCheckedChange={(checked) =>
            void handleShowToggle("show_on_marketplace", checked)
          }
          disabled={generating}
        />
      </div>
    </div>
  )
}
