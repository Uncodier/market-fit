"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsContent } from "@/app/components/ui/tabs"
import { ResponsiveTabsList, type TabItem } from "@/app/components/ui/responsive-tabs-list"
import { CampaignSummary } from "@/app/components/campaign-detail/campaign-summary"
import { FinancialDetails } from "@/app/components/campaign-detail/financial-details"
import { CampaignPromotions } from "@/app/components/campaign-detail/campaign-promotions"
import { TaskDetailSkeleton } from "@/app/components/campaign-detail/task-detail-skeleton"
import { CampaignStatusBar } from "@/app/components/campaign-detail/campaign-status-bar"
import { CampaignIdentityHeader } from "@/app/components/campaign-detail/campaign-identity-header"
import { CampaignAboutPanel } from "@/app/components/campaign-detail/campaign-about-panel"
import { useCampaignDetail } from "@/app/components/campaign-detail/use-campaign-detail"
import { CampaignStatus } from "@/app/types"

export default function CampaignDetailPage(props: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(props.params)
  const router = useRouter()
  const id = unwrappedParams.id as string
  const detail = useCampaignDetail(id)
  const [activeTab, setActiveTab] = useState("overview")

  const campaignTabs: TabItem[] = [
    { value: "overview", label: "Overview" },
    { value: "financials", label: "Finances" },
    { value: "promotions", label: "Promotions" },
  ]

  if (detail.loading) {
    return <TaskDetailSkeleton />
  }

  if (!detail.campaign) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Campaign not found</h2>
          <Button onClick={() => router.push("/campaigns")}>Back to Campaigns</Button>
        </div>
      </div>
    )
  }

  const campaign = detail.campaign

  return (
    <div className="flex-1 p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="pt-0 flex-1 w-full min-w-0">
            <div className="flex items-center justify-between w-full gap-4">
              <ResponsiveTabsList 
                tabs={campaignTabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                className="w-auto flex-1 max-w-full"
              />
              <div className="flex items-center overflow-x-auto shrink-0">
                <CampaignStatusBar
                  currentStatus={(campaign.status || "pending") as CampaignStatus}
                  onStatusChange={(status) => void detail.handleStatusChange(status)}
                />
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="px-4 lg:px-8 py-5">
          <CampaignIdentityHeader
            campaign={campaign}
            siteSegments={detail.siteSegments}
            onUpdate={detail.handleUpdateCampaign}
            onCreateRequirement={detail.handleCreateRequirement}
            onReloadLeads={() => detail.reloadLeads()}
          />

          <div className="mt-5 flex flex-col lg:flex-row border-t border-border/50">
            <div className="w-full lg:min-w-0 lg:flex-1 pt-5 lg:pr-8">
              <TabsContent value="overview" className="mt-0 pt-0">
                <CampaignSummary
                  campaign={campaign}
                  loadingLeads={detail.loadingLeads}
                  campaignLeads={detail.campaignLeads}
                  leadSalesTotals={detail.leadSalesTotals}
                  onCreateRequirement={detail.handleCreateRequirement}
                  segments={detail.siteSegments}
                  onReloadLeads={() => detail.reloadLeads()}
                  campaignRequirements={detail.campaignRequirements}
                  loadingRequirements={detail.loadingRequirements}
                />
              </TabsContent>
              <TabsContent value="financials" className="mt-0 pt-0">
                <FinancialDetails campaign={campaign} onUpdateCampaign={detail.handleUpdateCampaign} />
              </TabsContent>
              <TabsContent value="promotions" className="mt-0 pt-0">
                <CampaignPromotions campaignId={id} />
              </TabsContent>
            </div>

            <aside className="w-full lg:w-[340px] xl:w-[380px] shrink-0 pt-5 lg:pl-8 lg:border-l border-border/50">
              <div className="lg:sticky lg:top-[calc(var(--topbar-height,64px)+71px+16px)] lg:max-h-[calc(100vh-var(--topbar-height,64px)-96px)] lg:overflow-y-auto">
                <CampaignAboutPanel
                  campaign={campaign}
                  siteSegments={detail.siteSegments}
                  onUpdate={detail.handleUpdateCampaign}
                />
              </div>
            </aside>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
