"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Deal } from "@/app/deals/types"
import { getDealById, updateDeal } from "@/app/deals/actions"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { JourneyView } from "@/app/leads/components/JourneyView"
import { DealStageBar, stageToStatus } from "@/app/deals/components/DealStageBar"
import { DealIdentityHeader } from "@/app/deals/components/DealIdentityHeader"
import { DealAboutPanel } from "@/app/deals/components/DealAboutPanel"
import { DealSalesOrder } from "@/app/deals/components/DealSalesOrder"
import { DealQualifyTab } from "@/app/deals/components/DealQualifyTab"
import { DealDetailSkeleton } from "@/app/deals/components/DealDetailSkeleton"
import { DEAL_STAGE_TO_JOURNEY } from "@/app/deals/components/deal-format"

function mergeDeal(previous: Deal | null, next: Deal): Deal {
  if (!previous) return next
  return {
    ...previous,
    ...next,
    contacts: next.contacts ?? previous.contacts,
    owners: next.owners ?? previous.owners,
    company: next.company ?? previous.company,
    companies: next.companies ?? previous.companies,
  }
}

export default function DealPage(props: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(props.params)
  const router = useRouter()
  const [deal, setDeal] = useState<Deal | null>(null)
  const [loading, setLoading] = useState(true)

  const id = unwrappedParams.id as string

  const handleUpdate = (updated: Deal) => {
    setDeal((previous) => mergeDeal(previous, updated))
  }

  useEffect(() => {
    async function loadDeal() {
      if (!id) return

      setLoading(true)
      try {
        const result = await getDealById(id)
        if (result.error) {
          toast.error(result.error)
          router.push("/deals")
          return
        }

        if (result.deal) {
          setDeal(result.deal)
          window.dispatchEvent(
            new CustomEvent("breadcrumb:update", {
              detail: {
                title: result.deal.name,
                path: `/deals/${id}`,
                section: "deals",
              },
            })
          )
        }
      } catch (error) {
        console.error("Error loading deal:", error)
        toast.error("Error loading deal")
      } finally {
        setLoading(false)
      }
    }

    void loadDeal()

    return () => {
      window.dispatchEvent(
        new CustomEvent("breadcrumb:update", {
          detail: { title: null, path: null, section: "deals" },
        })
      )
    }
  }, [id, router])

  const handleStageChange = async (stage: Deal["stage"]) => {
    if (!deal) return
    try {
      const result = await updateDeal({
        id: deal.id,
        stage,
        status: stageToStatus(stage),
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.deal) {
        toast.success(`Stage updated to ${stage.replace(/_/g, " ")}`)
        handleUpdate(result.deal)
      }
    } catch {
      toast.error("Failed to update stage")
    }
  }

  if (loading) {
    return <DealDetailSkeleton />
  }

  if (!deal) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Deal not found</h2>
          <Button onClick={() => router.push("/deals")}>Back to Deals</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="activity">
        <StickyHeader>
          <div className="pt-0 flex-1 w-full">
            <div className="flex items-center justify-between w-full gap-4">
              <TabsList>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="sales">Sales</TabsTrigger>
                <TabsTrigger value="qualify">Qualify</TabsTrigger>
              </TabsList>
              <div className="flex items-center overflow-x-auto shrink-0">
                <DealStageBar currentStage={deal.stage} onStageChange={(stage) => void handleStageChange(stage)} />
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="px-4 lg:px-8 py-5">
          <DealIdentityHeader deal={deal} onUpdate={handleUpdate} />

          <div className="mt-5 flex flex-col lg:flex-row border-t border-border/50">
            <div className="w-full lg:min-w-0 lg:flex-1 pt-5 lg:pr-8">
              <TabsContent value="activity" className="mt-0 pt-0">
                <JourneyView leadId={deal.id} currentStage={DEAL_STAGE_TO_JOURNEY[deal.stage]} />
              </TabsContent>
              <TabsContent value="sales" className="mt-0 pt-0">
                <DealSalesOrder deal={deal} onUpdate={handleUpdate} />
              </TabsContent>
              <TabsContent value="qualify" className="mt-0 pt-0">
                <DealQualifyTab deal={deal} onUpdate={handleUpdate} />
              </TabsContent>
            </div>

            <aside className="w-full lg:w-[340px] xl:w-[380px] shrink-0 pt-5 lg:pl-8 lg:border-l border-border/50">
              <div className="lg:sticky lg:top-[calc(var(--topbar-height,64px)+71px+16px)] lg:max-h-[calc(100vh-var(--topbar-height,64px)-96px)] lg:overflow-y-auto">
                <DealAboutPanel deal={deal} onUpdate={handleUpdate} />
              </div>
            </aside>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
