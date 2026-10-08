"use client"

import { Button } from "../ui/button"
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from "../ui/section-card"
import { Form } from "../ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useSite } from "@/app/context/SiteContext"
import { useEffect, useState } from "react"
import { BillingData, billingService } from "@/app/services/billing-service"
import { toast } from "sonner"
import { useAuth } from "@/app/hooks/use-auth"
import { useLocalization } from "@/app/context/LocalizationContext"
import { PurchaseCreditsDialog } from "./purchase-credits-dialog"
import { CreditPackages, type CreditPackage } from "./credit-packages"
import { SubscriptionPlans, type BillingPlan } from "./subscription-plans"
import { BillingDetailsFields } from "./billing-details-fields"
import { BillingIntervalSelector } from "./billing-interval-selector"
import { type BillingInterval, parseBillingInterval } from "@/lib/billing-pricing"
import { preferredBillingInterval, rememberBillingInterval } from "@/lib/billing-interval-preference"
import { StripePaymentMethod } from "./stripe-payment-method"
import { ConnectedAccountsAddons } from "./connected-accounts-addons"
import { countSocialAccounts, countAgentChannels, getSocialAccountLimit, getAgentChannelLimit, getRequiredAddons } from "@/lib/billing-limits"
import { LicenseDowngradeDialog } from "./license-downgrade-dialog"
import { useRequiredLicense } from "./use-required-license"
import { requiresSubscriptionManagement } from './subscription-transitions'

const billingFormSchema = z.object({
  plan: z.enum(["commission", "engine", "foundry", "enterprise"]).default("commission"),
  addons_count: z.number().optional().default(0),
  card_name: z.string().optional(),
  card_number: z.string().optional(),
  card_expiry: z.string().optional(),
  card_cvc: z.string().optional(),
  card_address: z.string().optional(),
  card_city: z.string().optional(),
  card_postal_code: z.string().optional(),
  card_country: z.string().optional(),
  tax_id: z.string().optional(),
  billing_address: z.string().optional(),
  billing_city: z.string().optional(),
  billing_postal_code: z.string().optional(),
  billing_country: z.string().optional(),
  auto_renew: z.boolean().default(true)
})

export type BillingFormValues = z.infer<typeof billingFormSchema>

interface BillingFormProps {
  id?: string
  initialData?: Partial<BillingFormValues>
  onSuccess?: () => void
  onSubmitStart?: () => void
  onSubmitEnd?: () => void
}

const PLAN_ORDER: Record<BillingPlan, number> = {
  commission: 0,
  engine: 1,
  foundry: 2,
  enterprise: 3,
}

