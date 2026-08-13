"use client"

import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Label } from "@/app/components/ui/label"
import { Input } from "@/app/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { Button } from "@/app/components/ui/button"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { useLocalization } from "@/app/context/LocalizationContext"
import { PromotionWithCampaign } from "../types"
import { PromotionTargetPicker } from "./PromotionTargetPicker"

interface PromotionRulesCardProps {
  siteId: string
  promo: PromotionWithCampaign
  onChange: (patch: Partial<PromotionWithCampaign>) => void
  onSave: () => void
  saving: boolean
  selectedItemIds: string[]
  selectedCategoryIds: string[]
  onItemsChange: (ids: string[]) => void
  onCategoriesChange: (ids: string[]) => void
}

export function PromotionRulesCard({
  siteId,
  promo,
  onChange,
  onSave,
  saving,
  selectedItemIds,
  selectedCategoryIds,
  onItemsChange,
  onCategoriesChange,
}: PromotionRulesCardProps) {
  const { t } = useLocalization()

  return (
    <SectionCard>
      <SectionCardHeader>
        <SectionCardTitle>
          {t("promotions.detail.rules.title") || "Discount Scope"}
        </SectionCardTitle>
      </SectionCardHeader>
      <SectionCardContent className="space-y-4">
        <div className="space-y-2">
          <Label>
            {t("promotions.detail.rules.appliesTo") || "Applies To"}
          </Label>
          <Select
            value={promo.applies_to}
            onValueChange={(v: any) => onChange({ applies_to: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("promotions.detail.rules.entireOrder") || "Entire Order"}
              </SelectItem>
              <SelectItem value="selected_items">
                {t("promotions.detail.rules.selectedItems") ||
                  "Specific products or categories"}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {promo.applies_to === "selected_items" && (
          <PromotionTargetPicker
            siteId={siteId}
            selectedItemIds={selectedItemIds}
            selectedCategoryIds={selectedCategoryIds}
            onItemsChange={onItemsChange}
            onCategoriesChange={onCategoriesChange}
          />
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-2">
            <Label>
              {t("promotions.detail.rules.globalUsageLimit") ||
                "Global Usage Limit"}
            </Label>
            <Input
              type="number"
              placeholder={
                t("promotions.detail.rules.unlimited") || "Unlimited"
              }
              value={promo.usage_limit || ""}
              onChange={(e) =>
                onChange({
                  usage_limit: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>
              {t("promotions.detail.rules.usageLimitPerUser") ||
                "Usage Limit Per User"}
            </Label>
            <Input
              type="number"
              placeholder={
                t("promotions.detail.rules.unlimited") || "Unlimited"
              }
              value={promo.usage_limit_per_user || ""}
              onChange={(e) =>
                onChange({
                  usage_limit_per_user: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
            />
          </div>
        </div>
      </SectionCardContent>
      <ActionFooter>
        <Button variant="outline" type="button" onClick={onSave} disabled={saving} size="sm">
          {saving
            ? t("promotions.detail.saving") || "Saving..."
            : t("promotions.detail.rules.save") || "Save Rules"}
        </Button>
      </ActionFooter>
    </SectionCard>
  )
}
