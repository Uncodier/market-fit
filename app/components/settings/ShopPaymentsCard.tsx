"use client"

import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "../ui/form"
import { Input } from "../ui/input"

import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { Store, Truck, CreditCard } from "../ui/icons"

import type { useShopSection } from "./use-shop-section"

export function ShopPaymentsCard({ form, savingCard, handleSave }: ReturnType<typeof useShopSection>) {
 return (      <SectionCard id="shop-payments">
        <SectionCardHeader>
          <SectionCardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            Payment & Delivery Policy
          </SectionCardTitle>
          <p className="text-sm text-muted-foreground mt-1">Configure default payment methods and delivery options for your marketplace items. Products can still override these settings.</p>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-8">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Accepted Payment Methods</h4>
              <p className="text-sm text-muted-foreground mb-4">Choose how customers can pay during checkout.</p>
              
              <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
                <FormField
                  control={form.control}
                  name="shop.payment_methods"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                      <div className="space-y-0.5">
                        <FormLabel className="font-medium flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-blue-500" />
                          Online Card Payment (Stripe)
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Customers pay online during checkout using Stripe.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value?.includes('card')}
                          onCheckedChange={(checked) => {
                            const val = field.value || []
                            field.onChange(checked 
                              ? [...val, 'card'] 
                              : val.filter((v: string) => v !== 'card')
                            )
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="shop.payment_methods"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                      <div className="space-y-0.5">
                        <FormLabel className="font-medium flex items-center gap-2">
                          <Store className="w-4 h-4 text-emerald-500" />
                          Cash on Pickup
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Customers complete checkout unpaid and pay cash at the store.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value?.includes('cash_on_pickup')}
                          onCheckedChange={(checked) => {
                            const val = field.value || []
                            field.onChange(checked 
                              ? [...val, 'cash_on_pickup'] 
                              : val.filter((v: string) => v !== 'cash_on_pickup')
                            )
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shop.payment_methods"
                  render={({ field }) => (
                    <div className="space-y-4">
                      <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                        <div className="space-y-0.5">
                          <FormLabel className="font-medium flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-indigo-500" />
                            Bank Transfer
                          </FormLabel>
                          <FormDescription className="text-xs">
                            Customers complete checkout unpaid. You verify the transfer manually.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value?.includes('bank_transfer')}
                            onCheckedChange={(checked) => {
                              const val = field.value || []
                              field.onChange(checked 
                                ? [...val, 'bank_transfer'] 
                                : val.filter((v: string) => v !== 'bank_transfer')
                              )
                            }}
                          />
                        </FormControl>
                      </FormItem>
                      
                      {field.value?.includes('bank_transfer') && (
                        <div className="space-y-4 p-4 border rounded-lg bg-background mt-2">
                          <h5 className="text-sm font-medium">Bank Account Details</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="shop.bank_transfer.bank_name"
                              render={({ field: subField }) => (
                                <FormItem>
                                  <FormLabel>Bank Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g. Chase, Bank of America" {...subField} value={subField.value || ''} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="shop.bank_transfer.account_holder"
                              render={({ field: subField }) => (
                                <FormItem>
                                  <FormLabel>Account Holder</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g. Acme Corp" {...subField} value={subField.value || ''} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="shop.bank_transfer.account_number"
                              render={({ field: subField }) => (
                                <FormItem>
                                  <FormLabel>Account Number / IBAN</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g. 123456789" {...subField} value={subField.value || ''} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="shop.bank_transfer.routing_number"
                              render={({ field: subField }) => (
                                <FormItem>
                                  <FormLabel>Routing Number / SWIFT / BIC</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Optional" {...subField} value={subField.value || ''} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <div className="md:col-span-2">
                              <FormField
                                control={form.control}
                                name="shop.bank_transfer.instructions"
                                render={({ field: subField }) => (
                                  <FormItem>
                                    <FormLabel>Additional Instructions</FormLabel>
                                    <FormControl>
                                      <Input placeholder="e.g. Please include order number in transfer reference." {...subField} value={subField.value || ''} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Default Delivery Options</h4>
              <p className="text-sm text-muted-foreground mb-4">Fallback options for physical products without specific delivery settings.</p>
              
              <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
                <FormField
                  control={form.control}
                  name="shop.default_delivery_options"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                      <div className="space-y-0.5">
                        <FormLabel className="font-medium flex items-center gap-2">
                          <Truck className="w-4 h-4 text-orange-500" />
                          Ship to Customer
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Deliver physical goods to customer's address.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value?.includes('ship')}
                          onCheckedChange={(checked) => {
                            const val = field.value || []
                            field.onChange(checked 
                              ? [...val, 'ship'] 
                              : val.filter((v: string) => v !== 'ship')
                            )
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="shop.default_delivery_options"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                      <div className="space-y-0.5">
                        <FormLabel className="font-medium flex items-center gap-2">
                          <Store className="w-4 h-4 text-purple-500" />
                          Store Pickup
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Customers pick up their order at your location.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value?.includes('pickup')}
                          onCheckedChange={(checked) => {
                            const val = field.value || []
                            field.onChange(checked 
                              ? [...val, 'pickup'] 
                              : val.filter((v: string) => v !== 'pickup')
                            )
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shop.default_delivery_options"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                      <div className="space-y-0.5">
                        <FormLabel className="font-medium flex items-center gap-2">
                          <Store className="w-4 h-4 text-blue-500" />
                          Consume Here
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Customers consume their order at your location.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value?.includes('dine_in')}
                          onCheckedChange={(checked) => {
                            const val = field.value || []
                            field.onChange(checked 
                              ? [...val, 'dine_in'] 
                              : val.filter((v: string) => v !== 'dine_in')
                            )
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </SectionCardContent>
        <SectionCardFooter>
          <Button variant="outline" size="sm" 
            type="button"
            onClick={() => handleSave('shop-payments')}
            disabled={savingCard === 'shop-payments' || !form.formState.isDirty}
          >
            {savingCard === 'shop-payments' ? "Saving..." : "Save"}
          </Button>
        </SectionCardFooter>
      </SectionCard>
)
}
