"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { useLocalization } from "@/app/context/LocalizationContext"
import { PromotionWithCampaign } from "../types"
import {
  PromotionRestrictionsFields,
  type RequiredPromoItemDraft,
  type RequiredPromoCategoryDraft,
} from "./PromotionRestrictionsFields"

interface PromotionRestrictionsCardProps {
  siteId: string
  promo: PromotionWithCampaign
  onChange: (patch: Partial<PromotionWithCampaign>) => void
  onSave: () => void
  saving: boolean
  siteTimezone: string | null
  requiredItems: RequiredPromoItemDraft[]
  onRequiredItemsChange: (items: RequiredPromoItemDraft[]) => void
  requiredCategories: RequiredPromoCategoryDraft[]
  onRequiredCategoriesChange: (categories: RequiredPromoCategoryDraft[]) => void
}

export function PromotionRestrictionsCard({
  siteId,
  promo,
  onChange,
  onSave,
  saving,
  siteTimezone,
  requiredItems,
  onRequiredItemsChange,
  requiredCategories,
  onRequiredCategoriesChange,
}: PromotionRestrictionsCardProps) {
  const { t } = useLocalization()

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("promotions.detail.restrictions.title") || "Restrictions"}
        </CardTitle>
        <CardDescription>
          {t("promotions.detail.restrictions.description") ||
            "Turn on only the limits you need. Off means no restriction."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PromotionRestrictionsFields
          siteId={siteId}
          siteTimezone={siteTimezone}
          idPrefix={`promo-${promo.id}`}
          value={{
            starts_at: promo.starts_at,
            ends_at: promo.ends_at,
            active_weekdays: promo.active_weekdays,
            min_order_amount: promo.min_order_amount,
            required_items_mode: promo.required_items_mode,
          }}
          onChange={(patch) => onChange(patch)}
          requiredItems={requiredItems}
          onRequiredItemsChange={onRequiredItemsChange}
          requiredCategories={requiredCategories}
          onRequiredCategoriesChange={onRequiredCategoriesChange}
        />
      </CardContent>
      <ActionFooter>
        <Button type="button" variant="outline" onClick={onSave} disabled={saving}>
          {saving
            ? t("promotions.detail.saving") || "Saving..."
            : t("promotions.detail.restrictions.save") || "Save Restrictions"}
        </Button>
      </ActionFooter>
    </Card>
  )
}
