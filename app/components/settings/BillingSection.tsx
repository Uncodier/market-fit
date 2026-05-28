"use client"

import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { RotateCcw, User, Tag, Globe } from "../ui/icons"
import { cn } from "../../lib/utils"

import { useState } from "react"

export function BillingSection() {
  const form = useFormContext<SiteFormValues>()
  const [savingCard, setSavingCard] = useState<string | null>(null)

  const handleSave = async (id: string) => {
    // Note: Assuming there is a parent onSave available or we pass it down
    // Since there's no onSave in props currently, this is a placeholder
    // In a real scenario, we'd add onSave to BillingSectionProps
    setSavingCard(id)
    try {
      // Simulate save
      await new Promise(resolve => setTimeout(resolve, 500))
    } finally {
      setSavingCard(null)
    }
  }

  return (
    <div className="space-y-8">
      <Card id="credits" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Credits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-3xl font-bold">25 <span className="text-sm font-medium text-muted-foreground">credits available</span></div>
              <div className="text-sm text-muted-foreground mt-1">Your credits will reset on the first day of each month</div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" className="h-10">
                View usage history
              </Button>
              <Button className="h-10">
                Buy more credits
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              className="border rounded-lg p-4 transition-all cursor-pointer hover:border-blue-300 flex flex-col items-center justify-center text-center"
            >
              <div className="font-medium mb-2">50 Credits</div>
              <div className="text-2xl font-bold mb-2">$19</div>
              <div className="text-sm text-muted-foreground">One-time purchase</div>
            </div>
            
            <div 
              className="border border-blue-500 rounded-lg p-4 transition-all flex flex-col items-center justify-center text-center relative bg-blue-50/30 dark:bg-blue-900/20"
            >
              <div className="absolute -top-2.5 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs py-0.5 px-2 rounded-full">Most popular</div>
              <div className="font-medium mb-2">100 Credits</div>
              <div className="text-2xl font-bold mb-2">$29</div>
              <div className="text-sm text-muted-foreground">One-time purchase</div>
            </div>
            
            <div 
              className="border rounded-lg p-4 transition-all cursor-pointer hover:border-blue-300 flex flex-col items-center justify-center text-center"
            >
              <div className="font-medium mb-2">200 Credits</div>
              <div className="text-2xl font-bold mb-2">$49</div>
              <div className="text-sm text-muted-foreground">One-time purchase</div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            variant="outline"
            onClick={() => handleSave('credits')}
            disabled={savingCard === 'credits'}
          >
            {savingCard === 'credits' ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
      
      <Card id="subscription-plan" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Subscription Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8">
          <FormField
            control={form.control}
            name="billing.plan"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">Current Plan</FormLabel>
                <FormControl>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div 
                      className={cn(
                        "border rounded-lg p-4 cursor-pointer transition-all",
                        field.value === "commission" 
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                          : "dark:border-white/5 border-black/5 hover:border-blue-300"
                      )}
                      onClick={() => field.onChange("commission")}
                    >
                      <div className="font-medium mb-2">12-Month POC</div>
                      <div className="text-2xl font-bold mb-2">$27</div>
                      <div className="text-sm text-muted-foreground">Basic features</div>
                      <div className="text-sm text-muted-foreground mt-1">USD/year paid at the end of the year</div>
                    </div>
                    
                    <div 
                      className={cn(
                        "border rounded-lg p-4 cursor-pointer transition-all",
                        field.value === "startup" 
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                          : "dark:border-white/5 border-black/5 hover:border-blue-300"
                      )}
                      onClick={() => field.onChange("startup")}
                    >
                      <div className="font-medium mb-2">Startup</div>
                      <div className="text-2xl font-bold mb-2">$99</div>
                      <div className="text-sm text-muted-foreground">Startup features</div>
                      <div className="text-sm text-muted-foreground mt-1">100 credits/month</div>
                    </div>
                    
                    <div 
                      className={cn(
                        "border rounded-lg p-4 cursor-pointer transition-all",
                        field.value === "enterprise" 
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950" 
                          : "dark:border-white/5 border-black/5 hover:border-blue-300"
                      )}
                      onClick={() => field.onChange("enterprise")}
                    >
                      <div className="font-medium mb-2">Enterprise</div>
                      <div className="text-2xl font-bold mb-2">$500</div>
                      <div className="text-sm text-muted-foreground">Enterprise features</div>
                      <div className="text-sm text-muted-foreground mt-1">1000 credits/month</div>
                    </div>
                  </div>
                </FormControl>
                <FormMessage className="text-xs mt-2" />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            variant="outline"
            onClick={() => handleSave('subscription-plan')}
            disabled={savingCard === 'subscription-plan'}
          >
            {savingCard === 'subscription-plan' ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
      
      <Card id="payment-method" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Payment Method</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8">
          <FormField
            control={form.control}
            name="billing.card_name"
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
            name="billing.card_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-foreground">Card Number</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-12 h-12 text-base" 
                      placeholder="•••• •••• •••• ••••"
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
              name="billing.card_expiry"
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
              name="billing.card_cvc"
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
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            variant="outline"
            onClick={() => handleSave('payment-method')}
            disabled={savingCard === 'payment-method'}
          >
            {savingCard === 'payment-method' ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
      
      <Card id="billing-address" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Billing Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8">
          <FormField
            control={form.control}
            name="billing.billing_address"
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
              name="billing.billing_city"
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
              name="billing.billing_postal_code"
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
              name="billing.billing_country"
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
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            variant="outline"
            onClick={() => handleSave('billing-address')}
            disabled={savingCard === 'billing-address'}
          >
            {savingCard === 'billing-address' ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 