export function BillingForm({ initialData }: BillingFormProps) {
  const { t } = useLocalization()
  const { currentSite, updateBilling, refreshSites } = useSite()
  const { requiredPlan } = useRequiredLicense(currentSite)
  const { user } = useAuth()
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [isSavingTaxId, setIsSavingTaxId] = useState(false)
  const [isSavingBillingAddress, setIsSavingBillingAddress] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null)
  
  // Downgrade modal state
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false)
  const [pendingDowngradePlan, setPendingDowngradePlan] = useState<BillingPlan | null>(null)

  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingFormSchema),
    defaultValues: {
      plan: initialData?.plan || "commission",
      addons_count: initialData?.addons_count || 0,
      card_name: initialData?.card_name || "",
      card_number: "", // Never prefill card number for security
      card_expiry: initialData?.card_expiry || "",
      card_cvc: "", // Never prefill CVC for security
      card_address: initialData?.card_address || "",
      card_city: initialData?.card_city || "",
      card_postal_code: initialData?.card_postal_code || "",
      card_country: initialData?.card_country || "",
      tax_id: initialData?.tax_id || "",
      billing_address: initialData?.billing_address || "",
      billing_city: initialData?.billing_city || "",
      billing_postal_code: initialData?.billing_postal_code || "",
      billing_country: initialData?.billing_country || "",
      auto_renew: initialData?.auto_renew !== undefined ? initialData.auto_renew : true
    }
  })

  const currentPlan = (currentSite?.billing?.plan || "commission") as BillingPlan
  const currentInterval = parseBillingInterval(currentSite?.billing?.billing_interval) ?? 'month'
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(currentInterval)
  useEffect(() => {
    setBillingInterval(preferredBillingInterval(currentInterval))
  }, [currentSite?.id, currentInterval])
  const changeBillingInterval = (interval: BillingInterval) => {
    setBillingInterval(interval)
    rememberBillingInterval(interval)
  }
  const isPaidPlan = currentPlan !== "commission"

  const addonsCount = currentSite?.billing?.addons_count || 0
  const totalSocialAccounts = countSocialAccounts(currentSite)
  const totalAgentChannels = countAgentChannels(currentSite)
  
  const socialLimit = getSocialAccountLimit(currentPlan)
  const agentLimit = getAgentChannelLimit(currentPlan)
  
  const requiredAddons = getRequiredAddons(currentSite)
  const missingAddons = Math.max(0, requiredAddons - addonsCount)
  
  const socialUsagePercentage = socialLimit === 0 
    ? (totalSocialAccounts > 0 ? 100 : 0)
    : Math.min(100, Math.max(0, (totalSocialAccounts / (socialLimit + addonsCount)) * 100))
    
  const agentUsagePercentage = agentLimit === 0
    ? (totalAgentChannels > 0 ? 100 : 0)
    : Math.min(100, Math.max(0, (totalAgentChannels / (agentLimit + addonsCount)) * 100))

  const handleManageSubscription = async () => {
    if (!currentSite) return
    
    try {
      setIsSavingPlan(true)
      const result = await billingService.createPortalSession(
        currentSite.id,
        window.location.href
      )
      
      if (result.success && result.url) {
        window.location.href = result.url
      } else {
        toast.error(result.error || "Failed to create portal session")
        setIsSavingPlan(false)
      }
    } catch {
      toast.error("An error occurred")
      setIsSavingPlan(false)
    }
  }

  const handleChangePlan = async (plan: BillingPlan, skipReview = false) => {
    if (!currentSite || !user) {
      toast.error("No site selected or user not authenticated")
      return
    }

    if (plan === currentPlan && (plan === 'commission' || billingInterval === currentInterval)) return

    // Stripe controls cancellation and unsupported tier changes; keep paid allowances until settlement/expiry.
    if (requiresSubscriptionManagement(currentPlan, plan, currentInterval, billingInterval)) {
      await handleManageSubscription()
      return
    }
    // Suspension is a server-owned consequence of an effective plan change.
    // Never disconnect provider accounts before Stripe confirms the downgrade.
    if (!skipReview && PLAN_ORDER[plan] < PLAN_ORDER[currentPlan]) {
      setPendingDowngradePlan(plan)
      setDowngradeModalOpen(true)
      return
    }

    if (plan === 'commission') return
    try {
      setIsSavingPlan(true)
      const result = await billingService.createSubscriptionCheckoutSession(
        currentSite.id,
        plan,
        user.email!,
        addonsCount,
        billingInterval
      )
      if (result.success && result.url) {
        window.location.href = result.url
        return
      }
      toast.error(result.error || "Failed to create checkout session")
    } catch (error) {
      console.error("Error saving plan:", error)
      toast.error("An unexpected error occurred while updating plan")
    } finally {
      setIsSavingPlan(false)
    }
  }
  
  const handleDowngradeConfirm = async () => {
    if (!pendingDowngradePlan) return
    const target = pendingDowngradePlan
    setDowngradeModalOpen(false)
    setPendingDowngradePlan(null)
    await handleChangePlan(target, true)
  }

  const handleSaveTaxId = async () => {
    if (!currentSite) {
      toast.error("No site selected")
      return
    }

    try {
      setIsSavingTaxId(true)
      
      const values = form.getValues()
      const billingData: Partial<BillingData> = {
        tax_id: values.tax_id
      }
      
      const result = await updateBilling(currentSite.id, billingData)
      
      if (result.success) {
        toast.success("Tax ID updated successfully")
        await refreshSites()
      } else {
        toast.error(result.error || "Failed to update tax ID")
      }
    } catch (error) {
      console.error("Error saving tax ID:", error)
      toast.error("An unexpected error occurred while updating tax ID")
    } finally {
      setIsSavingTaxId(false)
    }
  }

  const handleSaveBillingAddress = async () => {
    if (!currentSite) {
      toast.error("No site selected")
      return
    }

    try {
      setIsSavingBillingAddress(true)
      
      const values = form.getValues()
      const billingData: Partial<BillingData> = {
        billing_address: values.billing_address,
        billing_city: values.billing_city,
        billing_postal_code: values.billing_postal_code,
        billing_country: values.billing_country
      }
      
      const result = await updateBilling(currentSite.id, billingData)
      
      if (result.success) {
        toast.success("Billing address updated successfully")
        await refreshSites()
      } else {
        toast.error(result.error || "Failed to update billing address")
      }
    } catch (error) {
      console.error("Error saving billing address:", error)
      toast.error("An unexpected error occurred while updating billing address")
    } finally {
      setIsSavingBillingAddress(false)
    }
  }

  return (
    <>
    <Form {...form}>
      <div className="space-y-6">
        <SectionCard id="credits">
          <SectionCardHeader
            title={t('billing.credits.title') || 'Credits'}
            description={t('billing.credits.buyHint') || 'Choose a package to add credits to your balance.'}
            actions={
              <Button variant="outline" size="sm" type="button" onClick={() => window.location.href = "/billing?tab=credit_history"}>
                {t('billing.credits.viewHistory') || 'View usage history'}
              </Button>
            }
          />
          <SectionCardContent className="space-y-6">
              <div>
                <div className="text-3xl font-bold">
                  {currentSite?.billing?.credits_available !== undefined ? currentSite.billing.credits_available : 0} <span className="text-sm font-medium text-muted-foreground">{t('billing.credits.available') || 'credits available'}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">{t('billing.credits.reset') || 'Your credits will reset on the first day of each month'}</div>
                <div className="text-sm text-muted-foreground mt-1">{t('billing.credits.usage') || 'Credits are used for inference tokens, ads, and third-party services'}</div>
              </div>
              <CreditPackages onBuy={setSelectedPackage} />
            </SectionCardContent>
        </SectionCard>
        
        <SectionCard id="subscription-plan">
          <SectionCardHeader
            title={t('billing.plan.title') || 'Subscription Plan'}
            description="Review and confirm changes in Stripe. Annual plans are billed once per year; credits and connection allowances remain monthly."
          />
          <SectionCardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">Current billing: {isPaidPlan ? (currentInterval === 'year' ? 'Annual' : 'Monthly') : 'Free plan'}</p>
              <BillingIntervalSelector value={billingInterval} onChange={changeBillingInterval} disabled={isSavingPlan || downgradeModalOpen} />
              <SubscriptionPlans
                currentPlan={currentPlan}
                requiredPlan={requiredPlan}
                currentInterval={currentInterval}
                billingInterval={billingInterval}
                isSaving={isSavingPlan}
                blockedPaidChanges={isPaidPlan && addonsCount > 0}
                onChangePlan={handleChangePlan}
              />
              {isPaidPlan && addonsCount > 0 && <p className="text-sm text-muted-foreground">Subscriptions with add-ons cannot switch plans or intervals here. Use Manage Add-ons or contact billing support to review your subscription.</p>}
              {isPaidPlan && <p className="text-sm text-muted-foreground">Same-interval tier changes are managed in Stripe, not new checkout. Available changes depend on your portal configuration; contact billing support if unavailable. Existing discounts require support review to preserve their terms. No accounts are disconnected before a confirmed change.</p>}
            </SectionCardContent>
        </SectionCard>
          
        <ConnectedAccountsAddons
          totalSocialAccounts={totalSocialAccounts}
          totalAgentChannels={totalAgentChannels}
          socialLimit={socialLimit}
          agentLimit={agentLimit}
          addonsCount={addonsCount}
          billingInterval={currentInterval}
          requiredAddons={requiredAddons}
          missingAddons={missingAddons}
          socialUsagePercentage={socialUsagePercentage}
          agentUsagePercentage={agentUsagePercentage}
          isPaidPlan={isPaidPlan}
          isSaving={isSavingPlan}
          onManageAddons={handleManageSubscription}
        />

        {isPaidPlan && (
        <SectionCard id="payment-method">
          <SectionCardHeader 
            title={t('billing.payment.title') || 'Payment Method'} 
            description={t('billing.payment.description') || 'Manage how you pay for your subscription.'}
          />
          <SectionCardContent>
            <StripePaymentMethod siteId={currentSite?.id} />
          </SectionCardContent>
          <SectionCardFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageSubscription}
              disabled={isSavingPlan}
            >
              {isSavingPlan
                ? (t('billing.form.processing') || "Processing...")
                : (t('billing.form.manageSub') || "Manage billing")}
            </Button>
          </SectionCardFooter>
        </SectionCard>
        )}

        <BillingDetailsFields
          handleSaveTaxId={handleSaveTaxId}
          handleSaveBillingAddress={handleSaveBillingAddress}
          isSavingTaxId={isSavingTaxId}
          isSavingBillingAddress={isSavingBillingAddress}
        />
      </div>
    </Form>
    
    {selectedPackage && (
      <PurchaseCreditsDialog 
        open={!!selectedPackage}
        onOpenChange={(open) => {
          if (!open) setSelectedPackage(null)
        }}
        {...selectedPackage}
      />
    )}
    
    <LicenseDowngradeDialog
      plan={downgradeModalOpen ? pendingDowngradePlan : null}
      onClose={() => { setDowngradeModalOpen(false); setPendingDowngradePlan(null) }}
      busy={isSavingPlan}
      onConfirm={handleDowngradeConfirm}
    />
    </>
  )
} 