"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
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
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  getSubscriptionDetail,
  updateSubscriptionDueDate,
  updateSubscriptionNextBillingDate,
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
import { updateSubscriptionAmount, updateSubscriptionEndDate } from "../update-details"

// Translate known application errors at the display boundary; preserve provider details.
const ERROR_KEYS: Record<string, string> = {
  "Subscription not found": "operations.subscriptions.notFound",
  "Invalid subscription request": "operations.subscriptions.errors.invalidRequest",
  "Not authenticated": "operations.subscriptions.errors.notAuthenticated",
  "Failed to load subscription": "operations.subscriptions.errors.loadFailed",
  "Failed to update subscription": "operations.subscriptions.errors.updateFailed",
  "Unable to save subscription date": "operations.subscriptions.errors.saveDateFailed",
  "Unable to save subscription amount": "operations.subscriptions.errors.saveAmountFailed",
  "Unable to save subscription details": "operations.subscriptions.errors.saveDetailsFailed",
  "Enter a valid end date (YYYY-MM-DD)": "operations.subscriptions.errors.invalidEndDate",
  "Enter a valid next billing date (YYYY-MM-DD)": "operations.subscriptions.errors.invalidBillingDate",
  "Enter a valid due date (YYYY-MM-DD)": "operations.subscriptions.errors.invalidDueDate",
  "Invalid subscription billing date": "operations.subscriptions.errors.invalidSubscriptionBillingDate",
  "A next billing date is required to configure a due date": "operations.subscriptions.errors.billingDateRequired",
  "Not authorized to edit subscriptions in this site": "operations.subscriptions.errors.notAuthorized",
  "Unable to verify the subscription. Reload and retry.": "operations.subscriptions.errors.verifyFailed",
  "Subscription changed while editing. Reload and retry.": "operations.subscriptions.errors.changed",
  "Enter a valid amount of zero or more": "operations.subscriptions.errors.invalidAmount",
  "Use no more than two decimal places": "operations.subscriptions.errors.amountPrecision",
  "Unable to verify the subscription start date": "operations.subscriptions.errors.verifyStartDateFailed",
  "End date cannot be before start date": "operations.subscriptions.errors.endBeforeStart",
}

export default function SubscriptionDetailPage(props: {
  params: Promise<{ id: string }>
}) {
  const { t } = useLocalization()
  // Data loading depends on identity, not display language.
  const translateRef = useRef(t)
  useEffect(() => { translateRef.current = t }, [t])
  const errorLabel = (message: string) => ERROR_KEYS[message] ? t(ERROR_KEYS[message]) : message
  const subscriptionTabs: TabItem[] = [
    { value: "invoices", label: t("operations.subscriptions.invoices") },
    { value: "payments", label: t("bills.field.payments") },
  ]
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
        const message = result.error || "Subscription not found"
        toast.error(ERROR_KEYS[message] ? translateRef.current(ERROR_KEYS[message]) : message)
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
    const title = subscription?.catalog_item?.name || t("operations.subscriptions.details")
    document.title = `${title} | ${t("layout.sidebar.subscriptions")}`
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
      document.title = `${t("layout.sidebar.subscriptions")} | Market Fit`
      window.dispatchEvent(
        new CustomEvent("breadcrumb:update", {
          detail: { title: null, path: null, section: "subscriptions" },
        })
      )
    }
  }, [id, subscription?.catalog_item?.name, t])

  const handleStatusChange = async (status: SubscriptionDetail["status"]) => {
    if (!currentSite?.id || !subscription) return

    setUpdatingStatus(true)
    try {
      const result = await updateSubscriptionStatus(currentSite.id, subscription.id, status)
      if (result.error) {
        toast.error(errorLabel(result.error))
        return
      }

      setSubscription((current) => current ? { ...current, status } : current)
      toast.success(t("operations.subscriptions.statusChanged", { status: t(`subscriptions.status.${status}`) }))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleDateChange = async (field: "next_billing_date" | "due_date" | "end_date", value: string) => {
    if (!currentSite?.id || !subscription) throw new Error(t("operations.subscriptions.notFound"))

    const result = field === "next_billing_date"
      ? await updateSubscriptionNextBillingDate(currentSite.id, subscription.id, value)
      : field === "end_date"
        ? await updateSubscriptionEndDate(currentSite.id, subscription.id, value || null)
        : await updateSubscriptionDueDate(currentSite.id, subscription.id, value || null)
    if (result.error || !result.data) throw new Error(errorLabel(result.error || "Unable to save subscription date"))

    setSubscription((current) => current ? { ...current, ...result.data } : current)
    toast.success(t(field === "next_billing_date" ? "operations.subscriptions.billingDateSaved" : field === "end_date" ? "operations.subscriptions.endDateSaved" : "operations.subscriptions.dueDateSaved"))
  }

  const handleAmountChange = async (value: number) => {
    if (!currentSite?.id || !subscription) throw new Error(t("operations.subscriptions.notFound"))
    const result = await updateSubscriptionAmount(currentSite.id, subscription.id, value)
    if (result.error || !result.data) throw new Error(errorLabel(result.error || "Unable to save subscription amount"))
    setSubscription((current) => current ? { ...current, ...result.data } : current)
    toast.success(t("operations.subscriptions.amountSaved"))
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
          <h2 className="text-2xl font-semibold">{t("operations.subscriptions.notFound")}</h2>
          <Button onClick={() => router.push("/subscriptions")}>
            {t("operations.subscriptions.back")}
          </Button>
        </div>
      </div>
    )
  }

  const currency = subscription.catalog_item?.currency || invoices[0]?.currency || "USD"

  return (
    <div className="flex-1 p-0">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="w-full min-w-0 flex-1 pt-0">
            <div className="flex w-full items-center justify-between gap-4">
              <ResponsiveTabsList
                tabs={subscriptionTabs}
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
            onInvoiceGenerated={loadSubscription}
          />

          <div className="mt-5 flex flex-col border-t border-border/50 lg:flex-row">
            <div className="w-full pt-5 lg:min-w-0 lg:flex-1 lg:pr-8">
              <TabsContent value="invoices" className="mt-0 pt-0">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">{t("operations.subscriptions.invoices")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("operations.subscriptions.billingHistory")}
                  </p>
                </div>
                <SubscriptionInvoicesTable invoices={invoices} />
              </TabsContent>

              <TabsContent value="payments" className="mt-0 pt-0">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">{t("bills.field.payments")}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t("operations.subscriptions.paymentsDescription")}
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
                  onUpdateNextBillingDate={(value) => handleDateChange("next_billing_date", value)}
                  onUpdateDueDate={(value) => handleDateChange("due_date", value)}
                  onUpdateAmount={handleAmountChange}
                  onUpdateEndDate={(value) => handleDateChange("end_date", value)}
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
          defaultDueDate={subscription.due_date}
          nextBillingDate={subscription.next_billing_date}
          onSuccess={loadSubscription}
        />
      ) : null}
    </div>
  )
}
