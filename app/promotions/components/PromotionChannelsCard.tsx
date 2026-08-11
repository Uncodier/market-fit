"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Button } from "@/app/components/ui/button"
import type { Promotion } from "@/app/types"
import { PromotionChannelsFields } from "./PromotionChannelsFields"

interface PromotionChannelsCardProps {
  siteId: string
  promo: Promotion
  onChange: (patch: Pick<Promotion, "channels" | "location_ids">) => void
  onSave: () => void
  saving: boolean
}

export function PromotionChannelsCard({
  siteId,
  promo,
  onChange,
  onSave,
  saving,
}: PromotionChannelsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Channels</CardTitle>
        <CardDescription>
          Choose where this promotion can be redeemed. Leave POS locations empty to allow all locations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PromotionChannelsFields
          siteId={siteId}
          channels={promo.channels}
          locationIds={promo.location_ids}
          onChange={onChange}
          idPrefix={`promo-${promo.id}-channel`}
        />
      </CardContent>
      <ActionFooter>
        <Button type="button" variant="outline" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </ActionFooter>
    </Card>
  )
}
