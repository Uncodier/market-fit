"use client"

import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"

import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"
import { Button } from "../ui/button"

import { Truck, ShieldCheck, RotateCcw, PlusCircle, Trash2 } from "../ui/icons"
import { EmptyCard } from "../ui/empty-card"

import type { useShopSection } from "./use-shop-section"
const AVAILABLE_ICONS = [
  { value: "Truck", label: "Delivery Truck", icon: Truck },
  { value: "ShieldCheck", label: "Shield Check", icon: ShieldCheck },
  { value: "RotateCcw", label: "Rotate / Returns", icon: RotateCcw }
]

export function ShopTrustCard({ form, savingCard, badgesList, handleSave, addBadge, removeBadge }: ReturnType<typeof useShopSection>) {
 return (      <SectionCard id="shop-trust">
        <SectionCardHeader>
          <SectionCardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-muted-foreground" />
            Trust & Policies
          </SectionCardTitle>
          <p className="text-sm text-muted-foreground mt-1">Configure shipping thresholds and trust signals to boost conversions.</p>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="shop.shipping_cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Global Shipping Cost</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input 
                        type="number" 
                        placeholder="0.00" 
                        className="pl-7"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? null : parseFloat(e.target.value)
                          field.onChange(val)
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Fixed amount charged for shipping. For distance/weight-based quotes, enable Dynamic Pricing on the product instead.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shop.free_shipping_threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Free Shipping Threshold</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input 
                        type="number" 
                        placeholder="50" 
                        className="pl-7"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? null : parseFloat(e.target.value)
                          field.onChange(val)
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Leave empty if you don't offer free shipping over a certain amount.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shop.return_policy_summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Return Policy Summary</FormLabel>
                  <FormControl>
                    <Input placeholder="30-Day Returns" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>Short text summarizing your return policy (e.g., "30-Day Returns").</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="shop.delivery_time_min"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery time (min)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="30" 
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : parseInt(e.target.value, 10)
                        field.onChange(val)
                      }}
                    />
                  </FormControl>
                  <FormDescription>Minimum delivery or prep time in minutes.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shop.delivery_time_max"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>to (max)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="45" 
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : parseInt(e.target.value, 10)
                        field.onChange(val)
                      }}
                    />
                  </FormControl>
                  <FormDescription>Maximum delivery time (optional).</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <FormLabel>Trust Badges</FormLabel>
                <FormDescription>Display up to 3 trust signals below the hero section.</FormDescription>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addBadge}
                disabled={badgesList.length >= 3}
                className="gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                Add Badge
              </Button>
            </div>

            <div className="space-y-3">
              {badgesList.length === 0 ? (
                <EmptyCard 
                  icon={<ShieldCheck />}
                  title="No trust badges"
                  description="Add badges like 'Fast Shipping' or 'Secure Checkout' to build trust."
                />
              ) : (
                badgesList.map((badge, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 border rounded-xl bg-muted/30">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`shop.trust_badges.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Title</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Fast Shipping" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`shop.trust_badges.${index}.subtitle`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Subtitle</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. On orders over $50" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`shop.trust_badges.${index}.icon`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Icon</FormLabel>
                            <FormControl>
                              <select 
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={field.value}
                                onChange={field.onChange}
                              >
                                {AVAILABLE_ICONS.map(i => (
                                  <option key={i.value} value={i.value}>{i.label}</option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeBadge(index)}
                      className="mt-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </SectionCardContent>
        <SectionCardFooter>
          <Button variant="outline" size="sm" 
            type="button"
            onClick={() => handleSave('shop-trust')}
            disabled={savingCard === 'shop-trust' || !form.formState.isDirty}
          >
            {savingCard === 'shop-trust' ? "Saving..." : "Save"}
          </Button>
        </SectionCardFooter>
      </SectionCard>
)
}
