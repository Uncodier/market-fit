"use client"

import type { Dispatch, SetStateAction } from "react"
import { CatalogItem } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { ProductPaymentOptionsCard } from "./ProductPaymentOptionsCard"
import { ItemSpecsEditor } from "./ItemSpecsEditor"

interface MarketplaceTabProps {
  item: CatalogItem | null
  formData: Partial<CatalogItem>
  setFormData: Dispatch<SetStateAction<Partial<CatalogItem>>>
  handleSave: () => void
  saving: boolean
}

export function MarketplaceTab({
  item,
  formData,
  setFormData,
  handleSave,
  saving,
}: MarketplaceTabProps) {
  return (
    <div className="mx-auto max-w-[800px] space-y-6">
      {item && (
        <ProductPaymentOptionsCard
          formData={formData}
          setFormData={setFormData}
          handleSave={handleSave}
          saving={saving}
        />
      )}

      {item && (
        <ItemSpecsEditor
          catalogItemId={item.id}
          item={item}
          handleSave={handleSave}
          saving={saving}
        />
      )}

      <SectionCard>
        <SectionCardHeader>
          <SectionCardTitle>Marketplace Listing</SectionCardTitle>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="is_marketplace_listed" className="text-base cursor-pointer">List in Marketplace</Label>
              <p className="text-sm text-muted-foreground">Make visible on the public marketplace</p>
            </div>
            <Switch
              id="is_marketplace_listed"
              checked={formData.is_marketplace_listed ?? true}
              onCheckedChange={(checked) => setFormData({...formData, is_marketplace_listed: checked as boolean})}
            />
          </div>
        </SectionCardContent>
        <ActionFooter>
          <Button variant="outline" onClick={handleSave} disabled={saving} size="sm">Save Listing</Button>
        </ActionFooter>
      </SectionCard>
    </div>
  )
}
