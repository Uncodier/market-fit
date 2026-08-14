"use client"

import { Button } from "@/app/components/ui/button"
import { PlusCircle, User } from "@/app/components/ui/icons"
import { CampaignRequirementFormValues } from "@/app/components/create-requirement-dialog-for-campaign"
import { Lead } from "@/app/leads/types"
import { CampaignRequirementDialog } from "@/app/components/create-requirement-dialog-for-campaign"
import { CampaignRequirements } from "@/app/components/campaign-requirements"
import { AddCampaignLeadDialog } from "@/app/components/add-campaign-lead-dialog"
import { CampaignLeadsTables } from "./campaign-leads-tables"

export interface CampaignSummaryProps {
  campaign: { id: string }
  loadingLeads: boolean
  campaignLeads: Lead[]
  leadSalesTotals?: Record<string, number>
  onCreateRequirement: (values: CampaignRequirementFormValues) => Promise<{ data?: unknown; error?: string }>
  segments: Array<{ id: string; name: string }>
  onReloadLeads?: () => void
  campaignRequirements?: unknown[]
  loadingRequirements?: boolean
}

export function CampaignSummary({
  campaign,
  loadingLeads,
  campaignLeads,
  leadSalesTotals,
  onCreateRequirement,
  segments,
  onReloadLeads,
  campaignRequirements = [],
  loadingRequirements = false,
}: CampaignSummaryProps) {
  return (
    <div className="space-y-8">
      <CampaignRequirements
        campaignId={campaign.id}
        externalRequirements={campaignRequirements as any}
        externalLoading={loadingRequirements}
        renderAddButton={() => (
          <CampaignRequirementDialog
            campaignId={campaign.id}
            onCreateRequirement={onCreateRequirement}
            trigger={
              <Button variant="ghost" size="sm" className="h-8">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Requirement
              </Button>
            }
          />
        )}
      />

        <CampaignLeadsTables
        campaignLeads={campaignLeads}
        leadSalesTotals={leadSalesTotals}
        loadingLeads={loadingLeads}
        addLeadButton={
          <AddCampaignLeadDialog
            campaignId={campaign.id}
            segments={segments}
            onLeadCreated={onReloadLeads}
            trigger={
              <Button variant="ghost" size="sm" className="h-8">
                <User className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
            }
          />
        }
      />
    </div>
  )
}
