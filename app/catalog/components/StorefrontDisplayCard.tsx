"use client"

import type { Dispatch, SetStateAction } from "react"
import type { CatalogItem } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import { ActionFooter } from "@/app/components/ui/card-footer"

interface StorefrontDisplayCardProps {
  formData: Partial<CatalogItem>
  setFormData: Dispatch<SetStateAction<Partial<CatalogItem>>>
  handleSave: () => void
  saving: boolean
}

export function shouldShowStorefrontDisplayCard(formData: Partial<CatalogItem>) {
  return formData.availability_mode === "inventory" || formData.is_reservation === true
}

export function StorefrontDisplayCard({
  formData,
  setFormData,
  handleSave,
  saving,
}: StorefrontDisplayCardProps) {
  if (!shouldShowStorefrontDisplayCard(formData)) return null

  const metadata = formData.metadata || {}

  return (
    <SectionCard>
      <SectionCardHeader>
        <SectionCardTitle>Storefront display</SectionCardTitle>
        <SectionCardDescription>
          Merchandising options for shop and marketplace cards.
        </SectionCardDescription>
      </SectionCardHeader>
      <SectionCardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="show_available_inventory" className="text-base cursor-pointer">
              Show available inventory
            </Label>
            <p className="text-sm text-muted-foreground">
              Display remaining units or seats on shop and marketplace
            </p>
          </div>
          <Switch
            id="show_available_inventory"
            checked={metadata.show_available_inventory || false}
            onCheckedChange={(checked) =>
              setFormData({
                ...formData,
                metadata: { ...metadata, show_available_inventory: checked as boolean },
              })
            }
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            <Label htmlFor="show_buyers" className="text-base cursor-pointer">
              Show buyers
            </Label>
            <p className="text-sm text-muted-foreground">
              Display buyer avatars on shop and marketplace
            </p>
          </div>
          <Switch
            id="show_buyers"
            checked={metadata.show_buyers || false}
            onCheckedChange={(checked) =>
              setFormData({
                ...formData,
                metadata: { ...metadata, show_buyers: checked as boolean },
              })
            }
          />
        </div>
      </SectionCardContent>
      <ActionFooter>
        <Button variant="outline" onClick={handleSave} disabled={saving} size="sm">
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </ActionFooter>
    </SectionCard>
  )
}
