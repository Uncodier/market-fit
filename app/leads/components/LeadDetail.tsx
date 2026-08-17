"use client"

import { useEffect, useState } from "react"
import { Lead, Segment } from "@/app/leads/types"
import { Campaign } from "@/app/types"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { DetailsTab } from "./DetailsTab"
import { CompanyTab } from "./CompanyTab"
import { SocialNetworkTab } from "./SocialNetworkTab"
import { AddressTab } from "./AddressTab"
import { NotesTab } from "./NotesTab"
import { hasPropertyValue } from "./PropertyRow"

interface LeadDetailProps {
  lead: Lead
  segments: Segment[]
  campaigns: Campaign[]
  onUpdateLead: (id: string, data: Partial<Lead>) => Promise<void>
  revealEmptyCount?: number
}

export function LeadDetail({
  lead,
  segments,
  campaigns,
  onUpdateLead,
  revealEmptyCount = 0,
}: LeadDetailProps) {
  const [showEmpty, setShowEmpty] = useState(revealEmptyCount > 0)

  useEffect(() => {
    if (revealEmptyCount > 0) setShowEmpty(true)
  }, [revealEmptyCount])

  const createdLabel = new Date(lead.created_at).toLocaleDateString()
  const updatedLabel = lead.updated_at
    ? new Date(lead.updated_at).toLocaleDateString()
    : null

  return (
    <div className="w-full min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
        About
      </p>
      <Tabs defaultValue="details" className="w-full min-w-0">
        <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full w-full justify-start overflow-x-auto mb-3">
          <TabsTrigger value="details" className="h-7 px-3 rounded-full text-xs font-medium">
            Info
          </TabsTrigger>
          <TabsTrigger value="company" className="h-7 px-3 rounded-full text-xs font-medium">
            Company
          </TabsTrigger>
          <TabsTrigger value="social_networks" className="h-7 px-3 rounded-full text-xs font-medium">
            Profiles
          </TabsTrigger>
          <TabsTrigger value="address" className="h-7 px-3 rounded-full text-xs font-medium">
            Address
          </TabsTrigger>
          <TabsTrigger value="notes" className="h-7 px-3 rounded-full text-xs font-medium">
            Notes
            {hasPropertyValue(lead.notes) && (
              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-0 min-w-0">
          <DetailsTab
            lead={lead}
            segments={segments}
            campaigns={campaigns}
            showEmpty={showEmpty}
            onToggleEmpty={() => setShowEmpty((value) => !value)}
            onUpdateLead={onUpdateLead}
          />
        </TabsContent>
        <TabsContent value="company" className="mt-0 min-w-0">
          <CompanyTab
            lead={lead}
            showEmpty={showEmpty}
            onToggleEmpty={() => setShowEmpty((value) => !value)}
            onUpdateLead={onUpdateLead}
          />
        </TabsContent>
        <TabsContent value="social_networks" className="mt-0 min-w-0">
          <SocialNetworkTab
            lead={lead}
            showEmpty={showEmpty}
            onToggleEmpty={() => setShowEmpty((value) => !value)}
            onUpdateLead={onUpdateLead}
          />
        </TabsContent>
        <TabsContent value="address" className="mt-0 min-w-0">
          <AddressTab
            lead={lead}
            showEmpty={showEmpty}
            onToggleEmpty={() => setShowEmpty((value) => !value)}
            onUpdateLead={onUpdateLead}
          />
        </TabsContent>
        <TabsContent value="notes" className="mt-0 min-w-0">
          <NotesTab lead={lead} onUpdateLead={onUpdateLead} />
        </TabsContent>
      </Tabs>

      <p className="text-[11px] text-muted-foreground mt-6">
        {createdLabel}
        {updatedLabel ? ` · Updated ${updatedLabel}` : ""}
      </p>
    </div>
  )
}
