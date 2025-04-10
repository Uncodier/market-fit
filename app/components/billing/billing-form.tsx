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
import { BillingData } from "@/app/services/billing-service"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

const billingFormSchema = z.object({
  plan: z.enum(["free", "starter", "professional", "enterprise"]).default("free"),
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [creditsToBuy, setCreditsToBuy] = useState<number | null>(null)
  const [isPurchasingCredits, setIsPurchasingCredits] = useState(false)
  
  const form = useForm<BillingFormValues>({
    resolver: zodResolver(billingFormSchema),
    defaultValues: {
      plan: initialData?.plan || "free",
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
    if (!currentSite) {
      toast.error("No site selected")
      return
    }

    try {
      if (onSubmitStart) onSubmitStart()
      setIsSubmitting(true)
      
      // Format the expiry date if needed
      let formattedExpiry = values.card_expiry
      if (values.card_expiry && !values.card_expiry.includes('/')) {
        // Convert MMYY to MM/YY
        formattedExpiry = `${values.card_expiry.substring(0, 2)}/${values.card_expiry.substring(2)}`
      }
      
      const billingData: BillingData = {
        ...values,
        card_expiry: formattedExpiry
      }
      
      const result = await updateBilling(currentSite.id, billingData)
      
      if (result.success) {
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
                    creditsToBuy === 50 && "border-blue-500 bg-blue-50/30 dark:bg-blue-900/20"
                  )}
                  onClick={() => setCreditsToBuy(50)}
                >
                  <div className="font-medium mb-2">50 Credits</div>
                  <div className="text-2xl font-bold mb-2">$19</div>
                  <div className="text-sm text-muted-foreground">One-time purchase</div>
                </div>
                
                <div 
                  className={cn(
                    "border rounded-lg p-4 transition-all cursor-pointer hover:border-blue-300 flex flex-col items-center justify-center text-center relative",
                    creditsToBuy === 100 ? "border-blue-500 bg-blue-50/30 dark:bg-blue-900/20" : "hover:border-blue-300"
                  )}
                  onClick={() => setCreditsToBuy(100)}
                >
                  <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs py-0.5 px-2 rounded-full">Most popular</div>
                  <div className="font-medium mb-2">100 Credits</div>
                  <div className="text-2xl font-bold mb-2">$29</div>
                  <div className="text-sm text-muted-foreground">One-time purchase</div>
                </div>
                
                <div 
                  className={cn(
                    "border rounded-lg p-4 transition-all cursor-pointer hover:border-blue-300 flex flex-col items-center justify-center text-center",
                    creditsToBuy === 200 && "border-blue-500 bg-blue-50/30 dark:bg-blue-900/20"
                  )}
                  onClick={() => setCreditsToBuy(200)}
                >
                  <div className="font-medium mb-2">200 Credits</div>
                  <div className="text-2xl font-bold mb-2">$49</div>
                  <div className="text-sm text-muted-foreground">One-time purchase</div>
                </div>
              </div>
              
              {creditsToBuy && (
                <Button 
                  type="button"
                  className="mt-4 w-full"
                  disabled={isPurchasingCredits}
                  onClick={() => handlePurchaseCredits(creditsToBuy)}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  {isPurchasingCredits 
                    ? `Processing payment...` 
                    : `Purchase ${creditsToBuy} Credits for ${creditsToBuy === 50 ? '$19' : creditsToBuy === 100 ? '$29' : '$49'}`
                  }
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
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div 
                          className={cn(
                            "border rounded-lg p-4 cursor-pointer transition-all",
                            field.value === "free" 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                              : "border-border hover:border-blue-300"
                          )}
                          onClick={() => field.onChange("free")}
                        >
                          <div className="font-medium mb-2">Free</div>
                          <div className="text-2xl font-bold mb-2">$0</div>
                          <div className="text-sm text-muted-foreground">Basic features</div>
                        </div>
                        
                        <div 
                          className={cn(
                            "border rounded-lg p-4 cursor-pointer transition-all",
                            field.value === "starter" 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                              : "border-border hover:border-blue-300"
                          )}
                          onClick={() => field.onChange("starter")}
                        >
                          <div className="font-medium mb-2">Starter</div>
                          <div className="text-2xl font-bold mb-2">$29</div>
                          <div className="text-sm text-muted-foreground">100 credits/mo</div>
                        </div>
                        
                        <div 
                          className={cn(
                            "border rounded-lg p-4 cursor-pointer transition-all",
                            field.value === "professional" 
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                              : "border-border hover:border-blue-300"
                          )}
                          onClick={() => field.onChange("professional")}
                        >
                          <div className="font-medium mb-2">Professional</div>
                          <div className="text-2xl font-bold mb-2">$79</div>
                          <div className="text-sm text-muted-foreground">500 credits/mo</div>
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
                          <div className="text-2xl font-bold mb-2">$199</div>
                          <div className="text-sm text-muted-foreground">Unlimited credits</div>
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
          
          <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              <FormField
                control={form.control}
                name="card_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Cardholder Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className="pl-12 h-12 text-base" 
                          placeholder="John Doe"
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
                name="card_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Card Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className="pl-12 h-12 text-base" 
                          placeholder={currentSite?.billing?.masked_card_number || "•••• •••• •••• ••••"}
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs mt-2" />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="card_expiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">Expiration Date</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            className="pl-12 h-12 text-base" 
                            placeholder="MM/YY"
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
                  name="card_cvc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-foreground">CVC</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            className="pl-12 h-12 text-base" 
                            placeholder="123"
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
          
          <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Card Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              <FormField
                control={form.control}
                name="card_address"
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
                  name="card_city"
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
                  name="card_postal_code"
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
                  name="card_country"
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