"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Tabs, TabsContent } from "@/app/components/ui/tabs"
import {
  ResponsiveTabsList,
  type TabItem,
} from "@/app/components/ui/responsive-tabs-list"
import { useSite } from "@/app/context/SiteContext"
import {
  getSubscriptionDetail,
  updateSubscriptionStatus,
  type SubscriptionDetail,
  type SubscriptionInvoice,
} from "../actions"
import { SubscriptionAboutPanel } from "../components/SubscriptionAboutPanel"
import { CreateSubscriptionInvoiceDialog } from "../components/CreateSubscriptionInvoiceDialog"
import { SubscriptionIdentityHeader } from "../components/SubscriptionIdentityHeader"
import { SubscriptionInvoicesTable } from "../components/SubscriptionInvoicesTable"
import { SubscriptionPaymentsTable } from "../components/SubscriptionPaymentsTable"
import { SubscriptionStatusBar } from "../components/SubscriptionStatusBar"

const SUBSCRIPTION_TABS: TabItem[] = [
  { value: "invoices", label: "Invoices" },
  { value: "payments", label: "Payments" },
]

export default function SubscriptionDetailPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = React.use(props.params)
  const router = useRouter()
  const { currentSite } = useSite()
  const [subscription, setSubscription] = useState<SubscriptionDetail | null>(null)
  const [invoices, setInvoices] = useState<SubscriptionInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("invoices")
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const loadSubscription = useCallback(async () => {
    if (!currentSite?.id || !id) return

    setLoading(true)
    try {
      const result = await getSubscriptionDetail(currentSite.id, id)
      if (result.error || !result.subscription) {
        toast.error(result.error || "Subscription not found")
        setSubscription(null)
        setInvoices([])
        return
      }

      setSubscription(result.subscription)
      setInvoices(result.invoices)
    } finally {
      setLoading(false)
    }
  }, [currentSite?.id, id])

  useEffect(() => {
    void loadSubscription()
  }, [loadSubscription])

  useEffect(() => {
    const title = subscription?.catalog_item?.name || "Subscription details"
    document.title = `${title} | Subscriptions`
    window.dispatchEvent(
      new CustomEvent("breadcrumb:update", {
        detail: {
          title,
          path: `/subscriptions/${id}`,
          section: "subscriptions",
        },
      })
    )

    return () => {
      document.title = "Subscriptions | Market Fit"
      window.dispatchEvent(
        new CustomEvent("breadcrumb:update", {
          detail: { title: null, path: null, section: "subscriptions" },
        })
      )
    }
  }, [id, subscription?.catalog_item?.name])

  const handleStatusChange = async (status: SubscriptionDetail["status"]) => {
    if (!currentSite?.id || !subscription) return

    setUpdatingStatus(true)
    try {
      const result = await updateSubscriptionStatus(currentSite.id, subscription.id, status)
      if (result.error) {
        toast.error(result.error)
        return
      }

      setSubscription((current) => current ? { ...current, status } : current)
      toast.success(`Subscription marked as ${status}`)
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <Skeleton className="h-10 w-64" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-6 h-80 rounded-xl" />
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-semibold">Subscription not found</h2>
          <Button onClick={() => router.push("/subscriptions")}>
            Back to subscriptions
          </Button>
        </div>
      </div>
    )
  }

  const currency = invoices[0]?.currency || "USD"

  return (
    <div className="flex-1 p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="w-full min-w-0 flex-1 pt-0">
            <div className="flex w-full items-center justify-between gap-4">
              <ResponsiveTabsList
                tabs={SUBSCRIPTION_TABS}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                className="w-auto max-w-full flex-1"
              />
              <div className="flex shrink-0 items-center overflow-x-auto">
                <SubscriptionStatusBar
                  currentStatus={subscription.status}
                  onStatusChange={(status) => void handleStatusChange(status)}
                  disabled={updatingStatus}
                />
              </div>
            </div>
          </div>
        </StickyHeader>

        <div className="px-4 py-5 lg:px-8">
          <SubscriptionIdentityHeader
            subscription={subscription}
            currency={currency}
            onCreateInvoice={() => setCreateInvoiceOpen(true)}
          />

          <div className="mt-5 flex flex-col border-t border-border/50 lg:flex-row">
            <div className="w-full pt-5 lg:min-w-0 lg:flex-1 lg:pr-8">
              <TabsContent value="invoices" className="mt-0 pt-0">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Invoices</h2>
                  <p className="text-sm text-muted-foreground">
                    Billing history for this subscription.
                  </p>
                </div>
                <SubscriptionInvoicesTable invoices={invoices} />
              </TabsContent>

              <TabsContent value="payments" className="mt-0 pt-0">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">Payments</h2>
                  <p className="text-sm text-muted-foreground">
                    Payments registered against this subscription&apos;s invoices.
                  </p>
                </div>
                <SubscriptionPaymentsTable invoices={invoices} />
              </TabsContent>
            </div>

            <aside className="w-full shrink-0 pt-5 lg:w-[340px] lg:border-l lg:border-border/50 lg:pl-8 xl:w-[380px]">
              <div className="lg:sticky lg:top-[calc(var(--topbar-height,64px)+71px+16px)] lg:max-h-[calc(100vh-var(--topbar-height,64px)-96px)] lg:overflow-y-auto">
                <SubscriptionAboutPanel
                  subscription={subscription}
                  currency={currency}
                  invoices={invoices}
                />
              </div>
            </aside>
          </div>
        </div>
      </Tabs>

      {currentSite ? (
        <CreateSubscriptionInvoiceDialog
          open={createInvoiceOpen}
          onOpenChange={setCreateInvoiceOpen}
          siteId={currentSite.id}
          subscriptionId={subscription.id}
          defaultAmount={Number(subscription.amount) || 0}
          onSuccess={loadSubscription}
        />
      ) : null}
    </div>
  )
}
