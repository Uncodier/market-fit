"use client"

import React from "react"
import { Card } from "@/app/components/ui/card"
import { Skeleton } from "@/app/components/ui/skeleton"
import { KanbanColumn } from "@/app/components/campaigns/kanban-column"
import { Campaign } from "@/app/types"

type RequirementRow = {
  id: string
  title: string
  description?: string | null
  status?: string
  priority?: string
  completion_status?: string
  campaign_requirements?: Array<{ campaign_id: string }>
}

function mapCampaignToKanbanTask(campaign: Campaign, requirements: RequirementRow[]) {
  const campaignRequirements = requirements
    .filter((req) => (req.campaign_requirements || []).some((row) => row.campaign_id === campaign.id))
    .map((req) => ({
      id: req.id,
      title: req.title,
      description: req.description || "",
      status: req.status || "backlog",
      priority: (req.priority || "medium") as "high" | "medium" | "low",
      completion_status: req.completion_status || "pending",
    }))

  const spent =
    campaign.budget?.allocated && campaign.budget?.remaining != null
      ? campaign.budget.allocated - campaign.budget.remaining
      : 0

  return {
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    priority: campaign.priority,
    status: campaign.status || "active",
    dueDate: campaign.dueDate
      ? new Date(campaign.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : undefined,
    assignees: campaign.assignees,
    issues: campaign.issues,
    revenue: campaign.revenue,
    budget: campaign.budget,
    costs: {
      fixed: 0,
      variable: 0,
      total: spent,
      currency: campaign.budget?.currency || "USD",
    },
    requirements: campaignRequirements,
    metadata: campaign.metadata,
  }
}

export function CampaignsKanban({
  campaignsByType,
  requirements,
  searchQuery,
}: {
  campaignsByType: Record<string, Campaign[]>
  requirements: RequirementRow[]
  searchQuery: string
}) {
  return (
    <div className="w-[calc(100%+4rem)] overflow-x-auto overflow-y-visible pb-4 -ml-8">
      <div className="flex gap-6 min-w-full w-max px-8 pb-8 bg-transparent rounded-lg shadow-sm h-full">
        {Object.entries(campaignsByType).map(([type, typeCampaigns]) => (
          <KanbanColumn
            key={type}
            title={type === "publicRelations" ? "Public Relations" : type.charAt(0).toUpperCase() + type.slice(1)}
            tasks={typeCampaigns.map((campaign) => mapCampaignToKanbanTask(campaign, requirements))}
            searchQuery={searchQuery}
          />
        ))}
      </div>
    </div>
  )
}

export function CampaignsKanbanSkeleton() {
  return (
    <div className="p-8 space-y-4 bg-muted/30 flex-1">
      <div className="w-[calc(100%+4rem)] overflow-x-auto overflow-y-visible pb-4 -ml-8">
        <div className="flex gap-6 min-w-full w-max px-8 pb-8 bg-transparent rounded-lg shadow-sm h-full">
          {[1, 2, 3, 4, 5].map((columnIndex) => (
            <div key={columnIndex} className="flex flex-col h-full w-[280px]">
              <div className="bg-background rounded-t-md p-3 border-b border-x border-t">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-6 rounded-full" />
                </div>
              </div>
              <div className="bg-muted/30 rounded-b-md border-b border-x p-2 space-y-3">
                {[1, 2, 3].map((cardIndex) => (
                  <Card key={cardIndex} className="mb-3 p-3 space-y-3">
                    <Skeleton className="h-4 w-[60%]" />
                    <Skeleton className="h-3 w-[90%]" />
                    <Skeleton className="h-8 w-full rounded-md" />
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
