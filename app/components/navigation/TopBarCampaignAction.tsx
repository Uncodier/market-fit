"use client"

import { createCampaign } from "@/app/campaigns/actions/campaigns/create"
import { useLocalization } from "@/app/context/LocalizationContext"
import { Button } from "@/app/components/ui/button"
import { PlusCircle } from "@/app/components/ui/icons"
import { CreateCampaignDialog } from "@/app/components/create-campaign-dialog"

export function TopBarCampaignAction({
  segments,
}: {
  segments: Array<{ id: string; name: string; description: string }>
}) {
  const { t } = useLocalization()

  return (
    <CreateCampaignDialog
      segments={segments}
      onCreateCampaign={createCampaign}
      trigger={
        <Button
          className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          title={t("layout.topbar.newCampaign")}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">{t("layout.topbar.newCampaign")}</span>
        </Button>
      }
    />
  )
}