"use client"

import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"

import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"
import { Button } from "../ui/button"

import { CreditCard, Loader } from "../ui/icons"

import type { useShopSection } from "./use-shop-section"

export function ShopPayoutsCard({ form, savingCard, handleSave }: ReturnType<typeof useShopSection>) {
 return (      <SectionCard id="shop-payouts">
        <SectionCardHeader>
          <SectionCardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            Payout Details
          </SectionCardTitle>
          <p className="text-sm text-muted-foreground mt-1">Configure where your funds should be sent when you request a payout.</p>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="shop.bank_account_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Holder Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Acme Corporation Inc." {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shop.bank_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Chase Bank" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shop.bank_routing_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Routing / CLABE</FormLabel>
                  <FormControl>
                    <Input placeholder="021000021" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="shop.bank_account_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Number</FormLabel>
                  <FormControl>
                    <Input placeholder="123456789" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SectionCardContent>
        <SectionCardFooter>
          <Button variant="outline" size="sm" 
            type="button"
            onClick={() => handleSave('shop-payouts')}
            disabled={savingCard === 'shop-payouts' || !form.formState.isDirty}
          >
            {savingCard === 'shop-payouts' && <Loader className="h-4 w-4 mr-2 animate-spin" />}
            Save Settings
          </Button>
        </SectionCardFooter>
      </SectionCard>
)
}
