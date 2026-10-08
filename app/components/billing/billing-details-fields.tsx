"use client"

import { useFormContext } from "react-hook-form"
import type { BillingFormValues } from "./billing-form"
import { Button } from "../ui/button"
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from "../ui/section-card"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Globe, Tag } from "../ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"

export function BillingDetailsFields({ handleSaveTaxId, handleSaveBillingAddress, isSavingTaxId, isSavingBillingAddress }: {
  handleSaveTaxId: () => void
  handleSaveBillingAddress: () => void
  isSavingTaxId: boolean
  isSavingBillingAddress: boolean
}) {
  const form = useFormContext<BillingFormValues>()
  const { t } = useLocalization()
  return <>
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
  </>
}
