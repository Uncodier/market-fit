"use client"

import { createCampaign } from "@/app/campaigns/actions/campaigns/create"
import { useEffect, type ComponentProps } from "react"
import { CreateCampaignDialog } from "@/app/components/create-campaign-dialog"

export function TopBarCampaignAction(props: Omit<ComponentProps<typeof CreateCampaignDialog>, 'onCreateCampaign'>) {
  const { onOpenChange } = props
  useEffect(() => {
    // The Campaigns empty state requests the same permission-checked dialog.
    const open = () => onOpenChange(true)
    window.addEventListener('campaigns:create', open)
    return () => window.removeEventListener('campaigns:create', open)
  }, [onOpenChange])

  return <CreateCampaignDialog {...props} onCreateCampaign={createCampaign} />
}