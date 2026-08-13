"use client"

import type { Dispatch, SetStateAction } from "react"
import { CatalogItem } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { COMMON_CURRENCIES } from "@/app/lib/currencies"
import { DynamicPricingCard } from "./DynamicPricingCard"
import { useLocalization } from "@/app/context/LocalizationContext"

interface CatalogItemPricingSectionProps {
  item: CatalogItem | null
  formData: Partial<CatalogItem>
  setFormData: Dispatch<SetStateAction<Partial<CatalogItem>>>
  handleSave: () => void
  saving: boolean
}

export function CatalogItemPricingSection({
  item,
  formData,
  setFormData,
  handleSave,
  saving,
}: CatalogItemPricingSectionProps) {
  const { t } = useLocalization()
  const isDynamic = Boolean(formData.is_dynamic_price)

  return (
    <>
      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle>{t('catalog.pricing.title') || 'Pricing'}</SectionCardTitle>
          <SectionCardDescription>
            {isDynamic
              ? (t('catalog.pricing.descDynamic') || "Sale price is determined by dynamic quote configuration below")
              : (t('catalog.pricing.descFixed') || "Default pricing (can be overridden by Price Lists)")}
          </SectionCardDescription>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {!isDynamic && (
              <div className="space-y-2">
                <Label>{t('catalog.pricing.salePrice') || 'Sale Price'}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.target_sale_price || ''}
                  onChange={e => setFormData({...formData, target_sale_price: parseFloat(e.target.value) || undefined})}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>{t('catalog.pricing.cost') || 'Cost'}</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.cost || ''}
                onChange={e => setFormData({...formData, cost: parseFloat(e.target.value) || undefined})}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>{t('catalog.pricing.currency') || 'Currency'}</Label>
              <Select
                value={formData.currency || 'USD'}
                onValueChange={(val) => setFormData({...formData, currency: val})}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMMON_CURRENCIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCardContent>
        <ActionFooter>
          <Button variant="outline" onClick={handleSave} disabled={saving} size="sm">{saving ? (t('common.saving') || "Saving...") : (t('common.savePricing') || "Save Pricing")}</Button>
        </ActionFooter>
      </SectionCard>

      <DynamicPricingCard
        item={item}
        formData={formData}
        onChange={setFormData}
        onSave={handleSave}
        saving={saving}
      />
    </>
  )
}
