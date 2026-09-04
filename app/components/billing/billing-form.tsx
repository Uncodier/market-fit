"use client"

import { Button } from "../ui/button"
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from "../ui/section-card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Globe, Tag } from "../ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { useState } from "react"
import { BillingData, billingService } from "@/app/services/billing-service"
import { toast } from "sonner"
import { useAuth } from "@/app/hooks/use-auth"
import { useLocalization } from "@/app/context/LocalizationContext"
import { PurchaseCreditsDialog } from "./purchase-credits-dialog"
import { CreditPackages, type CreditPackage } from "./credit-packages"
import { SubscriptionPlans, type BillingPlan } from "./subscription-plans"
import { StripePaymentMethod } from "./stripe-payment-method"
import { ConnectedAccountsAddons } from "./connected-accounts-addons"
import { getAccountLimit, countConnectedAccounts, getRequiredAddons } from "@/lib/billing-limits"
import { accountsToDisconnect, settingsAfterKeepingAccounts } from "./downgrade-accounts"
import { DowngradeChannelsModal } from "./downgrade-channels-modal"
import { disconnectOutstandSocial, disconnectZavuChannel } from "@/app/components/settings/disconnect-remote-accounts"

const billingFormSchema = z.object({
  plan: z.enum(["commission", "starter", "startup", "enterprise"]).default("commission"),
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

type BillingFormValues = z.infer<typeof billingFormSchema>

interface BillingFormProps {
  id?: string
  initialData?: Partial<BillingFormValues>
  onSuccess?: () => void
  onSubmitStart?: () => void
  onSubmitEnd?: () => void
}

const PLAN_ORDER: Record<BillingPlan, number> = {
  commission: 0,
  starter: 1,
  startup: 2,
  enterprise: 3,
}

export function BillingForm({ id, initialData, onSuccess, onSubmitStart, onSubmitEnd }: BillingFormProps) {
  const { t } = useLocalization()
  const { currentSite, updateBilling, refreshSites, updateSettings } = useSite()
  const { user } = useAuth()
  const [isSavingPlan, setIsSavingPlan] = useState(false)
  const [isSavingTaxId, setIsSavingTaxId] = useState(false)
  const [isSavingBillingAddress, setIsSavingBillingAddress] = useState(false)
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null)
  
  // Downgrade modal state
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false)
  const [pendingDowngradePlan, setPendingDowngradePlan] = useState<BillingPlan | null>(null)
  const [downgradeTargetLimit, setDowngradeTargetLimit] = useState(0)

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
  const isPaidPlan = currentPlan !== "commission"

  const addonsCount = currentSite?.billing?.addons_count || 0
  const totalConnectedAccounts = countConnectedAccounts(currentSite)
  const includedAccounts = getAccountLimit(currentPlan, 0)
  const limitAccounts = getAccountLimit(currentPlan, addonsCount)
  const requiredAddons = getRequiredAddons(currentSite)
  const missingAddons = Math.max(0, requiredAddons - addonsCount)
  const accountsUsagePercentage = limitAccounts === 0
    ? (totalConnectedAccounts > 0 ? 100 : 0)
    : Math.min(100, Math.max(0, (totalConnectedAccounts / limitAccounts) * 100))

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
    } catch (error) {
      toast.error("An error occurred")
      setIsSavingPlan(false)
    }
  }

  const handleChangePlan = async (plan: BillingPlan, skipLimitCheck = false) => {
    if (!currentSite || !user) {
      toast.error("No site selected or user not authenticated")
      return
    }

    if (plan === currentPlan) return
    
    // Check for downgrade limits if not explicitly skipped
    if (!skipLimitCheck) {
      const isDowngrade = PLAN_ORDER[plan] < PLAN_ORDER[currentPlan]
      if (isDowngrade) {
        const targetLimit = getAccountLimit(plan, addonsCount)
        if (totalConnectedAccounts > targetLimit) {
          setPendingDowngradePlan(plan)
          setDowngradeTargetLimit(targetLimit)
          setDowngradeModalOpen(true)
          return
        }
      }
    }

    form.setValue("plan", plan)

    try {
      setIsSavingPlan(true)

      if (plan === "commission" && isPaidPlan) {
        await handleManageSubscription()
        return
      }

      if (plan === "starter" || plan === "startup" || plan === "enterprise") {
        const result = await billingService.createSubscriptionCheckoutSession(
          currentSite.id,
          plan,
          user.email!,
          addonsCount
        )

        if (result.success && result.url) {
          window.location.href = result.url
          return
        }

        toast.error(result.error || "Failed to create checkout session")
        return
      }

      const result = await updateBilling(currentSite.id, {
        plan,
        auto_renew: form.getValues().auto_renew,
      })

      if (result.success) {
        toast.success("Plan updated successfully")
        await refreshSites()
      } else {
        toast.error(result.error || "Failed to update plan")
      }
    } catch (error) {
      console.error("Error saving plan:", error)
      toast.error("An unexpected error occurred while updating plan")
    } finally {
      setIsSavingPlan(false)
    }
  }
  
  const handleDowngradeConfirm = async (keepKeys: string[]) => {
    if (!currentSite || !pendingDowngradePlan) return

    const planToApply = pendingDowngradePlan
    setIsSavingPlan(true)

    const removed = accountsToDisconnect(currentSite, keepKeys)
    const failedKeys: string[] = []

    try {
      for (const item of removed.channels) {
        try {
          await disconnectZavuChannel(item.channel)
        } catch (error) {
          console.error("Error disconnecting channel from Zavu:", error)
          failedKeys.push(item.key)
        }
      }
      for (const item of removed.socials) {
        try {
          await disconnectOutstandSocial(item.social, currentSite.id)
        } catch (error) {
          console.error("Error disconnecting social account from Outstand:", error)
          failedKeys.push(item.key)
        }
      }

      const nextKeepKeys = [...keepKeys, ...failedKeys]
      await updateSettings(currentSite.id, settingsAfterKeepingAccounts(currentSite.settings, nextKeepKeys))

      if (failedKeys.length > 0) {
        toast.error("Some accounts could not be disconnected. The plan was not changed.")
        return
      }

      setDowngradeModalOpen(false)
      setPendingDowngradePlan(null)
      await handleChangePlan(planToApply, true)
    } catch (error) {
      console.error("Error updating settings for downgrade:", error)
      toast.error("Failed to remove accounts before downgrading")
    } finally {
      setIsSavingPlan(false)
    }
  }

  const handleSaveTaxId = async () => {
    if (!currentSite) {
      toast.error("No site selected")
      return
    }

    try {
      setIsSavingTaxId(true)
      
      const values = form.getValues()
      const billingData: BillingData = {
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
      const billingData: BillingData = {
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
            description={t('billing.plan.changeHint') || 'Upgrade or downgrade instantly from the plan you want.'}
          />
          <SectionCardContent className="space-y-6">
              <SubscriptionPlans
                currentPlan={currentPlan}
                isSaving={isSavingPlan}
                onChangePlan={handleChangePlan}
              />
            </SectionCardContent>
        </SectionCard>
          
        <ConnectedAccountsAddons
          totalConnectedAccounts={totalConnectedAccounts}
          includedAccounts={includedAccounts}
          addonsCount={addonsCount}
          limitAccounts={limitAccounts}
          requiredAddons={requiredAddons}
          missingAddons={missingAddons}
          accountsUsagePercentage={accountsUsagePercentage}
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

        <SectionCard id="tax-id">
          <SectionCardHeader title={t('billing.tax.title') || 'Tax ID'} />
          <SectionCardContent className="space-y-6">
              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">{t('billing.tax.label') || 'Tax ID'}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className="pl-12 h-12 text-base" 
                          placeholder={t('billing.tax.placeholder') || "Tax ID / VAT Number"}
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs mt-2" />
                  </FormItem>
                )}
              />
            </SectionCardContent>
          <SectionCardFooter>
            <Button 
              variant="outline"
              onClick={handleSaveTaxId}
              disabled={isSavingTaxId}
              size="sm"
            >
              {isSavingTaxId ? (t('common.saving') || "Saving...") : (t('common.save') || "Save")}
            </Button>
          </SectionCardFooter>
        </SectionCard>
        
        <SectionCard id="billing-address">
          <SectionCardHeader title={t('billing.address.title') || 'Billing Address'} />
          <SectionCardContent className="space-y-6">
              <FormField
                control={form.control}
                name="billing_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">{t('billing.address.street') || 'Street Address'}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className="pl-12 h-12 text-base" 
                          placeholder="123 Main St"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs mt-2" />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="billing_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">{t('billing.address.city') || 'City'}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            className="pl-12 h-12 text-base" 
                            placeholder="New York"
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs mt-2" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="billing_postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">{t('billing.address.postal') || 'Postal Code'}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            className="pl-12 h-12 text-base" 
                            placeholder="10001"
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs mt-2" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="billing_country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">{t('billing.address.country') || 'Country'}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            className="pl-12 h-12 text-base" 
                            placeholder="United States"
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs mt-2" />
                    </FormItem>
                  )}
                />
              </div>
            </SectionCardContent>
          <SectionCardFooter>
            <Button 
              variant="outline"
              onClick={handleSaveBillingAddress}
              disabled={isSavingBillingAddress}
              size="sm"
            >
              {isSavingBillingAddress ? (t('common.saving') || "Saving...") : (t('common.save') || "Save")}
            </Button>
          </SectionCardFooter>
        </SectionCard>
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
    
    <DowngradeChannelsModal
      open={downgradeModalOpen}
      onOpenChange={setDowngradeModalOpen}
      site={currentSite}
      targetLimit={downgradeTargetLimit}
      busy={isSavingPlan}
      onConfirm={handleDowngradeConfirm}
    />
    </>
  )
} 