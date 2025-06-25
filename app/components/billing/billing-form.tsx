"use client"

import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Switch } from "../ui/switch"
import { cn } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Globe, PlusCircle, RotateCcw, Tag, User } from "../ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { useState } from "react"
import { BillingData, billingService } from "@/app/services/billing-service"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/app/hooks/use-auth"

const billingFormSchema = z.object({
  plan: z.enum(["commission", "startup", "enterprise"]).default("commission"),
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

export function BillingForm({ id, initialData, onSuccess, onSubmitStart, onSubmitEnd }: BillingFormProps) {
  const { currentSite, updateBilling, refreshSites } = useSite()
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [creditsToBuy, setCreditsToBuy] = useState<number | null>(null)
  const [isPurchasingCredits, setIsPurchasingCredits] = useState(false)
  
  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingFormSchema),
    defaultValues: {
      plan: initialData?.plan || "commission",
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

  const handleSubmit = async (values: BillingFormValues) => {
    if (!currentSite || !user) {
      toast.error("No site selected or user not authenticated")
      return
    }

    try {
      if (onSubmitStart) onSubmitStart()
      setIsSubmitting(true)
      
      // If changing to a paid plan, redirect to Stripe Checkout
      if (values.plan === 'startup' || values.plan === 'enterprise') {
        const result = await billingService.createSubscriptionCheckoutSession(
          currentSite.id,
          values.plan,
          user.email!
        )
        
        if (result.success && result.url) {
          window.location.href = result.url
          return
        } else {
          toast.error(result.error || "Failed to create checkout session")
          return
        }
      }
      
      // For commission plan (free), just update the billing info
      const billingData: BillingData = {
        ...values,
        plan: 'commission'
      }
      
      const result = await updateBilling(currentSite.id, billingData)
      
      if (result.success) {
        toast.success("Plan updated successfully")
        if (onSuccess) {
          onSuccess()
        }
      } else {
        toast.error(result.error || "Failed to update billing information")
      }
    } catch (error) {
      console.error("Error submitting billing form:", error)
      toast.error("An unexpected error occurred while updating billing information")
    } finally {
      setIsSubmitting(false)
      if (onSubmitEnd) onSubmitEnd()
    }
  }

  const handlePurchaseCredits = async (amount: number) => {
    if (!currentSite) {
      toast.error("No site selected")
      return
    }

    try {
      setIsPurchasingCredits(true)
      
      // Call the Supabase function to purchase credits
      const supabase = createClient()
      const { data, error } = await supabase.rpc('purchase_credits', {
        site_id: currentSite.id,
        amount: amount,
        payment_method: 'credit_card'
      })
      
      if (error) {
        throw error
      }
      
      toast.success(`Successfully purchased ${amount} credits!`)
      
      // Refresh sites to get updated credit balance
      await refreshSites()
      setCreditsToBuy(null)
    } catch (error) {
      console.error("Error purchasing credits:", error)
      toast.error("Failed to purchase credits. Please try again.")
    } finally {
      setIsPurchasingCredits(false)
    }
  }

  return (
    <Form {...form}>
      <form id={id} onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <div className="space-y-8">
          <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Credits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-3xl font-bold">
                    {currentSite?.billing?.credits_available || 0} <span className="text-sm font-medium text-muted-foreground">credits available</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">Your credits will reset on the first day of each month</div>
                  <div className="text-sm text-muted-foreground mt-1">Credits are used for inference tokens, ads, and third-party services</div>
                </div>
                <div className="flex items-center gap-4">
                  <Button variant="outline" className="h-10" type="button" onClick={() => window.location.href = "/billing?tab=payment_history"}>
                    View usage history
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div 
                  className={cn(
                    "border rounded-lg p-4 transition-all cursor-pointer hover:border-blue-300 flex flex-col items-center justify-center text-center",
                    creditsToBuy === 20 && "border-blue-500 bg-blue-50/30 dark:bg-blue-900/20"
                  )}
                  onClick={() => setCreditsToBuy(20)}
                >
                  <div className="font-medium mb-2">20 Credits</div>
                  <div className="text-2xl font-bold mb-2">$20</div>
                  <div className="text-sm text-muted-foreground">$1.00 per credit</div>
                </div>
                
                <div 
                  className={cn(
                    "border rounded-lg p-4 transition-all cursor-pointer hover:border-blue-300 flex flex-col items-center justify-center text-center relative",
                    creditsToBuy === 52 ? "border-blue-500 bg-blue-50/30 dark:bg-blue-900/20" : "hover:border-blue-300"
                  )}
                  onClick={() => setCreditsToBuy(52)}
                >
                  <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs py-0.5 px-2 rounded-full">1.5% discount</div>
                  <div className="font-medium mb-2">52 Credits</div>
                  <div className="text-2xl font-bold mb-2">$49.25</div>
                  <div className="text-sm text-muted-foreground">$0.95 per credit</div>
                </div>
                
                <div 
                  className={cn(
                    "border rounded-lg p-4 transition-all cursor-pointer hover:border-blue-300 flex flex-col items-center justify-center text-center relative",
                    creditsToBuy === 515 && "border-blue-500 bg-blue-50/30 dark:bg-blue-900/20"
                  )}
                  onClick={() => setCreditsToBuy(515)}
                >
                  <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs py-0.5 px-2 rounded-full">3% discount</div>
                  <div className="font-medium mb-2">515 Credits</div>
                  <div className="text-2xl font-bold mb-2">$500</div>
                  <div className="text-sm text-muted-foreground">$0.97 per credit</div>
                </div>
              </div>
              
              {creditsToBuy && (
                <Button 
                  type="button"
                  className="mt-4 w-full"
                  onClick={() => window.location.href = `/checkout?credits=${creditsToBuy}`}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Purchase {creditsToBuy} Credits
                </Button>
              )}
            </CardContent>
          </Card>
          
          <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Subscription Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              <FormField
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Current Plan</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div 
                          className={cn(
                            "border rounded-lg p-4 cursor-pointer transition-all",
                            field.value === "commission" 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                              : "border-border hover:border-blue-300"
                          )}
                          onClick={() => field.onChange("commission")}
                        >
                          <div className="font-medium mb-2">Commission</div>
                          <div className="text-2xl font-bold mb-2">$0</div>
                          <div className="text-sm text-muted-foreground">Basic features</div>
                        </div>
                        
                        <div 
                          className={cn(
                            "border rounded-lg p-4 cursor-pointer transition-all",
                            field.value === "startup" 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                              : "border-border hover:border-blue-300"
                          )}
                          onClick={() => field.onChange("startup")}
                        >
                          <div className="font-medium mb-2">Startup</div>
                          <div className="text-2xl font-bold mb-2">$99</div>
                          <div className="text-sm text-muted-foreground">Startup features</div>
                        </div>
                        
                        <div 
                          className={cn(
                            "border rounded-lg p-4 cursor-pointer transition-all",
                            field.value === "enterprise" 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                              : "border-border hover:border-blue-300"
                          )}
                          onClick={() => field.onChange("enterprise")}
                        >
                          <div className="font-medium mb-2">Enterprise</div>
                          <div className="text-2xl font-bold mb-2">$500</div>
                          <div className="text-sm text-muted-foreground">Enterprise features</div>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs mt-2" />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="auto_renew"
                render={({ field }) => (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-medium flex items-center">
                        <RotateCcw className="mr-2 h-4 w-4 text-muted-foreground" />
                        Auto-renew subscription
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Automatically renew your subscription when it expires
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </div>
                )}
              />
            </CardContent>
          </Card>
          
          {/* Payment Method Info Card - Only for paid plans */}
          {form.watch("plan") !== "commission" && (
          <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Payment Method</CardTitle>
            </CardHeader>
              <CardContent className="space-y-4 px-8 pb-8">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-900/30">
                  <h4 className="font-medium mb-2 text-blue-700 dark:text-blue-400">Secure Payment via Stripe</h4>
                  <p className="text-sm text-blue-600 dark:text-blue-300 mb-3">
                    Payment details will be collected securely through Stripe Checkout when you save your plan.
                  </p>
                  <ul className="text-sm space-y-1 text-blue-600 dark:text-blue-300">
                    <li>• Industry-leading security and encryption</li>
                    <li>• Support for multiple payment methods</li>
                    <li>• PCI DSS compliant payment processing</li>
                    <li>• 3D Secure authentication included</li>
                  </ul>
                        </div>
                
                {currentSite?.billing?.masked_card_number && (
                  <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
                    <h4 className="font-medium mb-2">Current Payment Method</h4>
                    <p className="text-sm text-muted-foreground">
                      Card ending in {currentSite.billing.masked_card_number.slice(-4)}
                    </p>
                      </div>
                )}
            </CardContent>
          </Card>
          )}

          <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Tax ID</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              <FormField
                control={form.control}
                name="tax_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Tax ID</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className="pl-12 h-12 text-base" 
                          placeholder="Tax ID / VAT Number"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs mt-2" />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Billing Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              <FormField
                control={form.control}
                name="billing_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Street Address</FormLabel>
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
                      <FormLabel className="text-sm font-medium text-foreground">City</FormLabel>
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
                      <FormLabel className="text-sm font-medium text-foreground">Postal Code</FormLabel>
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
                      <FormLabel className="text-sm font-medium text-foreground">Country</FormLabel>
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
            </CardContent>
          </Card>

        </div>
      </form>
    </Form>
  )
} 