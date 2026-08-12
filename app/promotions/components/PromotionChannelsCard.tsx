"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
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
  const { t } = useLocalization()

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {t("promotions.detail.channels.title") || "Channels"}
        </CardTitle>
        <CardDescription>
          {t("promotions.detail.channels.description") ||
            "Turn on only if you need to limit where this promotion can be redeemed. Off means all channels and locations."}
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
          {saving
            ? t("promotions.detail.saving") || "Saving..."
            : t("promotions.detail.saveChanges") || "Save Changes"}
        </Button>
      </ActionFooter>
    </Card>
  )
}
