"use client"

import { useFormContext } from "react-hook-form"
import type { BillingFormValues } from "./billing-form"
import { Button } from "../ui/button"
import { SectionCard, SectionCardHeader, SectionCardContent, SectionCardFooter } from "../ui/section-card"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
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
                      <Input
                        className="h-10 text-base sm:text-sm"
                        placeholder={t('billing.tax.placeholder') || "Tax ID / VAT Number"}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs mt-2" />
                  </FormItem>
                )}
              />
            </SectionCardContent>
          <SectionCardFooter>
            <Button 
              type="button"
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
                      <Input
                        className="h-10 text-base sm:text-sm"
                        autoComplete="street-address"
                        placeholder={t('billing.address.streetPlaceholder') || '123 Main St'}
                        {...field}
                      />
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
                        <Input
                          className="h-10 text-base sm:text-sm"
                          autoComplete="address-level2"
                          placeholder={t('billing.address.cityPlaceholder') || 'New York'}
                          {...field}
                        />
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
                        <Input
                          className="h-10 text-base sm:text-sm"
                          autoComplete="postal-code"
                          placeholder="10001"
                          {...field}
                        />
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
                        <Input
                          className="h-10 text-base sm:text-sm"
                          autoComplete="country-name"
                          placeholder={t('billing.address.countryPlaceholder') || 'United States'}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs mt-2" />
                    </FormItem>
                  )}
                />
              </div>
            </SectionCardContent>
          <SectionCardFooter>
            <Button 
              type="button"
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
