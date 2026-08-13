"use client"

import { format } from "date-fns"
import { Input } from "@/app/components/ui/input"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { Calendar, DollarSign, FileText, Tag } from "@/app/components/ui/icons"
import { Campaign, CampaignPriority, CampaignType } from "@/app/types"
import { PropertyRow, hasPropertyValue } from "@/app/leads/components/PropertyRow"
import { CampaignAudienceList } from "./campaign-audience-list"
import {
  CAMPAIGN_PRIORITY_LABELS,
  CAMPAIGN_TYPE_LABELS,
  campaignPriorityLabel,
  campaignTypeLabel,
  formatCampaignBudget,
} from "./campaign-format"

const CURRENCIES = ["USD", "EUR", "GBP", "MXN", "CAD", "BRL"]
const TYPES = Object.keys(CAMPAIGN_TYPE_LABELS) as CampaignType[]
const PRIORITIES = Object.keys(CAMPAIGN_PRIORITY_LABELS) as CampaignPriority[]

export function CampaignAboutPanel({
  campaign,
  siteSegments,
  onUpdate,
}: {
  campaign: Campaign
  siteSegments: Array<{ id: string; name: string; description?: string | null }>
  onUpdate: (data: Record<string, unknown>) => Promise<void>
}) {
  const dueDate = campaign.dueDate ? new Date(campaign.dueDate).toISOString().split("T")[0] : ""
  const createdLabel = campaign.createdAt ? new Date(campaign.createdAt).toLocaleDateString() : ""
  const updatedLabel = campaign.updatedAt ? new Date(campaign.updatedAt).toLocaleDateString() : null

  return (
    <div className="w-full min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
        About
      </p>
      <Tabs defaultValue="info" className="w-full min-w-0">
        <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full w-full justify-start overflow-x-auto mb-3">
          <TabsTrigger value="info" className="h-7 px-3 rounded-full text-xs font-medium">
            Info
          </TabsTrigger>
          <TabsTrigger value="audience" className="h-7 px-3 rounded-full text-xs font-medium">
            Audience
          </TabsTrigger>
          <TabsTrigger value="notes" className="h-7 px-3 rounded-full text-xs font-medium">
            Notes
            {hasPropertyValue(campaign.description) && (
              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-0 min-w-0">
          <div className="grid min-w-0">
            <PropertyRow
              icon={<Tag />}
              label="Type"
              value={campaignTypeLabel(campaign.type)}
              empty={!hasPropertyValue(campaign.type)}
              showEmpty
              editValue={campaign.type || "inbound"}
              onCommit={(value) => onUpdate({ type: value })}
              renderEditor={(draft, setDraft) => (
                <Select value={draft} onValueChange={(value) => setDraft(value as CampaignType)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {CAMPAIGN_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <PropertyRow
              icon={<Tag />}
              label="Priority"
              value={campaignPriorityLabel(campaign.priority)}
              empty={!hasPropertyValue(campaign.priority)}
              showEmpty
              editValue={campaign.priority || "medium"}
              onCommit={(value) => onUpdate({ priority: value })}
              renderEditor={(draft, setDraft) => (
                <Select value={draft} onValueChange={(value) => setDraft(value as CampaignPriority)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {CAMPAIGN_PRIORITY_LABELS[priority]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <PropertyRow
              icon={<Calendar />}
              label="Due date"
              value={campaign.dueDate ? new Date(campaign.dueDate).toLocaleDateString() : ""}
              empty={!hasPropertyValue(campaign.dueDate)}
              showEmpty
              editValue={dueDate}
              saveOnEnter={false}
              onCommit={(value) => onUpdate({ dueDate: value || undefined })}
              renderEditor={(draft, setDraft) => (
                <DatePicker
                  date={draft ? new Date(`${draft}T12:00:00`) : undefined}
                  setDate={(date) => setDraft(format(date, "yyyy-MM-dd"))}
                  className="w-full h-8"
                  placeholder="Select due date"
                />
              )}
            />
            <PropertyRow
              icon={<DollarSign />}
              label="Budget"
              value={formatCampaignBudget(campaign.budget?.allocated, campaign.budget?.currency) || ""}
              empty={!hasPropertyValue(campaign.budget?.allocated)}
              showEmpty
              editValue={campaign.budget?.allocated?.toString() || ""}
              onCommit={(value) =>
                onUpdate({
                  budget: {
                    allocated: value ? parseFloat(value) : 0,
                    remaining: campaign.budget?.remaining || 0,
                    currency: campaign.budget?.currency || "USD",
                  },
                })
              }
              renderEditor={(draft, setDraft) => (
                <Input
                  type="number"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="h-8 text-sm"
                />
              )}
            />
            <PropertyRow
              icon={<DollarSign />}
              label="Currency"
              value={campaign.budget?.currency || "USD"}
              empty={!hasPropertyValue(campaign.budget?.currency)}
              showEmpty
              editValue={campaign.budget?.currency || "USD"}
              onCommit={(value) =>
                onUpdate({
                  budget: {
                    allocated: campaign.budget?.allocated || 0,
                    remaining: campaign.budget?.remaining || 0,
                    currency: value,
                  },
                })
              }
              renderEditor={(draft, setDraft) => (
                <Select value={draft} onValueChange={setDraft}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <PropertyRow
              icon={<FileText />}
              label="Campaign ID"
              value={campaign.id}
              copyValue={campaign.id}
              readOnly
            />
          </div>
        </TabsContent>

        <TabsContent value="audience" className="mt-0 min-w-0">
          <CampaignAudienceList campaign={campaign} siteSegments={siteSegments} onUpdate={onUpdate} />
        </TabsContent>

        <TabsContent value="notes" className="mt-0 min-w-0">
          <div className="grid min-w-0">
            <PropertyRow
              icon={<FileText />}
              label="Notes"
              value={campaign.description}
              empty={!hasPropertyValue(campaign.description)}
              showEmpty
              multiline
              editValue={campaign.description || ""}
              saveOnEnter={false}
              onCommit={(value) => onUpdate({ description: value || "" })}
              renderEditor={(draft, setDraft) => (
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="h-32 text-sm w-full rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring min-w-0"
                  placeholder="Add notes about the campaign"
                />
              )}
            />
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-[11px] text-muted-foreground mt-6">
        {createdLabel}
        {updatedLabel ? ` · Updated ${updatedLabel}` : ""}
      </p>
    </div>
  )
}
