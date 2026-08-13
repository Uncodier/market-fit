"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { toast } from "sonner"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { ClipboardList, ExternalLink, User } from "@/app/components/ui/icons"
import { Campaign } from "@/app/types"
import { CampaignRequirementDialog, CampaignRequirementFormValues } from "@/app/components/create-requirement-dialog-for-campaign"
import { AddCampaignLeadDialog } from "@/app/components/add-campaign-lead-dialog"
import { campaignPriorityLabel, campaignTypeLabel, formatCampaignBudget } from "./campaign-format"

export function CampaignIdentityHeader({
  campaign,
  siteSegments,
  onUpdate,
  onCreateRequirement,
  onReloadLeads,
}: {
  campaign: Campaign
  siteSegments: Array<{ id: string; name: string }>
  onUpdate: (data: Record<string, unknown>) => Promise<void>
  onCreateRequirement: (values: CampaignRequirementFormValues) => Promise<{ data?: unknown; error?: string }>
  onReloadLeads: () => void
}) {
  const router = useRouter()
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(campaign.title)

  const budgetLabel = formatCampaignBudget(campaign.budget?.allocated, campaign.budget?.currency) || "No budget"
  const subtitle = [campaignTypeLabel(campaign.type), budgetLabel].join(" · ")
  const dueLabel = campaign.dueDate
    ? `Due ${new Date(campaign.dueDate).toLocaleDateString()}`
    : "No due date"
  const priorityLabel = `Priority ${campaignPriorityLabel(campaign.priority)}`
  const outsourced = Boolean(campaign.metadata?.payment_status?.outsourced)
  const canSendToAgents = Boolean(campaign.budget?.allocated && campaign.budget.allocated > 0) && !outsourced

  const saveTitle = async () => {
    const next = titleDraft.trim()
    if (!next || next === campaign.title) {
      setEditingTitle(false)
      setTitleDraft(campaign.title)
      return
    }
    try {
      await onUpdate({ title: next })
      setEditingTitle(false)
    } catch {
      toast.error("Failed to update title")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <EntityAvatar name={campaign.title} className="h-11 w-11 text-sm" />
          <div className="min-w-0">
            {editingTitle ? (
              <Input
                autoFocus
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => void saveTitle()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void saveTitle()
                  if (event.key === "Escape") {
                    setTitleDraft(campaign.title)
                    setEditingTitle(false)
                  }
                }}
                className="h-8 text-xl font-semibold max-w-sm"
              />
            ) : (
              <h1
                className="text-xl font-semibold leading-tight truncate cursor-text rounded-md px-1 -mx-1 hover:bg-muted/50"
                onClick={() => {
                  setTitleDraft(campaign.title)
                  setEditingTitle(true)
                }}
                title={campaign.title}
              >
                {campaign.title}
              </h1>
            )}
            <p className="text-sm text-muted-foreground truncate mt-0.5">{subtitle}</p>
            <p className="text-xs text-muted-foreground/80 truncate mt-1">
              {dueLabel} · {priorityLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
          <AddCampaignLeadDialog
            campaignId={campaign.id}
            segments={siteSegments}
            onLeadCreated={onReloadLeads}
            trigger={
              <Button variant="ghost" size="sm" className="h-8">
                <User className="h-3.5 w-3.5 mr-1.5" />
                Add Lead
              </Button>
            }
          />
          <CampaignRequirementDialog
            campaignId={campaign.id}
            onCreateRequirement={onCreateRequirement}
            trigger={
              <Button variant="ghost" size="sm" className="h-8">
                <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                Add Requirement
              </Button>
            }
          />
          {canSendToAgents && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => router.push(`/outsource/checkout?campaignId=${campaign.id}`)}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Send to Agents
            </Button>
          )}
          {outsourced && (
            <span className="text-xs text-muted-foreground px-2">
              Outsourced
              {campaign.metadata?.payment_status?.outsource_provider
                ? ` · ${campaign.metadata.payment_status.outsource_provider}`
                : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
